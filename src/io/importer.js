/**
 * @fileoverview Importer module for handling CSV, JSON, and SQLite files.
 * Extracts the file-import flow from the monolithic index.html.
 */

import * as state from '../core/state.js';
import { STALE_STATE_REASON } from '../core/guard.js';
import { resolveImportAdapter } from '../providers/index.js';
import {
  checkImport,
  defaultProfileId,
  normalizeProfileId,
  selectableProfiles,
} from '../providers/profiles.js';
import { SELECTED_CARD_CLASSES, UNSELECTED_CARD_CLASSES } from '../components/io/importModal.js';
import { showToast, pushLayer, popLayer, topLayerId } from '../utils/dom.js';
import { captureCsvDialect } from '../utils/csv.js';
import { newFileId } from '../utils/id.js';
import { initSql } from './sqlLoader.js';
import Papa from 'papaparse';

/**
 * Dependencies injected from the main application orchestrator.
 * @typedef {object} ImporterDeps
 * @property {function} persistAndRender - Callback to save state to IndexedDB and
 *   re-render views. Resolves to `{persisted, rendered}` (see src/main.js), or to
 *   nothing for a fire-and-forget stub. `persisted: false` marks a failed cache
 *   write, which the importer rolls back.
 * @property {function} [render] - Re-render the views after state is rolled back.
 *   Persistence is intentionally not retried here: the transaction already failed
 *   to reach storage, and the rollback must only make the in-memory session match
 *   what the next reload will show.
 */
let deps = {
  persistAndRender: () => {},
  render: () => {},
};

/**
 * Initialize importer with necessary side-effect callbacks.
 * @param {ImporterDeps} injectedDeps
 */
export function initImporter(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

// ------------------------------------------------------------------
// Import source picker modal
//
// The header 匯入 button opens this modal instead of the raw file dialog.
// Selection is explicit (no auto-detect): the chosen profile is remembered
// for the session and stamped onto every source file imported afterwards.
// ------------------------------------------------------------------

/** Currently selected source profile id (session-only; defaults to InstapaperScraper). */
let selectedProfileId = defaultProfileId();

/**
 * @param {string} profileId
 * @returns {HTMLElement|null} The profile's radio card element.
 */
function cardEl(profileId) {
  return document.getElementById(`importProfile-${profileId}`);
}

/**
 * Select a source profile: remember it and sync the radio cards' aria state
 * and selected/unselected border classes. Exported so tests (and the modal
 * opener) can reset the session default deterministically. Unknown ids
 * coerce to the default, so the radiogroup keeps exactly one checked card.
 *
 * @param {string} profileId
 */
export function applyProfileSelection(profileId) {
  selectedProfileId = normalizeProfileId(profileId);
  for (const { id } of selectableProfiles()) {
    const card = cardEl(id);
    if (!card || !card.classList) continue;
    // Compare against the coerced selection, not the raw input: an unknown
    // id must still leave exactly one card checked instead of zero.
    card.setAttribute?.('aria-checked', String(id === selectedProfileId));
    const checked = id === selectedProfileId;
    for (const name of checked ? UNSELECTED_CARD_CLASSES : SELECTED_CARD_CLASSES) {
      card.classList.remove(name);
    }
    for (const name of checked ? SELECTED_CARD_CLASSES : UNSELECTED_CARD_CLASSES) {
      card.classList.add(name);
    }
  }
}

/**
 * Open the source picker modal as a stack layer (Esc, focus trap and inert
 * background come from the shared layer stack). Re-entrant clicks are no-ops.
 */
export function openImportModal() {
  if (topLayerId() === 'importModal') return;
  applyProfileSelection(selectedProfileId);
  pushLayer('importModal');
}

/** Close the source picker, revealing whatever modal (if any) is beneath it. */
export function closeImportModal() {
  popLayer('importModal');
}

/**
 * Arrow/Home/End navigation within the radiogroup (Enter/Space already fire
 * click natively on the card buttons). Wraps around both ends.
 *
 * @param {KeyboardEvent} event
 */
function handleProfileKeydown(event) {
  const list = selectableProfiles();
  const idx = list.findIndex((profile) => profile.id === selectedProfileId);
  let next = null;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    next = list[(idx + 1) % list.length];
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    next = list[(idx - 1 + list.length) % list.length];
  } else if (event.key === 'Home') {
    next = list[0];
  } else if (event.key === 'End') {
    next = list[list.length - 1];
  }
  if (!next) return;
  event.preventDefault?.();
  applyProfileSelection(next.id);
  const card = cardEl(next.id);
  if (card && typeof card.focus === 'function') card.focus();
}

/**
 * Node ids the duplicate prompt needs before a user can answer it. The modal
 * sits outside the layer stack (no Esc/backdrop resolution), so every one of
 * these controls is load-bearing: without them the question cannot be answered
 * and the batch would wait for a reply that can never arrive.
 */
const DUPLICATE_PROMPT_IDS = [
  'duplicateModal',
  'duplicateFileText',
  'dupBtnOverwrite',
  'dupBtnKeepBoth',
  'dupBtnCancel',
];

/**
 * @returns {boolean} Whether the duplicate prompt can be shown and answered.
 */
