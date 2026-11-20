/**
 * @fileoverview Bookmark card component — presentational markup only.
 *
 * The card's structure, DOM hooks and dataset assignments are preserved from
 * the monolith; Tailwind v4 idioms are used. The host view owns DOM element
 * creation, listener wiring and the `data-delete-bookmark` dataset assignment
 * (see `createBookmarkCard`).
 */

import { escapeHtml, safeUrl } from '@/utils/dom';
import { isInQueue } from '@/features/readingQueue';

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
  } rounded-xl p-4 flex flex-col justify-between transition duration-200 shadow-md group relative cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500`;
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
        `<span class="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded-sm">#${escapeHtml(t)}</span>`,
    )
    .join('');
}

function queuedIconHtml(isInQueue) {
  if (!isInQueue) return '';
  return `<div aria-hidden="true" class="text-amber-500">
    <i class="size-3" fill="currentColor" data-lucide="list-clock"></i>
  </div>`;
}

function favoriteIconHtml(isFavorite) {
  if (!isFavorite) return '';
  return `<div aria-hidden="true" class="text-pink-500">
    <i class="size-3" fill="currentColor" data-lucide="heart"></i>
  </div>`;
}

function sourceFileHtml(sourceFileName, fileLabel) {
  return `<div class="text-[10px] py-0.5 text-slate-300 truncate max-w-37.5 flex items-center gap-1"
    title="${escapeHtml(sourceFileName)}" aria-label="${fileLabel}${escapeHtml(sourceFileName)}">
    <i class="size-3 text-amber-300" data-lucide="layers-2"></i> ${escapeHtml(sourceFileName)}
  </div>`;
}

/**
 * Build the bookmark card inner HTML.
 *
 * Structure preserved from the monolith: label-wrapped title + checkbox, the
 * `無預覽內容` preview fallback, the language/domain/source-file badges, every
 * `#`-tag, the 相似 button, the original + Instapaper links, and the
 * delete button. A starred bookmark prefixes a decorative pink ❤ to the
 * source-file badge (announced via its aria-label); starring itself happens
 * in the reader modal, so the card carries no favorite control. When the
 * bookmark is in the reading queue, an amber queue indicator appears next to
 * the pink ❤ or source-file badge. No DOM reads — this is a pure string builder.
 *
 * @param {object} opts
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord} opts.bookmark
 * @param {string} opts.domain  Resolved domain badge text (caller derives).
 * @param {boolean} opts.isSelected
 * @param {boolean} opts.isInQueue  True when the bookmark is in the reading queue.
 * @returns {string}
 */
export function bookmarkCardHtml({ bookmark, domain, isSelected }) {
  const b = bookmark;
  const isFavorite = Boolean(b.is_favorite);
  const fileLabel = isFavorite ? '已收藏，來自檔案 ' : '來自檔案 ';
  const queued = isInQueue(b.id);
  return `
          <div>
            <label class="flex items-baseline justify-between gap-2 cursor-pointer">
              <h3 class="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition line-clamp-2 mb-1.5 leading-snug align-middle">${escapeHtml(b.title)}</h3>
              <input type="checkbox" ${isSelected ? 'checked' : ''} class="mt-1 rounded-sm border-slate-700 text-indigo-600 focus:ring-0 bg-slate-900 select-bookmark-cb">
            </label>

            <p class="text-xs text-slate-400 line-clamp-3 mb-3 leading-relaxed">
              ${escapeHtml(b.article_preview || '無預覽內容')}
            </p>
          </div>

          <div>
            <div class="flex items-start justify-between gap-2 mt-2">
              <div class="flex items-center gap-1">
                <div class="text-[10px] font-bold font-mono uppercase px-1.5 py-0.5 rounded-sm border border-slate-600/50 bg-slate-700 text-slate-300 shrink-0">${escapeHtml(b.detected_language)}</div>
                <div class="text-[10px] bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded-sm border border-indigo-800/50 truncate max-w-35">${escapeHtml(domain)}</div>
              </div>
              <div class="flex items-center gap-2.5">
                ${queuedIconHtml(queued)}
                ${favoriteIconHtml(isFavorite)}
                ${sourceFileHtml(b.source_file_name, fileLabel)}
              </div>
            </div>

            <!-- Tags list -->
            <div class="flex flex-wrap gap-1 mb-3">
              ${tagsHtml(b.tags)}
              </div>

              <!-- Card Actions Footer -->
            <div class="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
              <div class="flex items-center gap-1.5">
                <button class="open-similarity-btn hover:text-indigo-300 flex items-center gap-1 bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded-sm transition">
                  <i class="size-3" data-lucide="orbit"></i> 相似
                </button>
                <button class="open-linkage-btn hover:text-indigo-300 flex items-center gap-1 bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded-sm transition" title="在概念關聯圖中檢視">
                  <i class="size-3" data-lucide="graph-star"></i> 關聯
                </button>
              </div>

              <div class="flex items-center gap-1">
                <a href="${escapeHtml(safeUrl(b.url))}" target="_blank" title="前往原始網站" class="text-slate-400 hover:text-slate-100 p-1">
                  <i class="size-4" data-lucide="external-link"></i>
                </a>
                <a href="${escapeHtml(safeUrl(b.instapaper_url))}" target="_blank" title="於 Instapaper 開啟" class="text-slate-400 hover:text-slate-100 p-1">
                  <i class="size-4" data-lucide="square-bookmark"></i>
                </a>
                <span aria-hidden="true" class="w-2"></span>
                <button data-delete-bookmark title="刪除此書籤" class="text-slate-400 hover:text-rose-400 p-1">
                  <i class="size-4" data-lucide="trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
}
