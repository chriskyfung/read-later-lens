/**
 * @fileoverview Reader view modal — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html "MODAL 1").
 * Behavior lives in src/views/readerModal.js; listeners are registered by
 * src/views/modalListeners.js after mounting.
 */

/** @returns {string} The reader modal markup. */
export function readerModalHtml() {
  return `
  <!-- MODAL 1: Reader View Modal -->
  <div id="readerModal"
    class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
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
        <a id="readerInstapaperBtn" href="#" target="_blank"
          class="bg-amber-600 hover:bg-amber-500 text-white text-xs px-4 py-2 rounded-lg font-medium flex items-center space-x-1">
          <span>開啟 Instapaper 閱讀器</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </a>
        <button id="closeReaderFooterBtn"
          class="bg-slate-700 hover:bg-slate-600 text-xs text-white px-4 py-2 rounded-lg">關閉</button>
      </div>
    </div>
  </div>
`;
}
