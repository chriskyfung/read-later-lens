/**
 * @fileoverview Lazy loader for SQL.js via CDN.
 * Ensures the SQL.js engine is initialized once and cached in state.
 */

import { setSQL, SQL } from '../core/state.js';

/**
 * Initializes SQL.js if not already present in state.
 * Uses the CDN global `initSqlJs` provided by the script tag in index.html.
 */
export async function initSql() {
  if (!SQL) {
    // The global initSqlJs is provided by the <script> tag in index.html
    // https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js
    const sqlEngine = await window.initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
    setSQL(sqlEngine);
  }
  return SQL;
}
