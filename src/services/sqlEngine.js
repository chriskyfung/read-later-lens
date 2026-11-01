/**
 * @fileoverview Lazy loader and state holder for the locally bundled SQL.js engine.
 *
 * The SQL.js engine instance is a third-party library singleton, not application
 * state (bookmarks/session/sources), so it lives under `src/services/` alongside
 * the other lazy-loaded services. This module owns both the engine instance
 * (`SQL` / `setSQL`) and the lazy initialization logic (`initSql`).
 */

import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

/** @type {import('sql.js').initSqlJs.SqlJsStatic | null} */
export let SQL = null;

/** @param {import('sql.js').initSqlJs.SqlJsStatic | null} v */
export function setSQL(v) {
  SQL = v;
}

/** @type {Promise<object>|null} Shared while initialization is in flight. */
let sqlInitPromise = null;

/**
 * Initializes SQL.js if not already present in state.
 *
 * The module and WASM are bundled by Vite and resolved only when this is called.
 * Idempotent: concurrent callers share one promise. A failed load clears the
 * promise so a later call can retry.
 *
 * @returns {Promise<import('sql.js').initSqlJs.SqlJsStatic>}
 */
export async function initSql() {
  if (SQL) return SQL;

  if (!sqlInitPromise) {
    sqlInitPromise = import('sql.js')
      .then(({ default: initSqlJs }) => initSqlJs({ locateFile: () => wasmUrl }))
      .then((sqlEngine) => {
        setSQL(sqlEngine);
        return sqlEngine;
      })
      .finally(() => {
        // `SQL` caches the completed engine; this promise only coalesces
        // concurrent initialization. Clearing it also allows a later retry.
        sqlInitPromise = null;
      });
  }

  return sqlInitPromise;
}
