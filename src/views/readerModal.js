/**
 * @fileoverview Reader modal — shows article preview + link to the Instapaper reader.
 *
 * Matches the original monolith exactly: Tailwind `hidden` class toggling,
 * `content`-first preview fallback, and the Instapaper button driven by
 * `instapaper_url` (the stored record contract). In addition to close
 * behaviour, the id of the open bookmark is tracked (getReaderBookmarkId) so
 * src/views/modalListeners.js can drive the 刪除 / 相似 / 收藏 buttons without
 * an import cycle into workspaceActions.js. Opening/closing goes through
 * pushLayer/popLayer (src/utils/dom/), so a reader opened from a
 * similarity drawer stacks on top of it and unwinds back to it.
 */

import { getBookmarkById } from '../core/state.js';
import { pushLayer, popLayer, safeUrl } from '../utils/dom';

/**
 * Currently-open bookmark id, consumed by the reader action buttons (刪除,
 * 相似, 收藏) registered in src/views/modalListeners.js. Kept here rather than
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

  const bookmark = getBookmarkById(bookmarkId);
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

  // Pink marks the star control (matching the card's pink ❤) so it never
  // reads as the rose trash button. Measured pairs: pink-400 on slate-800
  // 8.07:1, slate-900 on pink-400 9.84:1 — both clear WCAG 2.x AA 4.5:1.
  const favoriteBtn = document.getElementById('readerFavoriteBtn');
  if (favoriteBtn) applyFavoriteVariant(favoriteBtn, Boolean(bookmark.is_favorite));

  return true;
}

/**
 * Favorite-button variant classes. Hoisted so every open/toggle reuses the
 * same arrays instead of allocating fresh token lists per call.
 */
const FAV_OFF = [
  'bg-slate-800',
  'hover:bg-pink-100',
  'text-pink-400',
  'border-pink-400/60',
  'hover:border-pink-400',
];
const FAV_ON = [
  'bg-pink-400',
  'hover:bg-pink-300/60',
  'text-pink-50',
  'hover:text-pink-900/60',
  'border-pink-400',
  'hover:border-pink-400',
];
const FAV_ALL = [
  'bg-slate-800',
  'bg-pink-400',
  'hover:bg-pink-100',
  'hover:bg-pink-300/60',
  'text-pink-50',
  'text-pink-400',
  'hover:text-slate-900',
  'hover:text-slate-900/60',
  'hover:text-pink-400',
  'hover:text-pink-900/60',
  'border-pink-400/60',
  'border-pink-400',
  'hover:border-pink-400',
];

/**
 * Sync only the favorite button for an already-open reader (star toggle).
 * Cheaper than renderReaderModal(): one O(1) lookup + one button write,
 * no title/url/preview rewrites.
 *
 * @param {string} bookmarkId
 * @returns {boolean} Whether the button was synced.
 */
export function syncReaderFavoriteButton(bookmarkId) {
  const bookmark = getBookmarkById(bookmarkId);
  const favoriteBtn = document.getElementById('readerFavoriteBtn');
  if (!bookmark || !favoriteBtn) return false;
  applyFavoriteVariant(favoriteBtn, Boolean(bookmark.is_favorite));
  return true;
}

/**
 * Apply the on/off variant to the favorite button (single remove + add).
 *
 * @param {HTMLElement} favoriteBtn
 * @param {boolean} isFavorite
 */
function applyFavoriteVariant(favoriteBtn, isFavorite) {
  favoriteBtn.classList.remove(...FAV_ALL);
  favoriteBtn.classList.add(...(isFavorite ? FAV_ON : FAV_OFF));
  favoriteBtn.setAttribute('aria-pressed', String(isFavorite));
  favoriteBtn.title = isFavorite ? '已收藏，點擊取消收藏' : '加星收藏';
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
