/**
 * @fileoverview Application state — single source of truth.
 *
 * The state lives in module-level bindings (not a class) so it can be
 * serialized to/from IndexedDB via `JSON.stringify`. Views mutate state
 * only through the setters below; `renderAll()` must be called afterwards.
 */

/** @typedef {import('../model/BookmarkRecord.js').BookmarkRecord} BookmarkRecord */

/**
 * @typedef {object} SourceFileRecord
 *
 * The `null` each optional field below documents is its PERSISTED shape, and so
 * also what the record carries once `saveState` has written it. In memory the
 * field is simply `undefined` on both paths that never set one: a record of a
 * type the field does not describe, and a row cached by a version that predates
 * the field. `saveState` normalises both to `null` (`?? null`), and every
 * consumer falls back the same way for each, so the difference is never
 * observable in exported bytes.
 *
 * @property {string} id
 * @property {string} name             Human-readable file name.
 * @property {string} type             'csv' | 'json' | 'sqlite' | 'db'.
 * @property {string} [profile]        Import profile id chosen in the source
 *   picker (see src/providers/profiles.js), e.g. 'instapaper-scraper'.
 * @property {string|Uint8Array|null} [originalData] Serialized original payload (null for SQL).
 * @property {{table: string, columns: string[]}|null} [sqliteSchema] The table
 *   name and column list a `.db` source was read from, so save-back re-emits
 *   the source's own layout. Persisted (it is small); `null` for other types,
 *   for a file with no table, and for sources cached by a version that predates
 *   this field — those are refused rather than re-emitted with a guessed shape.
 * @property {string[]|null} [csvColumns] The header row a CSV source was read
 *   from, in order, so save-back re-emits the source's own columns rather than
 *   the app's internal schema. Persisted (it is tiny, unlike the payload);
 *   `null` for non-CSV sources, for a file Papa reported no headers for, and
 *   for sources cached by a version that predates this field — those fall back
 *   to the profile default rather than a guessed layout.
 * @property {{delimiter?: string, linebreak?: string}|null} [csvDialect] The
 *   delimiter and line terminator a CSV source was actually written with, as
 *   PapaParse reported them, so save-back re-emits the file in its own dialect
 *   instead of always comma + CRLF. Each half is optional (a file with an
 *   unreadable terminator still keeps its delimiter). Persisted (two short
 *   strings); null for non-CSV sources, for a meta Papa could not describe, and
 *   for sources cached by a version that predates this field — those fall
 *   back to RFC 4180 rather than a guessed dialect.
 */

/** @type {BookmarkRecord[]} */
export let bookmarks = [];

/** Id → position in `bookmarks`. Rebuilt on bulk writes; patched on O(1) toggle. */
const bookmarkIndex = new Map();

/** Rebuild the id → position index after any bulk array replacement. */
function rebuildBookmarkIndex() {
  bookmarkIndex.clear();
  for (let i = 0; i < bookmarks.length; i++) bookmarkIndex.set(bookmarks[i].id, i);
}

/**
 * O(1) lookup by id (linear `find` fallback is never needed — the index is
 * kept in sync by every mutator below).
 *
 * @param {string} id
 * @returns {BookmarkRecord|undefined}
 */
export function getBookmarkById(id) {
  const i = bookmarkIndex.get(id);
  return i === undefined ? undefined : bookmarks[i];
}

/** @type {Map<string, SourceFileRecord>} */
export let sourceFiles = new Map();

export let activeFolder = 'ALL';
/** @type {'ALL' | 'en' | 'zh' | 'ja' | 'other'} */
export let activeLang = 'ALL';
export let activeTag = null;
/** @type {'bookmarks' | 'wordcloud' | 'domains' | 'linkage'} */
export let activeTab = 'bookmarks';
export let searchQuery = '';
/** @type {'relevance' | 'newer' | 'older' | 'title_asc' | 'title_desc'} */
export let sortBy = 'relevance';
/** @type {Set<string>} */
export let selectedIds = new Set();
/** @type {import('sql.js').initSqlJs.SqlJsStatic | null} */
export let SQL = null;

// ------------------------------------------------------------------
// Mutators — the ONLY way external modules mutate state.
// ------------------------------------------------------------------

export function setBookmarks(v) {
  bookmarks = v;
  rebuildBookmarkIndex();
}
export function setSourceFiles(v) {
  sourceFiles = v;
}
export function setActiveFolder(v) {
  activeFolder = v;
}
export function setActiveLang(v) {
  activeLang = v;
}
export function setActiveTag(v) {
  activeTag = v;
}
export function setActiveTab(v) {
  activeTab = v;
}
export function setSearchQuery(v) {
  searchQuery = v;
}
export function setSortBy(v) {
  sortBy = v;
}
export function setSelectedIds(v) {
  selectedIds = v;
}
export function setSQL(v) {
  SQL = v;
}