function duplicatePromptReady() {
  return DUPLICATE_PROMPT_IDS.every((id) => document.getElementById(id));
}

/**
 * Refusal copy for an unusable duplicate prompt. Used by the batch preflight
 * and by a mid-batch escape where nothing has been committed yet — both cases
 * where "not a single file was imported" is literally true.
 *
 * @param {string} names Colliding file name(s), already formatted.
 * @returns {string}
 */
function promptUnavailableMessage(names) {
  return `無法顯示同名檔案的處理選項，因此未匯入任何檔案（${names}）。請重新載入頁面後再試。`;
}

/**
 * Render the duplicate prompt's body text.
 *
 * @param {string} fileName
 * @returns {boolean} false when the prompt body is missing; the caller must
 *   not ask the question then, or the user would be choosing blind.
 */
function showDuplicatePrompt(fileName) {
  const text = document.getElementById('duplicateFileText');
  if (!text) {
    console.warn('Duplicate prompt body is missing:', fileName);
    return false;
  }
  text.innerText = `已存在名為「${fileName}」的檔案。請選擇要如何處理？`;
  return true;
}

/**
 * @param {string} fileName
 * @returns {string|null} Id of the registered source with this exact name.
 */
function findDuplicateSourceId(fileName) {
  for (const [id, source] of state.sourceFiles.entries()) {
    if (source.name === fileName) return id;
  }
  return null;
}

/**
 * Logic for resolving duplicate filename conflicts via a modal promise.
 */
function waitForDuplicateResolution() {
  return new Promise((resolve, reject) => {
    const modal = document.getElementById('duplicateModal');
    const btnOverwrite = document.getElementById('dupBtnOverwrite');
    const btnKeep = document.getElementById('dupBtnKeepBoth');
    const btnCancel = document.getElementById('dupBtnCancel');

    // Defence-in-depth: the batch preflight verifies these nodes before any
    // state is mutated, but the markup can still change between files. A
    // half-wired modal must neither throw inside this executor (which would
    // reject the awaiting batch with a raw TypeError) nor leave the batch
    // waiting for a reply no remaining button can give.
    if (!modal || !btnOverwrite || !btnKeep || !btnCancel) {
      const err = new Error('無法顯示同名檔案的處理選項');
      err[DUPLICATE_PROMPT_FLAG] = true;
      reject(err);
      return;
    }

    const cleanup = () => {
      // The modal markup is optional: a missing node must not turn a resolution
      // into a TypeError in the middle of the import flow.
      btnOverwrite?.removeEventListener('click', onOverwrite);
      btnKeep?.removeEventListener('click', onKeep);
      btnCancel?.removeEventListener('click', onCancel);
      modal?.classList.add('hidden');
    };

    const onOverwrite = () => {
      cleanup();
      resolve('overwrite');
    };
    const onKeep = () => {
      cleanup();
      resolve('keep');
    };
    const onCancel = () => {
      cleanup();
      resolve('cancel');
    };

    btnOverwrite.addEventListener('click', onOverwrite);
    btnKeep.addEventListener('click', onKeep);
    btnCancel.addEventListener('click', onCancel);

    modal.classList.remove('hidden');
  });
}

/**
 * Create a source name that is unique against the current source-file names.
 * File names are compared exactly, matching the importer's duplicate policy;
 * timestamp collisions and extension-less names are handled deterministically.
 *
 * @param {string} originalName
 * @param {Iterable<string>} existingNames
 * @returns {string}
 */
