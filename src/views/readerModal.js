/**
 * @fileoverview Reader modal — shows article preview + link to the Instapaper reader.
 *
 * Matches the original monolith exactly: Tailwind `hidden` class toggling,
 * `content`-first preview fallback, and the Instapaper button driven by
 * `instapaper_url` (the stored record contract).
 */

import { bookmarks } from '../core/state.js';

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

  document.getElementById('readerTitle').innerText = bookmark.title;
  document.getElementById('readerLangBadge').innerText = (
    bookmark.detected_language || 'EN'
  ).toUpperCase();
  const originalUrl = document.getElementById('readerOriginalUrl');
  originalUrl.href = bookmark.url;
  originalUrl.innerText = bookmark.url;
  document.getElementById('readerPreviewContent').innerText =
    bookmark.content || bookmark.article_preview || '無內文預覽';
  document.getElementById('readerInstapaperBtn').href = bookmark.instapaper_url;

  modal.classList.remove('hidden');
}

/**
 * Close the reader modal.
 */
export function closeReaderModal() {
  const modal = document.getElementById('readerModal');
  if (modal) modal.classList.add('hidden');
}
