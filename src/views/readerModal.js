/**
 * @fileoverview Reader modal — shows article preview + link to the Instapaper reader.
 *
 * Matches the original monolith exactly: Tailwind `hidden` class toggling,
 * `content`-first preview fallback, and the Instapaper button driven by
 * `instapaper_url` (the stored record contract). In addition to close
 * behaviour, the id of the open bookmark is tracked (getReaderBookmarkId) so
 * src/views/modalListeners.js can drive the 🗑️ 刪除 / ⚡ 相似 buttons without an
 * import cycle into workspaceActions.js. Opening/closing goes through
 * openModal/closeModal (src/utils/dom.js) for dialog focus management.
 */

import { bookmarks } from '../core/state.js';
import { openModal, closeModal, safeUrl } from '../utils/dom.js';

/**
 * Currently-open bookmark id, consumed by the reader action buttons (🗑️ 刪除
 * and ⚡ 相似) registered in src/views/modalListeners.js. Kept here rather than
 * on a DOM node so the leaf module can read it without readerModal.js importing
 * workspaceActions.js (which would close the
 * workspaceActions → bookmarks → readerModal cycle). Null when no reader is open.
 */
let currentReaderBookmarkId = null;

/** @returns {string|null} The id of the bookmark currently shown in the reader. */
export function getReaderBookmarkId() {
  return currentReaderBookmarkId;
}

/**
 * Open the reader modal for a given bookmark.
 *
 * @param {string} bookmarkId
 */
export function openReaderModal(bookmarkId) {
  const modal = document.getElementById('readerModal');
  if (!modal) return;

  const bookmark = bookmarks.find((b) => b.id === bookmarkId);
  if (!bookmark) return;

  currentReaderBookmarkId = bookmarkId;

  document.getElementById('readerTitle').innerText = bookmark.title;
  document.getElementById('readerLangBadge').innerText = (
    bookmark.detected_language || 'EN'
  ).toUpperCase();
  const originalUrl = document.getElementById('readerOriginalUrl');
  originalUrl.href = safeUrl(bookmark.url) || '#';
  originalUrl.innerText = bookmark.url;
  document.getElementById('readerPreviewContent').innerText =
    bookmark.content || bookmark.article_preview || '無內文預覽';
  document.getElementById('readerInstapaperBtn').href = safeUrl(bookmark.instapaper_url) || '#';

  openModal(modal);
}

/**
 * Close the reader modal.
 */
export function closeReaderModal() {
  const modal = document.getElementById('readerModal');
  if (modal) closeModal(modal);
  currentReaderBookmarkId = null;
}