export function createUniqueSourceName(originalName, existingNames) {
  const usedNames = new Set(existingNames);
  const dot = originalName.lastIndexOf('.');
  const hasExtension = dot > 0 && dot < originalName.length - 1;
  const stem = hasExtension ? originalName.slice(0, dot) : originalName;
  const extension = hasExtension ? originalName.slice(dot) : '';
  const timestamp = Date.now();

  let candidate = `${stem}_${timestamp}${extension}`;
  let suffix = 1;
  while (usedNames.has(candidate)) {
    candidate = `${stem}_${timestamp}_${suffix}${extension}`;
    suffix += 1;
  }
  return candidate;
}

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
function parseCsvWithPapa(text) {
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
 * Build the toast message for a completed import.
 *
 * Priority: partial failure (parse errors or URL-less rows dropped) > empty
 * result > trash-displacement note > plain success. An unsupported-extension
 * import never reaches here (it throws and lands in the failure toast
 * instead). A non-blocking `note` (header/profile mismatch warning) is
 * appended last.
 *
 * @param {string} finalName
 * @param {number} displaced  Trashed records the fresh import replaced.
 * @param {number} count      Imported bookmark count (adapter output).
 * @param {number} skipped    CSV rows Papa could not parse.
 * @param {number} [droppedNoUrl] URL-less rows the adapter dropped (its own
 *   count, not a length delta, so the reason is intrinsic to the number).
 * @param {string} [note]     Optional sanity-check warning to append.
 * @returns {string}
 */
function buildImportedMessage(finalName, displaced, count, skipped, droppedNoUrl = 0, note = '') {
  const parts = [];
  if (skipped > 0) parts.push(`${skipped} 列解析失敗`);
  if (droppedNoUrl > 0) parts.push(`${droppedNoUrl} 筆缺少網址`);

  let message;
  if (parts.length > 0) {
    message = `已載入檔案: ${finalName}（${count} 筆書籤，${parts.join('、')}已略過）`;
  } else if (count === 0) {
    message = `已載入檔案: ${finalName}，但未偵測到任何書籤`;
  } else if (displaced > 0) {
    message = `已成功載入檔案: ${finalName}（${displaced} 筆已存在於回收桶的書籤已被新匯入資料取代）`;
  } else {
    message = `已成功載入檔案: ${finalName}`;
  }
  return note ? `${message}；${note}` : message;
}

/**
 * Maximum failed files named before the summary collapses to a count.
 * Successful files are always counts; only failures are actionable, and only
 * the first few fit a 2.5s single-line toast.
 */
const MAX_NAMED_BATCH_FAILURES = 3;

/**
 * Compose one toast for a multi-file batch whose per-file outcomes were
 * collected by handleFileUploads. Successes aggregate into counts; failures
 * are named with their short reason so no file's result vanishes behind the
 * single `#toastMsg` element.
 *
 * @param {Array<object>} outcomes Per-file results, excluding user-cancelled
 *   duplicates.
 * @returns {string}
 */
function buildBatchSummary(outcomes) {
  const imported = outcomes.filter((outcome) => outcome.status === 'imported');
  const failed = outcomes.filter((outcome) => outcome.status === 'failed');
  const totalBookmarks = imported.reduce((sum, outcome) => sum + outcome.count, 0);
  const skippedParseRows = imported.reduce((sum, outcome) => sum + outcome.skipped, 0);
  const droppedNoUrl = imported.reduce((sum, outcome) => sum + outcome.droppedNoUrl, 0);
  const displaced = imported.reduce((sum, outcome) => sum + outcome.displaced, 0);

  const gaps = [];
  if (skippedParseRows > 0) gaps.push(`共 ${skippedParseRows} 列解析失敗`);
  if (droppedNoUrl > 0) gaps.push(`共 ${droppedNoUrl} 筆缺少網址`);

  const failedNames = failed
    .slice(0, MAX_NAMED_BATCH_FAILURES)
    .map((outcome) => `${outcome.finalName}（${outcome.reason}）`)
    .join('、');
  const failedClause =
    failed.length > MAX_NAMED_BATCH_FAILURES
      ? `${failed.length} 個檔案失敗：${failedNames}、等 ${failed.length} 個檔案`
      : `${failed.length} 個檔案失敗：${failedNames}`;

  if (imported.length === 0) {
    return `${failed.length} 個檔案均匯入失敗：${failedNames}${
      failed.length > MAX_NAMED_BATCH_FAILURES ? `、等 ${failed.length} 個檔案` : ''
    }`;
  }

  let message = `已成功載入 ${imported.length} 個檔案（共 ${totalBookmarks} 筆書籤`;
  if (gaps.length > 0) message += `，${gaps.join('、')}已略過`;
  if (displaced > 0) message += `，${displaced} 筆已存在於回收桶的書籤已被新匯入資料取代`;
  message += '）';
  if (failed.length > 0) message += `；${failedClause}`;
  return message;
}

/** Marker property on the unsupported-extension error, read by the catch. */
const UNSUPPORTED_TYPE_FLAG = 'unsupportedFileType';

/** Marker property on the blocked-source (official Instapaper CSV) error. */
const UNSUPPORTED_SOURCE_FLAG = 'unsupportedSourceFile';

/** Marker property on the cache-write failure raised at the transaction boundary. */
const PERSIST_FAILED_FLAG = 'persistFailed';

/**
 * Marker property narrowing {@link PERSIST_FAILED_FLAG} to "another tab wrote
 * to the shared cache first". The import is rolled back either way, but the
 * user needs the real reason: re-importing keeps failing until they reload.
 *
 * The user-facing reason is the guard's shared `STALE_STATE_REASON`, so a
 * wording change in one place updates every conflict surface together.
 */
const CONFLICT_FLAG = 'cacheConflict';

/** Marker property when an overwrite file contains zero valid bookmark records. */
const EMPTY_OVERWRITE_FLAG = 'emptyOverwriteReplacement';

/** Marker property when the duplicate prompt cannot be shown or answered. */
const DUPLICATE_PROMPT_FLAG = 'duplicatePromptUnavailable';

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
function sanityCheckOrThrow(profile, ext, parsed, rows) {
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

/** Source types a source record may declare; mirrors the union documented in `state.js`. */
const SOURCE_FILE_TYPES = new Set(['csv', 'json', 'sqlite', 'db']);

/**
 * The source type a restored folder's own name implies, or `''` when the name
 * carries no supported extension.
 *
 * @param {string} name Restored source file name.
 * @returns {string}
 */
function typeFromSourceName(name) {
  const ext = String(name).split('.').pop().toLowerCase();
  return SOURCE_FILE_TYPES.has(ext) ? ext : '';
}

/**
 * Rebuild one source record per source a unified export was taken from.
 *
 * A unified export's rows carry the `source_file_id` that owned them, and a
 * version-2 envelope also carries a `sources` manifest. Handing the adapter the
 * RIGHT id per group is the whole mechanism: it stamps ownership from the id it
 * is given, so ownership is never rewritten after the fact and the adapter needs
 * no knowledge of this feature.
 *
 * Returns `null` when the rows name no source at all — an ordinary
 * single-source import, which must keep behaving exactly as before.
 *
 * @param {string} profile
 * @param {object[]} rows
 * @param {import('../core/state.js').SourceFileRecord} baseRecord
 * @param {object[]|null} manifest `sources` entries from a unified envelope.
 * @param {ReturnType<import('../providers/index.js').resolveImportAdapter>} adapter
 * @returns {{
 *   fileRecords: import('../core/state.js').SourceFileRecord[],
 *   records: import('../model/BookmarkRecord.js').BookmarkRecord[],
 *   stats: { droppedNoUrl: number },
 * }|null} Rebuilt sources and records, plus the URL-less-row count summed
 *   across the per-group adapter calls.
 */
function expandEnvelopeSources(profile, rows, baseRecord, manifest, adapter) {
  // Grouping is a unified-format semantic. Under any other profile the user has
  // explicitly asked for the file's own data, and those ids belong to the app.
  if (profile !== 'rll-unified') return null;

  const groups = new Map();
  for (const row of rows) {
    const key = row && row.source_file_id != null ? String(row.source_file_id) : '';
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  // Nothing names a source, or everything defers to the uploaded file: there is
  // no grouping to rebuild.
  if (groups.size === 0 || (groups.size === 1 && groups.has(''))) return null;

  const manifestById = new Map();
  for (const entry of manifest ?? []) {
    if (entry && entry.id != null) manifestById.set(String(entry.id), entry);
  }

  const fileRecords = [];
  const records = [];
  let droppedNoUrl = 0;
  for (const [originalId, groupRows] of groups) {
    // Rows that name no source belong to the uploaded file itself, which is
    // exactly what a single-source import would have done with them.
    if (!originalId) {
      fileRecords.push(baseRecord);
      const adapted = adapter.importJsonOrCsv(groupRows, baseRecord.id, baseRecord.name);
      records.push(...adapted.records);
      droppedNoUrl += adapted.stats.droppedNoUrl;
      continue;
    }

    const entry = manifestById.get(originalId);
    const named = groupRows.find((row) => row && row.source_file_name);
    // Prefer the manifest's name; fall back to the rows' own, so a hand-edited
    // or older export still restores a sensibly named folder.
    const name = (entry && entry.name) || (named && named.source_file_name) || baseRecord.name;

    // "Already loaded" is evaluated here, i.e. AFTER any overwrite purge the
    // caller performs before staging, so a source the user just chose to replace
    // is correctly treated as absent and rebuilt rather than merged into a record
    // that is about to be deleted.
    const existing = state.sourceFiles.get(originalId);
    if (existing) {
      // Reuse the record as it stands: overwriting it would discard the payload
      // and layout this source was loaded with, and the incoming rows merge into
      // that folder either way.
      //
      // The rows are stamped with the folder's OWN name, not the manifest's, so a
      // stale or hand-edited manifest cannot relabel records underneath a source
      // the user still sees under a different name. A record loaded without a
      // usable name falls back rather than stamping the rows with undefined.
      const inherited = adapter.importJsonOrCsv(groupRows, originalId, existing.name || name);
      records.push(...inherited.records);
      droppedNoUrl += inherited.stats.droppedNoUrl;
      continue;
    }

    fileRecords.push({
      ...baseRecord,
      id: originalId,
      name,
      // The manifest's `type` selects the writer save-back uses, so it is
      // whitelisted rather than trusted: an unrecognized value matches neither
      // branch in `saveSingleFile`, which would make the save button a silent
      // no-op. With no entry declaring one, the restored folder's OWN name is the
      // honest source — it is the original file's name, so its extension is the
      // original file's type. `baseRecord.type` is the ENVELOPE's extension, and
      // inheriting it would have every folder restored from a unified CSV save as
      // CSV under a `.json` or `.db` file name.
      type:
        (entry && SOURCE_FILE_TYPES.has(entry.type) && entry.type) ||
        typeFromSourceName(name) ||
        baseRecord.type,
      // An unrecognized manifest label falls back to the profile the user chose
      // for this import, not the global default: the restored source's export
      // columns key off the profile, and 'rll-unified' keeps them lossless.
      profile: normalizeProfileId(
        (entry && entry.profile) || baseRecord.profile,
        baseRecord.profile,
      ),
      // `csvColumns` / `sqliteSchema` describe the UPLOADED file's layout, not
      // this source's own, so the spread must not carry them over. Inherited,
      // every restored folder would re-emit the unified export's header row —
      // reintroducing exactly the "this looks like a Read Later Lens export"
      // mismatch that per-source layout capture exists to prevent. Cleared, the
      // exporter falls back to the profile's own columns, which is the closest
      // honest description available: a manifest records WHICH sources an export
      // came from, never what shape they had.
      csvColumns: null,
      // Same reasoning: the envelope's dialect describes the uploaded export, not
      // this source's own file, so a rebuilt folder falls back to RFC 4180 rather
      // than inheriting whichever dialect the export happened to be written in.
      csvDialect: null,
      sqliteSchema: null,
      // A restored folder has no file of its own behind it — the envelope was.
      // Referencing the same payload from every reconstructed source would also
      // store one copy of it N times.
      originalData: null,
      fileHandle: null,
    });
    const adapted = adapter.importJsonOrCsv(groupRows, originalId, name);
    records.push(...adapted.records);
    droppedNoUrl += adapted.stats.droppedNoUrl;
  }

  return { fileRecords, records, stats: { droppedNoUrl } };
}

/**
 * Prepare a single uploaded file by parsing, validating and normalizing it
 * into a staging result without mutating global application state.
 *
 * @param {File} file
 * @param {string} finalName
 * @param {string} profile Import profile id chosen in the source picker.
 * @param {FileSystemFileHandle|null} [fileHandle] Writable handle for this
 *   file, when it was imported through the File System Access picker. null for
 *   the `<input type="file">` path, whose File object has no createWritable().
 * @returns {Promise<{
 *   fileRecords: import('../core/state.js').SourceFileRecord[],
 *   records: import('../model/BookmarkRecord.js').BookmarkRecord[],
 *   count: number,
 *   skipped: number,
 *   droppedNoUrl: number,
 *   checkNote: string,
 * }>}
 */
async function prepareSingleFile(file, finalName, profile, fileHandle = null) {
  const fileId = newFileId();
  const ext = finalName.split('.').pop().toLowerCase();

  const fileRecord = {
    id: fileId,
    name: finalName,
    type: ext,
    profile,
    originalData: null,
    // The handle is what save-back writes through. Only the File System Access
    // picker yields a real one: an `<input type="file">` File is read-only and
    // has no createWritable(), so recording it here would look like save-back
    // support that could never run.
    fileHandle,
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
 * Capture a complete snapshot of in-memory state that an import or overwrite
 * could mutate, so failed writes or rollbacks can rewind deterministically.
 */
function captureImportSnapshot() {
  return {
    sourceFiles: new Map(state.sourceFiles),
    bookmarks: [...state.bookmarks],
    selectedIds: new Set(state.selectedIds),
    activeFolder: state.activeFolder,
  };
}

/**
 * Restore in-memory state exactly to a previously captured snapshot.
 *
 * @param {ReturnType<typeof captureImportSnapshot>} snapshot
 */
function restoreImportSnapshot(snapshot) {
  state.setSourceFiles(new Map(snapshot.sourceFiles));
  state.setBookmarks([...snapshot.bookmarks]);
  state.setSelectedIds(new Set(snapshot.selectedIds));
  state.setActiveFolder(snapshot.activeFolder);
}

/**
 * Process a single uploaded file, parsing it and updating state.
 *
 * Transaction shape: parse & validate into staging → commit to working set →
 * persist. Overwrite purges the previous source and its active/trashed
 * bookmarks in the SAME transaction, so a malformed or empty replacement leaves
 * the previous source intact.
 *
 * @param {File} file
 * @param {string} finalName
 * @param {string} profile Import profile id chosen in the source picker.
 * @param {object} [options]
 * @param {string|null} [options.replaceSourceId] Replaced source id when overwriting.
 * @param {FileSystemFileHandle|null} [options.fileHandle] Writable handle
 *   backing this file, when the File System Access picker supplied one.
 * @returns {Promise<object>} The per-file outcome for the batch summary:
 *   `{ status: 'imported', ... }` (message + counts) or
 *   `{ status: 'failed', finalName, message, reason }`. A handled failure
 *   (parse error, empty overwrite, cache-write failure) rolls itself back and
 *   resolves a failure outcome — it never throws past this function. Outcomes
 *   are reported, never toasted, because the caller's single toast element
 *   keeps only the last message a batch emits.
 */
async function processSingleFile(file, finalName, profile, options = {}) {
  const { replaceSourceId = null, fileHandle = null } = options;
  const ext = finalName.split('.').pop().toLowerCase();
  const snapshot = captureImportSnapshot();

  try {
    // The overwrite purge runs BEFORE staging, not after it.
    //
    // Staging asks the live working set which source ids are already loaded, to
    // decide what to reconstruct versus what to merge into. A purge that ran
    // afterwards would therefore be invisible to the very decision it is about to
    // invalidate: the group naming the doomed source would be merged rather than
    // rebuilt, and the purge would then delete the folder those records had just
    // been attached to — orphaning every one of them, with a success toast.
    //
    // The empty-overwrite guard below still keeps the source safe: it throws, and
    // the catch restores this same snapshot, so a replacement with no valid
    // bookmarks leaves the original exactly as it was.
    if (replaceSourceId) {
      const doomedIds = state.bookmarks
        .filter((b) => b.source_file_id === replaceSourceId)
        .map((b) => b.id);
      const doomedSet = new Set(doomedIds);
      state.sourceFiles.delete(replaceSourceId);
      state.purgeBookmarks(doomedIds);
      state.setSelectedIds(new Set([...state.selectedIds].filter((id) => !doomedSet.has(id))));
      if (state.activeFolder === replaceSourceId) {
        state.setActiveFolder('ALL');
      }
    }

    const prepared = await prepareSingleFile(file, finalName, profile, fileHandle);

    // Overwrite safety: an overwrite choice replaces data, but must never
    // destroy an existing source for an empty file (0 valid bookmarks).
    if (replaceSourceId && prepared.count === 0) {
      const err = new Error('新檔案未匯入任何有效書籤，已保留原來源檔案');
      err[EMPTY_OVERWRITE_FLAG] = true;
      throw err;
    }

    // Register the source record(s) and merged bookmarks into the live working
    // set, then cross the transaction boundary with storage. A unified export
    // can expand into several sources, and all of them land in this one
    // transaction — a failure rolls the whole expansion back together.
    for (const record of prepared.fileRecords) state.sourceFiles.set(record.id, record);
    const merge = acceptRecords(prepared.records);

    const saved = await persistWorkingSet();
    if (!saved.persisted) {
      // The conflict names itself with the guard's shared reason; a plain
      // write failure keeps its own wording.
      const reason = saved.conflict ? STALE_STATE_REASON : '無法寫入本機快取';
      const err = new Error(reason);
      err[PERSIST_FAILED_FLAG] = true;
      if (saved.conflict) err[CONFLICT_FLAG] = true;
      throw err;
    }

    const message = buildImportedMessage(
      finalName,
      merge.displaced,
      prepared.count,
      prepared.skipped,
      prepared.droppedNoUrl,
      prepared.checkNote,
    );
    return {
      status: 'imported',
      finalName,
      message,
      count: prepared.count,
      skipped: prepared.skipped,
      droppedNoUrl: prepared.droppedNoUrl,
      displaced: merge.displaced,
    };
  } catch (err) {
    restoreImportSnapshot(snapshot);
    try {
      deps.render?.();
    } catch (renderErr) {
      console.warn('Rollback render failed:', renderErr);
    }

    if (err[EMPTY_OVERWRITE_FLAG]) {
      return { status: 'failed', finalName, message: err.message, reason: '未匯入任何有效書籤' };
    }

    console.error(`解析檔案 ${finalName} 失敗:`, err);
    if (err[PERSIST_FAILED_FLAG]) {
      if (err[CONFLICT_FLAG]) {
        return {
          status: 'failed',
          finalName,
          message: `已還原匯入 ${finalName}：${STALE_STATE_REASON}，資料不會保留，請重新載入後再試`,
          reason: STALE_STATE_REASON,
        };
      }
      return {
        status: 'failed',
        finalName,
        message: `已還原匯入 ${finalName}：無法寫入本機快取，資料不會保留`,
        reason: '無法寫入本機快取',
      };
    }
    if (err[UNSUPPORTED_TYPE_FLAG]) {
      return {
        status: 'failed',
        finalName,
        message: `不支援的檔案格式「.${ext}」，請上傳 CSV、JSON 或 SQLite 檔案`,
        reason: '格式不支援',
      };
    }
    if (err[UNSUPPORTED_SOURCE_FLAG]) {
      return { status: 'failed', finalName, message: err.message, reason: '來源檔案不受支援' };
    }
    return {
      status: 'failed',
      finalName,
      message: `解析檔案 ${finalName} 失敗，請確認格式`,
      reason: '解析失敗',
    };
  }
}

/**
 * Merge new records into global state and report what the merge did.
 *
 * Before merging, count how many trashed records the incoming data displaces:
 * mergeBookmarks() is "incoming wins", so a re-import always overwrites a
 * trashed record with the fresh one (the item silently returns to the active
 * list). The count is RETURNED instead of parked in a module global — an
 * out-of-band channel lets a late callback overwrite another file's number and
 * so report the wrong trash count in the toast.
 *
 * Persisting is deliberately NOT part of this function: the merge is only one
 * half of the import transaction, and the caller closes it once the whole file
 * has been parsed (see persistWorkingSet). Rollback does not need an undo
 * record from here — processSingleFile() restores a full snapshot captured
 * before parsing, so a failed write rewinds the purge and the merge together.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} newBookmarks
 * @returns {{displaced: number}} `displaced`: trashed records this batch resurrected.
 */
function acceptRecords(newBookmarks) {
  const incomingIds = new Set(newBookmarks.map((b) => b.id));
  const displaced = state.bookmarks.filter((b) => b.deleted_at && incomingIds.has(b.id)).length;
  state.mergeBookmarks(newBookmarks);
  return { displaced };
}

/**
 * Cross the import transaction boundary: hand the merged working set to storage
 * by AWAITING deps.persistAndRender().
 *
 * The promise is awaited rather than floated, so a failed write is observable
 * and the merged records can be rolled back. A persistAndRender stub that
 * returns nothing counts as committed (the legacy fire-and-forget contract,
 * still used by other callers); the real one reports `{persisted, rendered,
 * conflict}`. A conflict — another tab wrote between this tab's baseline and
 * the save — is reported distinctly so the failure says WHY instead of blaming
 * the cache.
 *
 * @returns {Promise<{persisted: boolean, rendered: boolean, conflict: boolean}>}
 *   Whether the working set reached storage, whether the view was refreshed
 *   from it, and whether storage refused the write because another tab changed
 *   it. The legacy contract reports `rendered: false`: a stub that says nothing
 *   proves nothing, so callers that must show fresh state re-render themselves.
 */
async function persistWorkingSet() {
  const result = await deps.persistAndRender?.();
  if (result && typeof result === 'object') {
    return {
      persisted: result.persisted !== false,
      rendered: result.rendered !== false,
      conflict: result.conflict === true,
    };
  }
  return { persisted: result !== false, rendered: false, conflict: false };
}

/**
 * Rewind a whole batch after an unexpected failure and re-sync the cache.
 *
 * The rewrite matters as much as the restore: every file the batch already
 * committed was individually persisted, so restoring only memory would leave a
 * cache the session's view no longer matches (a reload would resurrect the
 * files this rollback just removed). When the rewrite itself fails the toast
 * says so instead of claiming a clean restore.
 *
 * @param {ReturnType<typeof captureImportSnapshot>} snapshot Taken before the batch.
 * @param {string} fileName The file whose handling failed.
 * @returns {Promise<void>}
 */
async function rollbackBatch(snapshot, fileName) {
  restoreImportSnapshot(snapshot);

  let status = { persisted: false, rendered: false };
  try {
    status = await persistWorkingSet();
  } catch (err) {
    console.warn('Batch rollback write failed:', err);
  }

  if (!status.rendered) {
    try {
      deps.render?.();
    } catch (renderErr) {
      console.warn('Rollback render failed:', renderErr);
    }
  }

  showToast(
    status.persisted
      ? `匯入「${fileName}」時發生錯誤，已還原本次匯入的全部檔案`
      : `匯入「${fileName}」時發生錯誤，且無法還原快取；重新載入後可能仍會看到部分匯入結果`,
  );
}

/**
 * Entry point for handling multiple file uploads.
 * @param {File[]} files
 * @param {object} [options]
 * @param {string} [options.profile] Source profile chosen in the picker
 *   (defaults to the session selection — InstapaperScraper unless changed).
 *   Unknown ids coerce to the default before anything is stamped or checked.
 * @param {(FileSystemFileHandle|null)[]} [options.fileHandles] Writable handles
 *   parallel to `files`, from the File System Access picker. A shorter or absent
 *   list simply means those files have no handle, which is the `<input
 *   type="file">` path's normal state — so a mismatch degrades to "no handle"
 *   rather than pairing a file with someone else's handle.
 */
export async function handleFileUploads(files, options = {}) {
  try {
    const profile = normalizeProfileId(options.profile ?? selectedProfileId);
    const pending = [...files];
    const fileHandles = Array.isArray(options.fileHandles) ? options.fileHandles : [];

    // Fail-closed preflight: the duplicate prompt is the only interaction a
    // batch may need, and its absence is knowable BEFORE any state is mutated.
    // Refusing here keeps "no partial import" true by construction instead of
    // aborting halfway through this loop, which used to abandon the remaining
    // files behind a single generic toast.
    const collisions = pending.filter((file) => findDuplicateSourceId(file.name));
    if (collisions.length > 0 && !duplicatePromptReady()) {
      const names = collisions.map((file) => file.name).join('、');
      console.error('檔案匯入中止：無法顯示同名檔案的處理選項:', names);
      showToast(promptUnavailableMessage(names));
      return;
    }

    // Batch atomicity: a failure a file could not handle itself (an escape from
    // the prompt, the duplicate scan or the merge) rewinds every file this batch
    // committed, so the batch lands all-or-nothing instead of half-imported.
    // Failures processSingleFile reports and rolls back itself — parse errors,
    // empty overwrites, cache-write failures — do not trigger this: they are
    // reported per file and the batch carries on.
    const batchSnapshot = captureImportSnapshot();
    let committed = 0;
    // Per-file outcomes for the one toast this batch emits. processSingleFile
    // reports rather than toasts: the single `#toastMsg` element is
    // last-write-wins, so toasting per file would leave only the last file's
    // result visible. Deferred outcomes are discarded on rollback, so the
    // batch never claims a success it then rewound.
    const outcomes = [];

    for (const [index, file] of pending.entries()) {
      const fileName = file.name;
      // Indexed by position, so a file keeps its own handle whichever way the
      // duplicate prompt resolves.
      const fileHandle = fileHandles[index] ?? null;
      try {
        const duplicateId = findDuplicateSourceId(fileName);
        let outcome = null;

        if (!duplicateId) {
          outcome = await processSingleFile(file, fileName, profile, { fileHandle });
        } else {
          // Ask only with the body text in place: without it the user would pick
          // an action without seeing which file it affects.
          if (!showDuplicatePrompt(fileName)) {
            const err = new Error(promptUnavailableMessage(fileName));
            err[DUPLICATE_PROMPT_FLAG] = true;
            throw err;
          }
          const action = await waitForDuplicateResolution();
          if (action === 'overwrite') {
            outcome = await processSingleFile(file, fileName, profile, {
              replaceSourceId: duplicateId,
              fileHandle,
            });
          } else if (action === 'keep') {
            const existingNames = [...state.sourceFiles.values()].map((source) => source.name);
            const newName = createUniqueSourceName(fileName, existingNames);
            outcome = await processSingleFile(file, newName, profile, { fileHandle });
          }
          // 'cancel' imports nothing and reports nothing: that is the user's call.
        }

        if (outcome) {
          outcomes.push(outcome);
          if (outcome.status === 'imported') committed += 1;
        }
      } catch (err) {
        console.error(`檔案匯入失敗 (${fileName}):`, err);
        if (committed > 0) {
          await rollbackBatch(batchSnapshot, fileName);
        } else {
          showToast(err[DUPLICATE_PROMPT_FLAG] ? err.message : '檔案匯入失敗，請稍後再試');
        }
        // Unexpected failures are fail-closed for the rest of the batch: nothing
        // after this point is attempted behind a toast nobody can act on.
        return;
      }
    }

    if (outcomes.length === 1) {
      // Single-file imports keep the verbatim per-file message; the summary
      // only exists for batches.
      showToast(outcomes[0].message);
    } else if (outcomes.length > 1) {
      showToast(buildBatchSummary(outcomes));
    }
    // Zero outcomes means every file was user-cancelled: report nothing.
  } catch (err) {
    console.error('檔案匯入失敗:', err);
    showToast(err[DUPLICATE_PROMPT_FLAG] ? err.message : '檔案匯入失敗，請稍後再試');
  }
}

/**
 * File types offered by the File System Access picker.
 *
 * Extensions are declared alongside MIME types because Chromium matches on both,
 * and the SQLite family in particular arrives under several different MIME
 * types depending on the platform that wrote it.
 */
const PICKER_TYPES = [
  { description: 'CSV', accept: { 'text/csv': ['.csv'] } },
  { description: 'JSON', accept: { 'application/json': ['.json'] } },
  {
    description: 'SQLite',
    accept: {
      'application/vnd.sqlite3': ['.db', '.sqlite'],
      'application/x-sqlite3': ['.db', '.sqlite'],
      'application/octet-stream': ['.db', '.sqlite'],
    },
  },
];

/**
 * Open the File System Access picker and import what it returns, keeping each
 * file's writable handle so save-back can overwrite the original in place.
 *
 * Returns false when the browser has no picker, so the caller can fall back to
 * the hidden `<input type="file">` — the only path in Firefox and Safari, where
 * the File objects carry no handle and save-back degrades to Save-As.
 *
 * Must be called directly from the button's click handler: the picker requires
 * transient user activation, which is gone once awaited through an event hop.
 *
 * @returns {Promise<boolean>} Whether the picker path ran (false = fall back).
 */
async function pickFilesWithHandles() {
  if (!('showOpenFilePicker' in window)) return false;

  let handles;
  try {
    // readwrite is the point of using the picker at all: it is what lets
    // save-back write back to the same file instead of asking for a new one.
    handles = await window.showOpenFilePicker({
      multiple: true,
      types: PICKER_TYPES,
      excludeAcceptAllOption: false,
      mode: 'readwrite',
    });
  } catch (err) {
    // A cancelled picker is the user's decision, not a failure: say nothing and
    // leave the modal open so they can pick again.
    if (err.name === 'AbortError') return true;
    console.warn('File System Access picker failed, falling back to file input:', err);
    return false;
  }

  try {
    const entries = await Promise.all(
      handles.map(async (handle) => ({ file: await handle.getFile(), handle })),
    );
    if (entries.length === 0) return true;
    // Close before parsing so the duplicate-name prompt never stacks beneath
    // the source picker (the duplicate modal stays outside the layer stack).
    closeImportModal();
    await handleFileUploads(
      entries.map((e) => e.file),
      { profile: selectedProfileId, fileHandles: entries.map((e) => e.handle) },
    );
  } catch (err) {
    console.error('檔案匯入失敗:', err);
    showToast('檔案匯入失敗，請稍後再試');
  }
  return true;
}

/**
 * Register DOM listeners for the header import button, the source picker
 * modal, and the hidden file input.
 */
export function registerImporterListeners() {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput) return;

  // Header 匯入 button opens the source picker instead of the raw file dialog.
  document.getElementById('importBtn')?.addEventListener('click', openImportModal);
  document.getElementById('closeImportBtn')?.addEventListener('click', closeImportModal);
  document.getElementById('importCancelBtn')?.addEventListener('click', closeImportModal);
  document.getElementById('importPickFileBtn')?.addEventListener('click', async () => {
    if (!(await pickFilesWithHandles())) fileInput.click();
  });

  // Source cards: click selection + arrow-key navigation within the radiogroup.
  for (const profile of selectableProfiles()) {
    cardEl(profile.id)?.addEventListener('click', () => applyProfileSelection(profile.id));
  }
  document.getElementById('importSourceGroup')?.addEventListener('keydown', handleProfileKeydown);

  // Backdrop click closes (clicks inside the panel bubble with another target).
  const overlay = document.getElementById('importModal');
  overlay?.addEventListener('click', (event) => {
    if (event.target === overlay) closeImportModal();
  });

  fileInput.addEventListener('change', async (e) => {
    try {
      const files = e.target.files ? Array.from(e.target.files) : [];
      // A change event never fires when the same path is re-selected, so clear
      // the value once the FileList is captured.
      e.target.value = '';
      if (files.length === 0) return;
      // Close the picker BEFORE parsing so the duplicate-name prompt never
      // stacks beneath it (the duplicate modal stays outside the layer stack).
      closeImportModal();
      await handleFileUploads(files, { profile: selectedProfileId });
    } catch (err) {
      console.error('檔案匯入失敗:', err);
      showToast('檔案匯入失敗，請稍後再試');
    }
  });
}
