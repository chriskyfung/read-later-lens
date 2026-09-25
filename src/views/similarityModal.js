/**
 * @fileoverview Similarity modal — ranks bookmarks by cosine similarity.
 *
 * Keeps the monolith's Tailwind `hidden` class toggling and row markup, except
 * that clicking a result now *stacks* the reader on top of this drawer: the
 * drawer stays open beneath it, so closing the reader returns to the
 * recommendation list. Opening/closing goes through pushLayer/popLayer
 * (src/utils/dom.js) so nested dialogs stack and unwind in reverse order.
 */

import { bookmarks } from '../core/state.js';
import { getActiveBookmarks } from '../core/filters.js';
import { mostSimilar } from '../analytics/similarity.js';
import { escapeHtml, pushLayer, popLayer } from '../utils/dom.js';
import { openReaderModal } from './readerModal.js';

/**
 * Render the similarity drawer for a bookmark without touching the stack.
 *
 * Doubles as the layer's `restore`, so a drawer revealed by closing a reader
 * stacked above it re-renders the recommendations it was opened with.
 *
 * @param {string} bookmarkId
 * @returns {boolean} Whether the drawer was rendered.
 */
export function renderSimilarityModal(bookmarkId) {
  const modal = document.getElementById('similarityModal');
  if (!modal) return false;

  const target = bookmarks.find((b) => b.id === bookmarkId);
  if (!target) return false;

  document.getElementById('simTargetTitle').innerText = target.title;
  const resultsList = document.getElementById('simResultsList');
  resultsList.innerHTML = '';

  // Rank against live bookmarks only: recommending a trashed article (or
  // recommending *for* one) would contradict the trash's "removed from view"
  // contract.
  const results = mostSimilar(getActiveBookmarks(), target, 5);

  if (results.length === 0) {
    resultsList.innerHTML = `<p class="text-sm text-slate-500 italic">No similar articles found.</p>`;
  } else {
    results.forEach(({ doc, score }) => {
      const item = document.createElement('div');
      const pct = Math.round(score * 100);
      item.className =
        'p-3 bg-slate-900/80 border border-slate-700/60 rounded-xl flex items-center justify-between hover:border-indigo-500 cursor-pointer transition';
      // Stack the reader on top; the drawer stays open and is restored on close.
      item.onclick = () => openReaderModal(doc.id);
      // doc.title and doc.article_preview are passed through escapeHtml() in the
      // template below, and pct is a number: nothing user-supplied stays raw.
      // eslint-disable-next-line no-restricted-syntax -- escaped strings, numeric pct
      item.innerHTML = `
        <div class="truncate flex-1 pr-3">
          <p class="text-xs font-semibold text-slate-200 truncate">${escapeHtml(doc.title)}</p>
          <p class="text-[10px] text-slate-400 line-clamp-1">${escapeHtml(doc.article_preview)}</p>
        </div>
        <span class="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">${pct}% 相似</span>
      `;
      resultsList.appendChild(item);
    });
  }

  return true;
}

/**
 * Open the similarity drawer for a bookmark, stacking it on top of any modal
 * that is already open.
 *
 * @param {string} bookmarkId
 */
export function openSimilarityModal(bookmarkId) {
  if (!renderSimilarityModal(bookmarkId)) return;
  pushLayer('similarityModal', {
    payload: bookmarkId,
    restore: renderSimilarityModal,
  });
}

/**
 * Close the similarity modal, revealing the layer beneath it if there is one.
 */
export function closeSimilarityModal() {
  popLayer('similarityModal');
}
