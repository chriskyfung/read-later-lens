/**
 * @fileoverview Source-column projection — pure, DOM-free, state-free.
 *
 * Extracted from src/io/exporter.js when the exporter split into src/io/export/*.
 * Shared by the CSV, JSON and .db save-back paths, which all owe the user the
 * same thing: the source's own layout rather than the app's internal schema.
 */

/**
 * Columns the app can fill when re-emitting a source, mapped from the source
 * column name to the bookmark field that supplies its value.
 *
 * Anything not listed here is written empty and counted, so an unexpected
 * column is announced rather than silently dropped. `tags` is joined with a
 * comma because that is exactly what `normalizeTags` splits on, which makes the
 * round trip lossless.
 */
const SOURCE_COLUMN_VALUES = {
  id: (b) => b.id,
  title: (b) => b.title,
  url: (b) => b.url,
  preview: (b) => b.article_preview,
  article_preview: (b) => b.article_preview,
  content: (b) => b.content,
  tags: (b) => (Array.isArray(b.tags) ? b.tags.join(',') : (b.tags ?? null)),
  instapaper_url: (b) => b.instapaper_url,
  provider: (b) => b.provider,
  is_favorite: (b) => (b.is_favorite ? 1 : 0),
  favorite: (b) => (b.is_favorite ? 1 : 0),
};

/**
 * Columns a scraper source is re-emitted with when its own headers were never
 * recorded (a JSON source, or one cached by a version that predates capture).
 *
 * These are exactly the fields the scraper adapter reads back
 * (`normalizeFields` + `normalizeTags`), so nothing is lost. What is omitted is
 * either app-internal (`source_file_id` / `source_file_name` /
 * `deleted_at`) or re-derivable: `detected_language` is a pure function of
 * title + preview, and `provider` / `instapaper_url` are rebuilt from the
 * provider slug and id. Emitting them would make the user's own file look like
 * a Read Later Lens export — which it is not.
 */
const SCRAPER_EXPORT_COLUMNS = ['id', 'title', 'url', 'article_preview', 'content', 'tags'];

/**
 * Choose the column list a source's own export must carry.
 *
 * @param {import('../../core/state').SourceFileRecord} file
 * @returns {string[]|null} Columns in the source's own order, or `null` to keep
 *   the full internal (unified) schema.
 */
export function exportColumnsFor(file) {
  if (Array.isArray(file.csvColumns) && file.csvColumns.length > 0) return file.csvColumns;
  if (file.profile === 'instapaper-scraper') return SCRAPER_EXPORT_COLUMNS;
  // A unified source — or one with no recorded profile at all, where guessing a
  // narrower layout could silently drop fields. The unified shape is lossless.
  return null;
}

/**
 * Reader for one source column name, or `undefined` when the app holds no value
 * for it.
 *
 * Own-property lookup, deliberately: the column names come from an uploaded file
 * and are therefore attacker-influenceable, and a plain index would resolve
 * `SOURCE_COLUMN_VALUES['constructor']` (or `toString`, `valueOf`, …) to the
 * matching `Object.prototype` member. That member is truthy, so the column would
 * be reported as mapped while actually being written as `Object(record)` — a
 * literal `{}` cell — and the unmapped-column count would silently under-report.
 *
 * @param {string} column Source column name, matched case-insensitively.
 * @returns {((b: import('../../core/model/BookmarkRecord.js').BookmarkRecord) => unknown)|undefined}
 */
export function sourceColumnReader(column) {
  const key = String(column).toLowerCase();
  return Object.hasOwn(SOURCE_COLUMN_VALUES, key) ? SOURCE_COLUMN_VALUES[key] : undefined;
}

/**
 * Reshape one record onto a source's own columns.
 *
 * Keys are inserted in `columns` order and every column is always present (empty
 * when unfillable), so `Papa.unparse` derives the header row from the object's
 * own insertion order. That keeps the emitted layout identical to the source's
 * without depending on Papa's `columns` option, which would only add a second
 * place to keep the column list in sync for the same output.
 *
 * The accumulator has a null prototype because the column names come from the
 * file: on a plain `{}` an assignment to a `__proto__` column would hit the
 * accessor on `Object.prototype` instead of creating a key, and that column
 * would vanish from the emitted header row.
 *
 * Lookup is case-insensitive for the same reason the `.db` path is: the import
 * path lowercases keys (`lowerKeyed`), so a source declaring `Title` / `URL`
 * must find its values rather than round-trip as blanks.
 *
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord} record
 * @param {string[]} columns
 * @returns {Record<string, unknown>} A new object; the record is not mutated.
 */
export function projectRecord(record, columns) {
  const projected = Object.create(null);
  for (const column of columns) {
    const read = sourceColumnReader(column);
    projected[column] = read ? (read(record) ?? null) : null;
  }
  return projected;
}

/**
 * Columns of a source's own layout that the app holds no value for.
 *
 * @param {string[]} columns
 * @returns {string[]}
 */
export function unfillableColumns(columns) {
  return columns.filter((column) => !sourceColumnReader(column));
}
