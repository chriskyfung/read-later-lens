/**
 * @fileoverview CSV formula-injection hardening for exported cells.
 *
 * A CSV cell that begins with `=`, `+`, `-`, `@`, TAB or CR is executed as a
 * formula (or, in older Excel, a DDE command) when the file is opened. Every
 * field in a bookmark comes from an untrusted import, so a malicious export
 * can turn "click a title" into "run this on my machine".
 *
 * The fix belongs here, at the CSV boundary, and NOT on import: mutating the
 * stored records would corrupt the data and break JSON/SQLite round-trips
 * (see the escaping note in CONTRIBUTING.md). Only the copy handed to
 * `Papa.unparse` is prefixed, so the app's in-memory data stays byte-faithful.
 *
 * Deliberately not delegated to Papa's own `escapeFormulae` option, which every
 * version this app has shipped does implement: it only tests
 * `typeof str === 'string'`, so an array-valued field such as `tags` skips the
 * check entirely. `safe()` then does `str.toString()`, emitting
 * `tags: ['=SUM(1)']` as a bare `=SUM(1)` cell — a live formula the option
 * never saw. The character class is also pinned here, in `FORMULA_PREFIX`,
 * rather than inherited from a dependency version that can change under us.
 *
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 *
 * Re-exported by the public barrel src/utils/csv/index.js.
 */
/**
 * Leading characters that make spreadsheet software evaluate a cell.
 *
 * Written as an explicit character class rather than a copy of Papa's regex so
 * the behavior is pinned here and cannot drift with a library upgrade.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Prefix a single cell value with a quote so spreadsheets treat it as literal text.
 *
 * A leading apostrophe is the de-facto CSV convention (OWASP): Excel, LibreOffice
 * and Google Sheets all render the cell as text and strip the marker on display.
 * Values that are already inert — plain text, numbers, booleans, `null`,
 * `undefined`, and strings already starting with an apostrophe — are returned
 * untouched, so a safe export is bit-for-bit identical to a pre-fix export.
 *
 * Arrays (`tags`) are judged on the *joined* text PapaParse would emit, because
 * a spreadsheet evaluates one cell, not the comma-separated pieces inside it. A
 * cell reading `news,=1+1` starts with `n` and is displayed verbatim, so
 * hardening it would only corrupt the data on re-import (`'=1+1`) without
 * removing any real attack surface. Joining is done with the same coercion
 * `String(value)` that `Papa.unparse` applies, so the decision and the emitted
 * text can never disagree.
 *
 * @param {unknown} value
 * @returns {unknown} The original value, or a quoted string.
 */
export function hardenCsvValue(value) {
  if (value === null || value === undefined) return value;

  // Match PapaParse's own stringification: scalars as-is, arrays comma-joined.
  const text = Array.isArray(value) ? value.toString() : value;
  if (typeof text !== 'string') return value;

  return FORMULA_PREFIX.test(text) ? `'${text}` : value;
}

/**
 * Harden one record's fields for CSV serialization.
 *
 * Cloned rather than mutated: `state.bookmarks` is shared with the views, the
 * search index and the JSON/SQLite exporters, and hardening must never leak
 * outside the CSV boundary. Only the string returned for a hardened cell differs;
 * every other value keeps its original type for `Papa.unparse`.
 *
 * The clone has a null prototype so that it carries exactly the keys it was
 * given. A source file's column names are attacker-influenceable, and on a plain
 * `{}` the `__proto__` one would hit the inherited accessor instead of becoming
 * a key — a clone that quietly drops a field is not a clone, and the column
 * would vanish from the user's own header row at the last step before writing.
 *
 * @param {Record<string, unknown>} record
 * @returns {Record<string, unknown>} A hardened shallow clone.
 */
export function hardenRecordForCsv(record) {
  const hardened = Object.create(null);
  for (const [key, value] of Object.entries(record)) {
    hardened[key] = hardenCsvValue(value);
  }
  return hardened;
}

/**
 * Harden a whole page of records for `Papa.unparse`.
 *
 * @param {Record<string, unknown>[]} records
 * @returns {Record<string, unknown>[]}
 */
export function hardenRecordsForCsv(records) {
  return records.map(hardenRecordForCsv);
}
