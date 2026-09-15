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
 * @property {string|Uint8Array|null} [originalData] Serialized original payload (null for SQL).
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
