/**
 * @fileoverview SQLite DDL builders for `.db` save-back — pure, DOM-free.
 *
 * Extracted from src/io/exporter.js when the exporter split into src/io/export/*.
 */

/**
 * Escape an identifier for use inside a double-quoted SQLite name by doubling
 * any embedded quote — the same rule the read path uses, so a table or column
 * named maliciously cannot inject DDL into the file we emit.
 *
 * @param {string} name
 * @returns {string}
 */
export function quoteSqliteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/**
 * Build the `CREATE TABLE` statement reproducing a source's own layout.
 *
 * Columns are declared TEXT: the app stores every field as a string, and the
 * original declared types are not part of the recorded schema.
 *
 * @param {{table: string, columns: string[]}} schema
 * @returns {string}
 */
export function createTableSql(schema) {
  const cols = schema.columns.map((c) => `${quoteSqliteIdentifier(c)} TEXT`).join(', ');
  return `CREATE TABLE ${quoteSqliteIdentifier(schema.table)} (${cols});`;
}
