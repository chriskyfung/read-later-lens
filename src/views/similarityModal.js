/**
 * @fileoverview Similarity modal — ranks bookmarks by cosine similarity.
 *
 * Matches the original monolith exactly: Tailwind `hidden` class toggling and
 * the monolith's row markup, where clicking a result closes this modal and
 * opens the article in the reader modal.
 */

import { bookmarks } from '../core/state.js';
import { mostSimilar } from '../analytics/similarity.js';
import { escapeHtml } from '../utils/dom.js';
import { openReaderModal } from './readerModal.js';

/**
 * Open the similarity modal for a given bookmark.
 *
 * @param {string} bookmarkId
 */
export function openSimilarityModal(bookmarkId) {
  const modal = document.getElementById('similarityModal');
  if (!modal) return;

  const target = bookmarks.find((b) => b.id === bookmarkId);
  if (!target) return;

  document.getElementById('simTargetTitle').innerText = target.title;
  const resultsList = document.getElementById('simResultsList');
  resultsList.innerHTML = '';

  const results = mostSimilar(bookmarks, target, 5);

  if (results.length === 0) {
    resultsList.innerHTML = `<p class="text-sm text-slate-500 italic">No similar articles found.</p>`;
  } else {
    results.forEach(({ doc, score }) => {
      const item = document.createElement('div');
      const pct = Math.round(score * 100);
      item.className =
        'p-3 bg-slate-900/80 border border-slate-700/60 rounded-xl flex items-center justify-between hover:border-indigo-500 cursor-pointer transition';
      item.onclick = () => {
        closeSimilarityModal();
        openReaderModal(doc.id);
      };
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

  modal.classList.remove('hidden');
}

/**
 * Close the similarity modal.
 */
export function closeSimilarityModal() {
  const modal = document.getElementById('similarityModal');
  if (modal) modal.classList.add('hidden');
}
