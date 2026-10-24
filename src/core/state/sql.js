/** @type {import('sql.js').initSqlJs.SqlJsStatic | null} */
export let SQL = null;
export function setSQL(v) {
  SQL = v;
}
