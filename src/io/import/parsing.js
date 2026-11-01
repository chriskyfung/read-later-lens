/**
 * @fileoverview Import parsing + staging.
 *
 * Extracted from src/io/importer.js. Parses CSV/JSON/SQLite into staging
 * records without mutating global application state. The SQLite path is the
 * only one that reaches outside this module (initSql + adapter).
 */

import Papa from 'papaparse';
import { checkImport } from '../../providers/profiles.js';
import { resolveImportAdapter } from '../../providers/index.js';
import { captureCsvDialect } from '../../utils/csv';
import { newFileId } from '../../utils/id.js';
import { initSql } from '../../services/sqlEngine.js';
import { UNSUPPORTED_SOURCE_FLAG, UNSUPPORTED_TYPE_FLAG } from './constants.js';
import { expandEnvelopeSources } from './envelope.js';

/**
 * Wrap PapaParse's callback API into a promise so the CSV path is awaitable
 * like the JSON and SQLite paths. This guarantees the success/failure toast
 * is emitted *after* parsing completes, and that parse errors surface through
 * the same catch as every other format.
 *
 * Papa is imported from the `papaparse` dependency, so the browser runs the
 * same library build the bundle ships - and the same one the round-trip test
 * exercises end-to-end (a mock stands in for it in the call-assertion tests).
 * @param {string} text
 * @returns {Promise<{data: object[], errors: object[]}>}
 */
export function parseCsvWithPapa(text) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results),
      error: (err) => reject(err),
    });
  });
}

/**
 * Prepare a single uploaded file by parsing, validating and normalizing it
 * into a staging result without mutating global application state.
 *
 * @param {File} file
 * @param {string} finalName
 * @param {string} profile Import profile id chosen in the source picker.
 * @returns {Promise<{
 *   fileRecords: import('../core/state').SourceFileRecord[],
 *   records: import('../../core/model/BookmarkRecord.js').BookmarkRecord[],
 *   count: number,
 *   skipped: number,
 *   droppedNoUrl: number,
 *   checkNote: string,
 * }>}
 */
