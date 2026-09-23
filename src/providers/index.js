/**
 * @fileoverview Provider registry — maps import profiles to adapter functions.
 *
 * The app calls through this registry rather than importing provider dirs
 * directly. Currently only Instapaper is supported (the original monolith's
 * single-provider scope); the registry is intentionally thin so a future
 * provider is a drop-in adapter rather than a branch of inline code.
 *
 * Profile routing today only toggles metadata preservation: the unified
 * Read Later Lens profile round-trips `provider` / `instapaper_url` from the
 * source record instead of forcing Instapaper values. Row parsing itself stays
 * in the shared alias-tolerant normalizer.
 */

import {
  importFromJsonOrCsv as importInstapaperFromJsonOrCsv,
  importFromSqlite as importInstapaperFromSqlite,
} from './instapaper/import.js';

/** Options passed to the Instapaper adapters for each profile. */
const ADAPTER_OPTIONS = {
  'instapaper-scraper': { preserveMeta: false },
  'rll-unified': { preserveMeta: true },
};

/**
 * Resolve the adapter pair for a source profile. Unknown ids fall back to the
 * default (InstapaperScraper) behaviour so a stale persisted profile can never
 * break an import.
 *
 * @param {string} profileId
 * @returns {{
 *   importJsonOrCsv: (rows: object[], sourceFileId: string, sourceFileName: string) => import('../model/BookmarkRecord.js').BookmarkRecord[],
 *   importSqlite: (wasmBuffer: Uint8Array, sourceFileId: string, sourceFileName: string, SQL: import('sql.js').initSqlJs.SqlJsStatic) => Promise<import('../model/BookmarkRecord.js').BookmarkRecord[]>,
 * }}
 */
export function resolveImportAdapter(profileId) {
  const options = ADAPTER_OPTIONS[profileId] ?? ADAPTER_OPTIONS['instapaper-scraper'];
  return {
    importJsonOrCsv: (rows, sourceFileId, sourceFileName) =>
      importInstapaperFromJsonOrCsv(rows, sourceFileId, sourceFileName, options),
    importSqlite: (wasmBuffer, sourceFileId, sourceFileName, SQL) =>
      importInstapaperFromSqlite(wasmBuffer, sourceFileId, sourceFileName, SQL, options),
  };
}

/**
 * Default-profile shortcut kept for direct callers/tests.
 * @param {string[]|Record[]} rawRows
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 */
export function importJsonOrCsv(rawRows, sourceFileId, sourceFileName) {
  return resolveImportAdapter('instapaper-scraper').importJsonOrCsv(
    rawRows,
    sourceFileId,
    sourceFileName,
  );
}

/**
 * Default-profile shortcut kept for direct callers/tests.
 * @param {Uint8Array} wasmBuffer
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 * @param {import('sql.js').initSqlJs.SqlJsStatic} SQL
 */
export async function importSqlite(wasmBuffer, sourceFileId, sourceFileName, SQL) {
  return resolveImportAdapter('instapaper-scraper').importSqlite(
    wasmBuffer,
    sourceFileId,
    sourceFileName,
    SQL,
  );
}
