/**
 * @fileoverview Reader modal view — DOM rendering only.
 *
 * Renders the article preview, language badge, original URL, Instapaper link
 * and favorite-button variant for an already-open reader. Doubles as the
 * layer's `restore`, so a reader revealed by closing a modal stacked above it
 * re-renders the article it was originally opened with.
 */

import { getBookmarkById } from '@/core/state';
import { safeUrl } from '@/utils/dom';
import { isInQueue } from '@/features/readingQueue/behavior';
import { applyFavoriteVariant } from './favorite.js';
import { applyQueueVariant } from './queue.js';
import { setReaderBookmarkId } from './state.js';

/**
 * Render the reader overlay for a bookmark without touching the layer stack.
 *
 * @param {string} bookmarkId
 * @returns {boolean} Whether the overlay was rendered.
 */
export function renderReaderModal(bookmarkId) {
  const modal = document.getElementById('readerModal');
  if (!modal) return false;

  const bookmark = getBookmarkById(bookmarkId);
  if (!bookmark) return false;

  setReaderBookmarkId(bookmarkId);

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

  const favoriteBtn = document.getElementById('readerFavoriteBtn');
  if (favoriteBtn) applyFavoriteVariant(favoriteBtn, Boolean(bookmark.is_favorite));

  const queueBtn = document.getElementById('readerQueueBtn');
  console.log();
  if (queueBtn) applyQueueVariant(queueBtn, isInQueue(bookmarkId));

  return true;
}

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
 * Sync only the queue button for an already-open reader (toggle icon/text).
 * Cheaper than renderReaderModal(): one O(1) lookup + one button write.
 *
 * @param {string} bookmarkId
 * @returns {boolean} Whether the button was synced.
 */
export function syncReaderQueueButton(bookmarkId) {
  const queueBtn = document.getElementById('readerQueueBtn');
  if (!queueBtn) return false;
  applyQueueVariant(queueBtn, isInQueue(bookmarkId));
  return true;
}