export async function prepareSingleFile(file, finalName, profile) {
  const fileId = newFileId();
  const ext = finalName.split('.').pop().toLowerCase();

  const fileRecord = {
    id: fileId,
    name: finalName,
    type: ext,
    profile,
    originalData: null,
  };

  const adapter = resolveImportAdapter(profile);
  let checkNote = '';
  let count = 0;
  let skipped = 0;
  let droppedNoUrl = 0;
  let records = [];
  // One entry per source this file resolves to. A unified export naming several
  // sources expands into several; every other import stays at exactly one.
  let fileRecords = [fileRecord];

  if (ext === 'csv') {
    const text = await file.text();
    fileRecord.originalData = text;
    const results = await parseCsvWithPapa(text);
    const rows = results.data || [];
    const parseErrors = results.errors || [];
    if (rows.length === 0 && parseErrors.length > 0) {
      throw new Error('CSV 解析失敗');
    }
    // Remember the header row this file actually had, so save-back re-emits the
    // source's own columns and order instead of the app's internal schema. The
    // raw text is persisted, but after a reload the exporter must not have to
    // re-parse the file to learn its shape.
    fileRecord.csvColumns = Array.isArray(results.meta?.fields) ? [...results.meta.fields] : null;
    // Papa already reports the delimiter and line terminator it detected, so the
    // dialect is observed here rather than guessed at save time. A tab- or
    // semicolon-delimited source (a tab-delimited export, or a European-locale
    // Excel file) would otherwise come back comma-delimited, breaking the very
    // pipeline it came from.
    fileRecord.csvDialect = captureCsvDialect(results.meta);
    checkNote = sanityCheckOrThrow(profile, 'csv', results, rows);
    // The unified CSV has no envelope to hang a manifest on, but it writes
    // `source_file_id` / `source_file_name` on every row, which carries the same
    // information — so its round trip is just as faithful.
    const expanded = expandEnvelopeSources(profile, rows, fileRecord, null, adapter);
    if (expanded) {
      fileRecords = expanded.fileRecords;
      records = expanded.records;
      droppedNoUrl = expanded.stats.droppedNoUrl;
    } else {
      const adapted = adapter.importJsonOrCsv(rows, fileRecord.id, fileRecord.name);
      records = adapted.records;
      droppedNoUrl = adapted.stats.droppedNoUrl;
    }
    count = records.length;
    skipped = parseErrors.length;
  } else if (ext === 'json') {
    const text = await file.text();
    fileRecord.originalData = text;
    const parsed = JSON.parse(text);
    const arrayData = Array.isArray(parsed) ? parsed : parsed.bookmarks || [parsed];
    checkNote = sanityCheckOrThrow(profile, 'json', parsed, arrayData);
    // A version-2 unified envelope lists the sources it was taken from, so the
    // per-source folders can be rebuilt. An older envelope has no manifest, but
    // its rows still carry per-record source ids, which is enough on its own.
    const expanded = expandEnvelopeSources(
      profile,
      arrayData,
      fileRecord,
      Array.isArray(parsed?.sources) ? parsed.sources : null,
      adapter,
    );
    if (expanded) {
      fileRecords = expanded.fileRecords;
      records = expanded.records;
      droppedNoUrl = expanded.stats.droppedNoUrl;
    } else {
      const adapted = adapter.importJsonOrCsv(arrayData, fileRecord.id, fileRecord.name);
      records = adapted.records;
      droppedNoUrl = adapted.stats.droppedNoUrl;
    }
    count = records.length;
  } else if (ext === 'db' || ext === 'sqlite') {
    const arrayBuffer = await file.arrayBuffer();
    const uInt8Array = new Uint8Array(arrayBuffer);
    fileRecord.originalData = uInt8Array;
    const sqlEngine = await initSql();
    const {
      records: parsed,
      schema,
      stats,
    } = await adapter.importSqlite(uInt8Array, fileRecord.id, fileRecord.name, sqlEngine);
    records = parsed;
    // Remember the table layout this file actually had. The raw buffer is
    // memory-only, so without this a reload would leave the exporter with no
    // honest description of the source's own shape.
    fileRecord.sqliteSchema = schema;
    // SQLite drops are the adapter's own count, so the same file reports the
    // same gap whatever the format — nothing to infer from a delta.
    count = records.length;
    droppedNoUrl = stats.droppedNoUrl;
  } else {
    const err = new Error(`不支援的檔案格式「.${ext}」`);
    err[UNSUPPORTED_TYPE_FLAG] = true;
    throw err;
  }

  return { fileRecords, records, count, skipped, droppedNoUrl, checkNote };
}

/**
 * Run the header sanity check for a parsed file. Throws for a blocked source
 * (official Instapaper CSV — would otherwise import as garbage rows); returns
 * a non-blocking warning note for a profile/column mismatch, or '' when ok.
 *
 * SQLite files are intentionally not checked: the official export is CSV-only
 * and both supported table shapes (articles / bookmarks) already parse.
 *
 * @param {string} profile   Chosen source profile id.
 * @param {'csv'|'json'} ext Parsed file kind.
 * @param {object} parsed    Papa results (csv) or the parsed JSON root.
 * @param {object[]} rows    Extracted record rows (for key fallback).
 * @returns {string} Warning note ('' when ok).
 * @throws {Error} When the source is explicitly unsupported.
 */
export function sanityCheckOrThrow(profile, ext, parsed, rows) {
  let sample;
  if (ext === 'csv') {
    const csvHeaders = parsed.meta?.fields ?? (rows[0] ? Object.keys(rows[0]) : []);
    sample = { csvHeaders };
  } else {
    sample = { jsonRoot: parsed, jsonKeys: rows[0] ? Object.keys(rows[0]) : [] };
  }

  const result = checkImport(profile, sample);
  if (result.verdict === 'unsupported') {
    const err = new Error(result.message);
    err[UNSUPPORTED_SOURCE_FLAG] = true;
    throw err;
  }
  return result.verdict === 'mismatch' ? result.message : '';
}
