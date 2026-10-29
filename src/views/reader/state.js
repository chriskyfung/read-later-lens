/**
 * @fileoverview Reader modal module state — the id of the open bookmark.
 *
 * Kept in a leaf module so src/views/modalListeners.js can read the open
 * reader's bookmark id without readerModal.js importing workspaceActions.js
 * (which would close the workspaceActions → bookmarks → readerModal cycle).
 * Null when no reader is open.
 */

let currentReaderBookmarkId = null;

/** Set the id of the bookmark currently shown in the reader. */
export function setReaderBookmarkId(bookmarkId) {
  currentReaderBookmarkId = bookmarkId;
}

/** @returns {string|null} The id of the bookmark currently shown in the reader. */
export function getReaderBookmarkId() {
  return currentReaderBookmarkId;
}

/** Drop the reader's module state whenever its layer leaves the stack. */
export function retireReader() {
  currentReaderBookmarkId = null;
}
