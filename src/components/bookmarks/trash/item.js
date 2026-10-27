/**
 * @fileoverview Trash row markup — the DOM-XSS audit target for the trash.
 *
 * Extracted verbatim from src/components/bookmarks/trashModal.js when the trash
 * markup split into src/components/bookmarks/trash/*. Keeping the row builder
 * alone means tests/dom-xss-sinks.test.js pins exactly this file: any edit that
 * drops an escape() fails the audit without re-reviewing the modal shell.
 *
 * `trashItemHtml` and `formatDeletedAt` are the parity builders for the
 * old trash-panel markup: the DOM-XSS registry audit (tests/dom-xss-sinks.js)
 * targets them by the same string shape, so they keep the original
 * fallbacks and class names. Escaping is not re-implemented here: builders
 * use the shared escapeHtml() from src/utils/dom/ — the helper named by
 * CONTRIBUTING and the eslint DOM-sink tripwire.
 */
import { escapeHtml } from '../../../utils/dom';
import { trashItemClass } from './constants.js';
import { formatDeletedAt } from './formatters.js';

/**
 * Build one trashed row's HTML. Pure string builder: the view owns DOM
 * insertion and the `data-restore-bookmark` / `data-purge-bookmark` dataset
 * wiring. Values are escaped by the attribute and text content paths — dynamic
 * input never reaches the DOM unescaped, so this builder is a DOM-XSS sink
 * audit target in tests/dom-xss-sinks.test.js.
 *
 * Shape parity with the old panel builder: title / article_preview /
 * source_file_name / deleted_at, so the DOM-XSS audit object covers it.
 */
export function trashItemHtml(bookmark) {
  return `
    <div data-trash-row="${escapeHtml(bookmark.id)}" class="${trashItemClass()}">
      <div class="flex-1 min-w-0">
        <h3 class="font-bold text-sm text-slate-100 truncate">${escapeHtml(bookmark.title)}</h3>
        <p class="text-xs text-slate-400 line-clamp-2 mb-1">${escapeHtml(bookmark.article_preview || '無預覽內容')}</p>
        <p class="text-[10px] text-slate-500 truncate">📁 ${escapeHtml(bookmark.source_file_name || '未知')} ｜ 刪除於 ${escapeHtml(formatDeletedAt(bookmark.deleted_at))}</p>
      </div>
      <div class="flex shrink-0 gap-2">
        <button data-restore-bookmark="${escapeHtml(bookmark.id)}"
          class="text-xs bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition">
          還原
        </button>
        <button data-purge-bookmark="${escapeHtml(bookmark.id)}"
          class="text-xs bg-slate-700 hover:bg-rose-600 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg font-medium transition">
          永久刪除
        </button>
      </div>
    </div>
  `.trim();
}
