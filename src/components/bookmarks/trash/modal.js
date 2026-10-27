/**
 * @fileoverview Trash (回收桶) modal shell markup — mount-time only.
 *
 * Extracted verbatim from src/components/bookmarks/trashModal.js when the trash
 * markup split into src/components/bookmarks/trash/*. The shell changes rarely
 * (a11y, layout) while the row builder (item.js) churns with copy and styling,
 * so they live apart; mounting concatenates this string in
 * src/components/modals.js.
 *
 * The modal rides the shared layer stack (src/utils/dom/) with Escape unwind
 * + Tab trap registered in src/views/modalListeners.js; the view that
 * orchestrates it lives in src/views/trash/.
 */

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

        <div class="bg-slate-900/50 px-5 py-4 overflow-y-auto flex-1">
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
