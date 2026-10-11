/**
 * @fileoverview Trash (回收桶) modal markup + content builders.
 *
 * The modal rides the shared layer stack (src/utils/dom.js) with Escape unwind
 * + Tab trap registered in src/views/modalListeners.js; the view that
 * orchestrates it lives in src/views/trash.js.
 *
 * `trashItemHtml` and `formatDeletedAt` are the parity builders for the
 * old trash-panel markup: the DOM-XSS registry audit (tests/dom-xss-sinks.js)
 * targets them by the same string shape, so they keep the original
 * implementation (escaping, fallback fallbacks, class names).
 */

/** Columns for each trashed row (documentation of the row structure). */
export const trashItemColumns = [
  { key: 'title', label: '標題' },
  { key: 'sourceFile', label: '來源' },
  { key: 'deletedAt', label: '刪除於' },
];

/**
 * Card shell for one trashed row — the monolith's panel-side class restored
 * verbatim, so each bookmark renders as a bordered card that isolates it from
 * its neighbours. The exact string is pinned by tests.
 */
export function trashItemClass() {
  return 'bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between gap-3 transition';
}

/**
 * Escape text content so <, >, &, ", ' are safe inside HTML text nodes.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
    <div class="${trashItemClass()}">
      <div class="flex-1 min-w-0">
        <h3 class="font-bold text-sm text-slate-100 truncate">${escapeHtml(bookmark.title)}</h3>
        <p class="text-xs text-slate-400 line-clamp-2 mb-1">${escapeHtml(bookmark.article_preview || '無預覽內容')}</p>
        <p class="text-[10px] text-slate-500 truncate">📁 ${escapeHtml(bookmark.source_file_name || '未知')} ｜ 刪除於 ${escapeHtml(formatDeletedAt(bookmark.deleted_at))}</p>
      </div>
      <div class="flex shrink-0 gap-2">
        <button data-restore-bookmark
          class="text-xs bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition">
          還原
        </button>
        <button data-purge-bookmark
          class="text-xs bg-slate-700 hover:bg-rose-600 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg font-medium transition">
          永久刪除
        </button>
      </div>
    </div>
  `.trim();
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
 * Full modal shell. `hidden` is removed by pushLayer() once it lands on the
 * layer stack; the base markup must carry it so the modal is invisible
 * everywhere else (boot, SSR-less single-page app).
 */
export function trashModalHtml() {
  return `
    <div id="trashModal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="trashTitle" tabindex="-1">
      <div class="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-slate-800 text-slate-100 shadow-2xl">
        <header class="shrink-0 flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h2 id="trashTitle" class="text-lg font-semibold text-white">回收桶</h2>
          <button id="closeTrashBtn" class="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition" aria-label="關閉回收桶">
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="6" y1="6" x2="14" y2="14"></line>
              <line x1="14" y1="6" x2="6" y2="14"></line>
            </svg>
          </button>
        </header>

        <div class="px-5 py-4 overflow-y-auto flex-1">
          <div id="trashList" class="space-y-3"></div>

          <div id="trashEmptyState" class="hidden flex flex-col items-center justify-center py-6 text-center">
            <div class="bg-slate-800/80 p-4 rounded-full text-slate-500 mb-3">
              <svg class="size-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </div>
            <h3 class="text-slate-300 font-semibold mb-1">回收桶是空的</h3>
            <p class="text-slate-500 text-xs max-w-sm">刪除的書籤會先移到此處；您可隨時還原或永久刪除。</p>
          </div>
        </div>
        <footer class="shrink-0 border-t border-slate-700 bg-slate-900/50 px-5 py-3 flex items-center justify-between">
          <div id="trashSummary" class="text-sm text-slate-400"></div>
          <button id="emptyTrashBtn"
            class="text-xs bg-rose-600/20 hover:bg-rose-500 text-rose-200 hover:text-white px-4 py-2 rounded-lg border border-rose-700/50">
            清空回收桶
          </button>
        </footer>
      </div>
    </div>
  `.trim();
}
