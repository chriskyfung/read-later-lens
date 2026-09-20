/**
 * @fileoverview Trash (回收桶) panel — presentational markup only.
 *
 * The panel lives inside {@link file://./panel.js panelBookmarksHtml()} so it
 * shares the bookmarks tab: the trash is a *view* over the same `bookmarks`
 * array (records stamped with `deleted_at`), not a second data store. All DOM
 * orchestration (dataset wiring, restore/purge clicks, empty state) lives in
 * src/views/trash.js.
 */

import { escapeHtml } from '../../utils/dom.js';

/** @returns {string} The trash panel markup (hidden until the trash folder is selected). */
export function trashPanelHtml() {
  return `
          <!-- Trash (回收桶) View -->
          <div id="trashPanel" class="hidden">
            <div class="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <span class="font-bold text-slate-200">🗑 回收桶</span>
                <span id="trashSummary" class="text-slate-500">共 0 筆</span>
              </div>
              <button id="emptyTrashBtn"
                class="text-xs bg-rose-600/80 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg font-medium transition">
                清空回收桶
              </button>
            </div>

            <!-- Dynamic trashed rows inserted here -->
            <div id="trashList" class="space-y-2">
            </div>

            <!-- Trash Empty State -->
            <div id="trashEmptyState" class="hidden flex flex-col items-center justify-center py-20 text-center">
              <div class="bg-slate-800/80 p-4 rounded-full text-slate-500 mb-4">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
                  </path>
                </svg>
              </div>
              <h3 class="text-slate-300 font-semibold mb-1">回收桶是空的</h3>
              <p class="text-slate-500 text-xs max-w-sm">刪除的書籤會先移到此處，您可以隨時還原或永久刪除。</p>
            </div>
          </div>`;
}

/**
 * Row class list for a trashed bookmark (one flat, unfiltered list).
 * @returns {string}
 */
export function trashItemClass() {
  return 'bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between gap-3 transition';
}

/**
 * Format a `deleted_at` ISO timestamp for display.
 *
 * Falls back to the raw value when it cannot be parsed, so a corrupted cache
 * never renders "Invalid Date".
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDeletedAt(iso) {
  if (!iso) return '未知時間';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString('zh-TW', { hour12: false });
}

/**
 * Build one trashed bookmark row.
 *
 * Pure string builder: the host view owns DOM creation and the
 * `data-restore-bookmark` / `data-purge-bookmark` dataset wiring.
 *
 * @param {import('../../model/BookmarkRecord.js').BookmarkRecord} bookmark
 * @returns {string}
 */
export function trashItemHtml(bookmark) {
  return `
            <div class="truncate flex-1 min-w-0">
              <h3 class="font-bold text-sm text-slate-100 truncate">${escapeHtml(bookmark.title)}</h3>
              <p class="text-xs text-slate-400 line-clamp-2 mb-1">${escapeHtml(bookmark.article_preview || '無預覽內容')}</p>
              <p class="text-[10px] text-slate-500 truncate">
                📁 ${escapeHtml(bookmark.source_file_name || '未知')} ｜ 刪除於 ${escapeHtml(formatDeletedAt(bookmark.deleted_at))}
              </p>
            </div>

            <div class="flex items-center space-x-2 shrink-0">
              <button data-restore-bookmark
                class="text-xs bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition">
                還原
              </button>
              <button data-purge-bookmark
                class="text-xs bg-slate-700 hover:bg-rose-600 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg font-medium transition">
                永久刪除
              </button>
            </div>`;
}
