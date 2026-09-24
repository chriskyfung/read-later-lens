/**
 * @fileoverview Save/back & export options modal — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html "MODAL 3").
 * Behavior lives in src/io/exporter.js (openSaveModal + button listeners).
 */

/** @returns {string} The save/export modal markup. */
export function saveModalHtml() {
  return `
  <!-- MODAL 3: Save Back / Export Options Modal -->
  <div id="saveModal"
    class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    role="dialog" aria-modal="true" aria-labelledby="saveTitle" tabindex="-1">
    <div class="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5">
      <div class="flex justify-between items-center border-b border-slate-700 pb-3">
        <h3 id="saveTitle" class="font-bold text-base text-white">💾 儲存與匯出變更</h3>
        <button id="closeSaveBtn" class="text-slate-400 hover:text-white">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <p class="text-xs text-slate-300 leading-relaxed">
        選擇回寫至原來源檔案（優先使用 File System Access API 直接寫入，不支援時將以下載方式處理）：
      </p>

      <div id="saveSourceFilesList" class="space-y-2 max-h-52 overflow-y-auto pr-1">
        <!-- List of files ready to be exported -->
      </div>

      <div class="pt-3 border-t border-slate-700 flex justify-end space-x-2">
        <button id="exportAllUnifiedJsonBtn"
          class="bg-slate-700 hover:bg-slate-600 text-xs text-white px-3 py-2 rounded-lg">匯出成統一 JSON</button>
        <button id="exportAllUnifiedCsvBtn"
          class="bg-indigo-600 hover:bg-indigo-500 text-xs text-white px-3 py-2 rounded-lg font-semibold">匯出成統一
          CSV</button>
      </div>
    </div>
  </div>
`;
}
