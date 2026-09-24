/**
 * @fileoverview Lazy loader for the locally bundled SQL.js engine.
 * Ensures the SQL.js engine is initialized once and cached in state.
 */

import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { setSQL, SQL } from '../core/state.js';

/** @type {Promise<object>|null} Shared while initialization is in flight. */
let sqlInitPromise = null;

/**
 * Initializes SQL.js if not already present in state.
 * The module and WASM are bundled by Vite and resolved only when this is called.
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
        // `state.SQL` caches the completed engine; this promise only coalesces
        // concurrent initialization. Clearing it also allows a later retry.
        sqlInitPromise = null;
      });
  }

  return sqlInitPromise;
}
