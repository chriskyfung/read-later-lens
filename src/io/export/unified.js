/**
 * @fileoverview Unified whole-library exports (trash excluded).
 *
 * Extracted from src/io/exporter.js when the exporter split into src/io/export/*.
 */

import * as state from '../../core/state';
import { getActiveBookmarks } from '../../core/filters.js';
import { downloadBlob } from '../../utils/download.js';
import { csvUnparseConfig, hardenRecordsForCsv } from '../../utils/csv.js';
import Papa from 'papaparse';

/**
 * Exports all current bookmarks to a versioned unified JSON file (trash
 * excluded). The envelope (`format` + `version`) gives re-imports an exact
 * fingerprint instead of a column guess, and the `sources` manifest records
 * which source owned each group of bookmarks — without it the per-source
 * structure is unrecoverable and a re-import collapses every folder into one.
 *
 * Only sources that actually own an exported record are listed: a source whose
 * bookmarks are all in the trash would otherwise restore as an empty folder.
 */
export function exportAllUnifiedJson() {
  const bookmarks = getActiveBookmarks();
  const exportedSourceIds = new Set(bookmarks.map((b) => b.source_file_id));
  const envelope = {
    format: 'read-later-lens',
    version: 2,
    sources: [...state.sourceFiles.values()]
      .filter((file) => exportedSourceIds.has(file.id))
      .map((file) => ({ id: file.id, name: file.name, type: file.type, profile: file.profile })),
    bookmarks,
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, 'all_bookmarks_export.json');
}

/**
 * Exports all current bookmarks to a unified CSV file (trash excluded).
 */
export function exportAllUnifiedCsv() {
  // RFC 4180, stated rather than omitted. This export spans every source, so
  // there is no single dialect to reproduce — reproducing one source's delimiter
  // would be wrong for all the others. `csvUnparseConfig(null)` is how that
  // decision is expressed; see the architecture note in CONTRIBUTING.md.
  const csv = Papa.unparse(hardenRecordsForCsv(getActiveBookmarks()), csvUnparseConfig(null));
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'all_bookmarks_export.csv');
}
