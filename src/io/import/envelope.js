/**
 * @fileoverview Unified-export envelope expansion.
 *
 * Extracted from src/io/importer.js. Rebuilds one source record per source a
 * unified export was taken from, so ownership is stamped from the id the
 * adapter is given and never rewritten after the fact. Pure given its inputs
 * (reads `state.sourceFiles` only to detect an already-loaded source).
 */

import * as state from '../../core/state';
import { normalizeProfileId } from '../../providers/profiles.js';

/** Source types a source record may declare; mirrors the union documented in `state`. */
export const SOURCE_FILE_TYPES = new Set(['csv', 'json', 'sqlite', 'db']);

/**
 * The source type a restored folder's own name implies, or `''` when the name
 * carries no supported extension.
 *
 * @param {string} name Restored source file name.
 * @returns {string}
 */
export function typeFromSourceName(name) {
  const ext = String(name).split('.').pop().toLowerCase();
  return SOURCE_FILE_TYPES.has(ext) ? ext : '';
}

/**
 * Rebuild one source record per source a unified export was taken from.
 *
 * A unified export's rows carry the `source_file_id` that owned them, and a
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
    });
    const adapted = adapter.importJsonOrCsv(groupRows, originalId, name);
    records.push(...adapted.records);
    droppedNoUrl += adapted.stats.droppedNoUrl;
  }

  return { fileRecords, records, stats: { droppedNoUrl } };
}

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
 * @param {import('../core/state').SourceFileRecord} baseRecord
 * @param {object[]|null} manifest `sources` entries from a unified envelope.
 * @param {ReturnType<import('../providers/index.js').resolveImportAdapter>} adapter
 * @returns {{
 *   fileRecords: import('../core/state').SourceFileRecord[],
 *   records: import('../model/BookmarkRecord.js').BookmarkRecord[],
 *   stats: { droppedNoUrl: number },
 * }|null} Rebuilt sources and records, plus the URL-less-row count summed
 *   across the per-group adapter calls.
 */
export function expandEnvelopeSources(profile, rows, baseRecord, manifest, adapter) {
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
    });
    const adapted = adapter.importJsonOrCsv(groupRows, originalId, name);
    records.push(...adapted.records);
    droppedNoUrl += adapted.stats.droppedNoUrl;
  }

  return { fileRecords, records, stats: { droppedNoUrl } };
}

let droppedNoUrl = 0;
