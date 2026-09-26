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
 * @property {File|FileSystemFileHandle|null} [fileHandle] File handle for save-back.
 */

/** @type {BookmarkRecord[]} */
export let bookmarks = [];

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
 * @param {BookmarkRecord[]} incoming
 */
export function mergeBookmarks(incoming) {
  const existing = new Map(bookmarks.map((b) => [b.id, b]));
  for (const b of incoming) existing.set(b.id, b);
  bookmarks = Array.from(existing.values());
}

/** @param {string} sourceFileId */
export function removeSourceFile(sourceFileId) {
  sourceFiles.delete(sourceFileId);
  bookmarks = bookmarks.filter((b) => b.source_file_id !== sourceFileId);
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
}
