/**
 * @fileoverview Bookmark card component — presentational markup only.
 *
 * Extracted from src/views/bookmarks.js renderBookmarkCards() (originally the
 * monolith's per-card template). Markup is preserved byte-for-byte; only the
 * host view (src/views/bookmarks.js) is responsible for DOM element creation,
 * listener wiring and the `data-delete-bookmark` dataset assignment (see
 * `createBookmarkCard`).
 */

import { escapeHtml, safeUrl } from '../../utils/dom.js';

/**
 * Card wrapper class list, driven by selection state (monolith parity).
 *
 * @param {boolean} isSelected
 * @returns {string}
 */
export function bookmarkCardClass(isSelected) {
  return `bg-slate-800/80 hover:bg-slate-800 border ${
    isSelected
      ? 'border-indigo-500 ring-1 ring-indigo-500'
      : 'border-slate-700/80 hover:border-slate-600'
  } rounded-xl p-4 flex flex-col justify-between transition-all duration-200 shadow-md group relative`;
}

/**
 * Render the `#`-tag pills for a bookmark's tags array.
 *
 * @param {string[]|undefined} tags
 * @returns {string}
 */
function tagsHtml(tags) {
  return (tags || [])
    .map(
      (t) =>
        `<span class="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded">#${escapeHtml(t)}</span>`,
    )
    .join('');
}

/**
 * Build the bookmark card inner HTML.
 *
 * Preserved exactly from the monolith: label-wrapped title + checkbox, the
 * `無預覽內容` preview fallback, the language/domain/source-file badges, every
 * `#`-tag, the 閱讀/相似 buttons, the original + Instapaper links, and the
 * delete button. No DOM reads — this is a pure string builder.
 *
 * @param {object} opts
 * @param {import('../../model/BookmarkRecord.js').BookmarkRecord} opts.bookmark
 * @param {string} opts.domain  Resolved domain badge text (caller derives).
 * @param {boolean} opts.isSelected
 * @returns {string}
 */
export function bookmarkCardHtml({ bookmark, domain, isSelected }) {
  const b = bookmark;
  return `
          <div>
            <label class="flex items-baseline justify-between space-x-2 cursor-pointer">
              <h3 class="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition line-clamp-2 mb-1.5 leading-snug align-middle">${escapeHtml(b.title)}</h3>
              <input type="checkbox" ${isSelected ? 'checked' : ''} class="mt-1 rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-900 select-bookmark-cb">
            </label>

            <p class="text-xs text-slate-400 line-clamp-3 mb-3 leading-relaxed">
              ${escapeHtml(b.article_preview || '無預覽內容')}
            </p>
          </div>

          <div>
            <div class="flex items-start justify-between gap-2 mt-2">
              <div>
                <span class="text-[10px] font-bold font-mono uppercase px-1.5 py-0.5 rounded border border-slate-600/50 bg-slate-700 text-slate-300 shrink-0">${escapeHtml(b.detected_language)}</span>
                <span class="text-[10px] bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/50 truncate max-w-35">${escapeHtml(domain)}</span>
              </div>
              <span class="text-[10px] py-0.5 text-slate-300 truncate max-w-37.5" title="${escapeHtml(b.source_file_name)}">📁 ${escapeHtml(b.source_file_name)}</span>
            </div>

            <!-- Tags list -->
            <div class="flex flex-wrap gap-1 mb-3">
              ${tagsHtml(b.tags)}
              </div>

              <!-- Card Actions Footer -->
            <div class="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
              <div class="flex items-center space-x-1.5">
                <button class="open-reader-btn hover:text-indigo-300 flex items-center space-x-1 bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded transition">
                  <span>📖 閱讀</span>
                </button>
                <button class="open-similarity-btn hover:text-indigo-300 flex items-center space-x-1 bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded transition">
                  <span>⚡ 相似</span>
                </button>
              </div>

              <div class="flex items-center space-x-1">
                <a href="${escapeHtml(safeUrl(b.url))}" target="_blank" title="前往原始網站" class="text-slate-400 hover:text-slate-200 p-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </a>
                <a href="${escapeHtml(safeUrl(b.instapaper_url))}" target="_blank" title="於 Instapaper 開啟" class="text-slate-400 hover:text-amber-400 p-1">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                </a>
                <button data-delete-bookmark title="刪除此書籤" class="text-slate-400 hover:text-rose-400 p-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </div>
          </div>
        `;
}
