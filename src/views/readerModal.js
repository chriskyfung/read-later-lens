/**
 * @fileoverview Reader modal — shows article preview + link to the Instapaper reader.
 *
 * Matches the original monolith exactly: Tailwind `hidden` class toggling,
 * `content`-first preview fallback, and the Instapaper button driven by
 * `instapaper_url` (the stored record contract). In addition to close
 * behaviour, the id of the open bookmark is tracked (getReaderBookmarkId) so
 * src/views/modalListeners.js can drive the 🗑️ 刪除 / ⚡ 相似 buttons without an
 * import cycle into workspaceActions.js. Opening/closing goes through
 * pushLayer/popLayer (src/utils/dom.js), so a reader opened from a
 * similarity drawer stacks on top of it and unwinds back to it.
 */

import { bookmarks } from '../core/state.js';
import { pushLayer, popLayer, safeUrl } from '../utils/dom.js';

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

/** Drop the reader's module state whenever its layer leaves the stack. */
function retireReader() {
  currentReaderBookmarkId = null;
}

/**
 * Render the reader overlay for a bookmark without touching the layer stack.
 *
 * Doubles as the layer's `restore`, so a reader revealed by closing a modal
 * stacked above it re-renders the article it was originally opened with.
 *
 * @param {string} bookmarkId
 * @returns {boolean} Whether the overlay was rendered.
 */
export function renderReaderModal(bookmarkId) {
  const modal = document.getElementById('readerModal');
  if (!modal) return false;

  const bookmark = bookmarks.find((b) => b.id === bookmarkId);
  if (!bookmark) return false;

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

  return true;
}

/**
 * Open the reader modal for a given bookmark, stacking it on top of any modal
 * that is already open.
 *
 * @param {string} bookmarkId
 */
export function openReaderModal(bookmarkId) {
  if (!renderReaderModal(bookmarkId)) return;
  pushLayer('readerModal', {
    payload: bookmarkId,
    restore: renderReaderModal,
    onRetire: retireReader,
  });
}

/**
 * Close the reader modal, revealing the layer beneath it if there is one.
 */
export function closeReaderModal() {
  retireReader();
  popLayer('readerModal');
}
