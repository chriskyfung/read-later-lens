/**
 * @fileoverview Bookmark library state + mutators.
 *
 * Owns the `bookmarks` binding, the id -> position index, and every transition
 * that touches the library. Re-exported through `src/core/state`, so the
 * public entry point and all live bindings stay unchanged.
 */
/** @typedef {import('../../core/model/BookmarkRecord.js').BookmarkRecord} BookmarkRecord */

/** @type {BookmarkRecord[]} */
export let bookmarks = [];

/** Id -> position in `bookmarks`. Rebuilt on bulk writes; patched on O(1) toggle. */
const bookmarkIndex = new Map();

/** Rebuild the id -> position index after any bulk array replacement. */
function rebuildBookmarkIndex() {
  bookmarkIndex.clear();
  for (let i = 0; i < bookmarks.length; i++) bookmarkIndex.set(bookmarks[i].id, i);
}

/**
 * O(1) lookup by id.
 * @param {string} id
 * @returns {BookmarkRecord|undefined}
 */
export function getBookmarkById(id) {
  const i = bookmarkIndex.get(id);
  return i === undefined ? undefined : bookmarks[i];
}

export function setBookmarks(v) {
  bookmarks = v;
  rebuildBookmarkIndex();
}

/**
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

/**
 * @param {BookmarkRecord} bookmark
 * @returns {boolean}
 */
export function isTrashed(bookmark) {
  return Boolean(bookmark && bookmark.deleted_at);
}

/**
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
 * @param {string[]} ids
 */
export function purgeBookmarks(ids) {
  const targets = new Set(ids);
  bookmarks = bookmarks.filter((b) => !targets.has(b.id));
  rebuildBookmarkIndex();
}

/**
 * @param {BookmarkRecord} bookmark
 * @returns {boolean}
 */
export function isFavorite(bookmark) {
  return Boolean(bookmark && bookmark.is_favorite);
}

/**
 * @param {string[]} ids
 * @param {boolean} value
 */
export function setFavorite(ids, value) {
  const targets = new Set(ids);
  const flag = Boolean(value);
  bookmarks = bookmarks.map((b) => (targets.has(b.id) ? { ...b, is_favorite: flag } : b));
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function toggleFavorite(id) {
  const i = bookmarkIndex.get(id);
  if (i === undefined) return false;
  const next = !bookmarks[i].is_favorite;
  bookmarks[i] = { ...bookmarks[i], is_favorite: next };
  return next;
}