// ------------------------------------------------------------------
// State transitions (merge / remove)
// ------------------------------------------------------------------

/**
 * Add a batch of bookmarks, merging on `id` (incoming wins → newest wins).
 *
 * A star already on disk wins when the incoming record carries no explicit
 * favorite flag, so re-importing a source never silently un-stars a bookmark.
 * An explicit `false` from a future two-way-sync source still clears.
 *
 * @param {BookmarkRecord[]} incoming
 */
export function mergeBookmarks(incoming) {
  const existing = new Map(bookmarks.map((b) => [b.id, b]));
  for (const b of incoming) {
    const prev = existing.get(b.id);
    existing.set(
      b.id,
      b.is_favorite === undefined && prev?.is_favorite ? { ...b, is_favorite: true } : b,
    );
  }
  bookmarks = Array.from(existing.values());
  rebuildBookmarkIndex();
}

/** @param {string} sourceFileId */
export function removeSourceFile(sourceFileId) {
  sourceFiles.delete(sourceFileId);
  bookmarks = bookmarks.filter((b) => b.source_file_id !== sourceFileId);
  rebuildBookmarkIndex();
  if (activeFolder === sourceFileId) activeFolder = 'ALL';
}

// ------------------------------------------------------------------
// Trash (soft delete) transitions
//
// Deleting a bookmark never drops the record: it is *trashed* by stamping
// `deleted_at`, which makes every active view (filters, sidebar counts, exports)
// skip it while the trash view can still list and restore it. Only the trash's
// own permanent actions (還原/永久刪除/清空回收桶) and source-file deletion
// (which purges the file's trashed bookmarks too, so no orphan can survive)
// remove records for real.
// ------------------------------------------------------------------

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} bookmark
 * @returns {boolean} Whether the record sits in the trash.
 */
export function isTrashed(bookmark) {
  return Boolean(bookmark && bookmark.deleted_at);
}

/**
 * Soft-delete bookmarks by stamping `deleted_at`.
 *
 * Already-trashed ids keep their original stamp so "newest deleted first"
 * ordering stays honest when a batch overlaps the trash.
 *
 * @param {string[]} ids
 */
export function trashBookmarks(ids) {
  const targets = new Set(ids);
  const deletedAt = new Date().toISOString();
  bookmarks = bookmarks.map((b) =>
    targets.has(b.id) && !b.deleted_at ? { ...b, deleted_at: deletedAt } : b,
  );
  rebuildBookmarkIndex();
}

/**
 * Restore bookmarks from the trash (clears `deleted_at`).
 *
 * @param {string[]} ids
 */
export function restoreBookmarks(ids) {
  const targets = new Set(ids);
  bookmarks = bookmarks.map((b) =>
    targets.has(b.id) && b.deleted_at ? { ...b, deleted_at: null } : b,
  );
  rebuildBookmarkIndex();
}

/**
 * Remove bookmarks permanently (used by the trash view and by folder deletion,
 * which purges the file's trashed bookmarks as well as its active ones).
 *
 * @param {string[]} ids
 */
export function purgeBookmarks(ids) {
  const targets = new Set(ids);
  bookmarks = bookmarks.filter((b) => !targets.has(b.id));
  rebuildBookmarkIndex();
}

/**
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} bookmark
 * @returns {boolean} Whether the record is favorited.
 */
export function isFavorite(bookmark) {
  return Boolean(bookmark && bookmark.is_favorite);
}

/**
 * Set the favorite flag on the given ids (idempotent; every other field is
 * untouched). Mirrors trashBookmarks's immutable-map idiom so persist + render
 * always observe a new array.
 *
 * @param {string[]} ids
 * @param {boolean} value
 */
export function setFavorite(ids, value) {
  const targets = new Set(ids);
  const flag = Boolean(value);
  bookmarks = bookmarks.map((b) => (targets.has(b.id) ? { ...b, is_favorite: flag } : b));
  // Positions are unchanged by the 1:1 map, so the index stays valid.
}

/**
 * Toggle one bookmark's favorite flag; mutates nothing if the id is unknown.
 *
 * O(1) via the id index: a single record is copied in place, so a star
 * click never allocates a full-library array the way setFavorite's map does.
 *
 * @param {string} id
 * @returns {boolean} The new flag, or false when the id was not found.
 */
export function toggleFavorite(id) {
  const i = bookmarkIndex.get(id);
  if (i === undefined) return false;
  const next = !bookmarks[i].is_favorite;
  bookmarks[i] = { ...bookmarks[i], is_favorite: next };
  return next;
}
