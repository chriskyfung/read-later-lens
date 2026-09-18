/**
 * @fileoverview Reader view modal — presentational markup only.
 *
 * Based on the original monolith (index.html "MODAL 1"). The 🗑️ 刪除 and ⚡ 相似
 * action buttons are a Phase 2 enhancement layered onto the footer; their
 * behaviour lives in src/views/modalListeners.js (the acyclic leaf that owns
 * modal wiring) so this component stays free of destructive-action imports.
 * Behavior lives in src/views/readerModal.js; listeners are registered by
 * src/views/modalListeners.js after mounting.
 */

/** @returns {string} The reader modal markup. */
export function readerModalHtml() {
  return `
  <!-- MODAL 1: Reader View Modal -->
  <div id="readerModal"
    class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    role="dialog" aria-modal="true" aria-labelledby="readerTitle" tabindex="-1">
    <div
      class="bg-slate-800 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
        <div class="flex items-center space-x-2">
          <span class="bg-indigo-600/30 text-indigo-300 text-xs px-2.5 py-1 rounded-full font-semibold"
            id="readerLangBadge">EN</span>
          <h3 id="readerTitle" class="font-bold text-base text-white truncate max-w-lg">文章內文預覽</h3>
        </div>
        <button id="closeReaderBtn" class="text-slate-400 hover:text-white p-1 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <!-- Modal Body -->
      <div class="p-6 overflow-y-auto space-y-4 text-slate-300 leading-relaxed text-sm" id="readerBody">
        <div class="p-4 bg-slate-900/60 rounded-xl border border-slate-700/50">
          <div class="text-xs text-slate-400 mb-1">原始連結 URL:</div>
          <a id="readerOriginalUrl" href="#" target="_blank"
            class="text-indigo-400 hover:underline break-all text-xs"></a>
        </div>
        <div id="readerPreviewContent" class="whitespace-pre-wrap font-serif text-base text-slate-200"></div>
      </div>
      <!-- Modal Footer -->
      <div class="px-6 py-3 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center">
        <button id="readerSimilarityBtn" title="查看相似文章"
          class="bg-indigo-600/20 hover:bg-indigo-500 text-indigo-200 hover:text-white text-xs px-4 py-2 rounded-lg border border-indigo-700/50 flex items-center space-x-1">
          <span>⚡ 相似</span>
        </button>
        <div class="flex items-center space-x-2">
          <a id="readerInstapaperBtn" href="#" target="_blank"
            class="bg-amber-600 hover:bg-amber-500 text-white text-xs px-4 py-2 rounded-lg font-medium flex items-center space-x-1">
            <span>開啟 Instapaper 閱讀器</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
          </a>
          <button id="readerDeleteBtn" title="刪除此書籤"
            class="bg-rose-600/20 hover:bg-rose-500 text-rose-200 hover:text-white text-xs px-4 py-2 rounded-lg border border-rose-700/50 flex items-center space-x-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            <span>刪除</span>
          </button>
        </div>
      </div>
    </div>
  </div>
`;
}
