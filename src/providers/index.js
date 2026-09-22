/**
 * @fileoverview Provider registry — maps import cues to adapter functions.
 *
 * The app calls through this registry rather than importing provider dirs
 * directly. Currently only Instapaper is supported (the original monolith's
 * single-provider scope); the registry is intentionally thin so a future
 * provider is a drop-in adapter rather than a branch of inline code.
 */

import {
  importFromJsonOrCsv as importInstapaperFromJsonOrCsv,
  importFromSqlite as importInstapaperFromSqlite,
} from './instapaper/import.js';

/**
 * @param {string[]|Record[]} rawRows
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 */
export function importJsonOrCsv(rawRows, sourceFileId, sourceFileName) {
  return importInstapaperFromJsonOrCsv(rawRows, sourceFileId, sourceFileName);
}

/**
 * @param {Uint8Array} wasmBuffer
 * @param {string} sourceFileId
 * @param {string} sourceFileName
 * @param {import('sql.js').initSqlJs.SqlJsStatic} SQL
 */
export async function importSqlite(wasmBuffer, sourceFileId, sourceFileName, SQL) {
  return importInstapaperFromSqlite(wasmBuffer, sourceFileId, sourceFileName, SQL);
}

/**
 * Resolve a provider slug from a file extension. Currently every supported ext
 * maps to Instapaper; kept as a single function so it never silently routes to
 * a half-built second provider.
 *
 * @param {string} _ext  Lowercase extension without dot, e.g. 'csv'.
 * @returns {'instapaper'}
 */
export function providerForExtension(_ext) {
  return 'instapaper';
}
