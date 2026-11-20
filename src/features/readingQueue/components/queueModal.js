/**
 * @fileoverview Reading queue modal shell markup — mount-time only.
 *
 * The modal rides the shared layer stack (src/utils/dom/) with Escape unwind +
 * Tab trap registered in src/app/modalListeners.js; the view that orchestrates
 * it lives in ../behavior/view.js.
 */

/**
 * Full modal shell. `hidden` is removed by pushLayer() once it lands on the
 * layer stack; the base markup must carry it so the modal is invisible
 * everywhere else (boot, SSR-less single-page app).
 */
export function queueModalHtml() {
  return `
    <div id="queueModal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="queueTitle" tabindex="-1">
      <div class="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-slate-800 text-slate-100 shadow-2xl">
        <header class="shrink-0 flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div class="flex items-center gap-2">
            <h2 id="queueTitle" class="text-lg font-semibold text-white flex items-center gap-2">
              <i class="size-5" data-lucide="list-plus"></i> 閱讀佇列
              <span id="queueCountBadge" class="bg-amber-900/50 text-amber-200 text-xs px-2 py-0.5 rounded-full">0</span>
            </h2>
          </div>
          <button id="closeQueueBtn" class="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition" aria-label="關閉閱讀佇列">
            <i class="size-5" data-lucide="x"></i>
          </button>
        </header>

        <div class="bg-slate-900/50 px-5 py-4 overflow-y-auto flex-1">
          <div id="queueList" class="space-y-2"></div>

          <div id="queueEmptyState" class="hidden flex flex-col items-center justify-center py-8 text-center">
            <div class="bg-slate-800/80 p-4 rounded-full text-slate-500 mb-3">
              <i class="size-10" data-lucide="list-plus"></i>
            </div>
            <h3 class="text-slate-300 font-semibold mb-1">閱讀佇列是空的</h3>
            <p class="text-slate-500 text-xs max-w-sm">將書籤加入佇列，稍後依序閱讀。</p>
          </div>
        </div>
        <footer class="shrink-0 border-t border-slate-700 bg-slate-900/50 px-5 py-3 flex items-center justify-between">
          <div id="queueSummary" class="text-sm text-slate-400"></div>
          <button id="clearQueueBtn"
            class="text-xs bg-rose-600/20 hover:bg-rose-500 text-rose-200 hover:text-white px-4 py-2 rounded-lg border border-rose-700/50">
            清空佇列
          </button>
        </footer>
      </div>
    </div>
  `.trim();
}
