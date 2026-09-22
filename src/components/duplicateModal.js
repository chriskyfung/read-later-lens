/**
 * @fileoverview Duplicate file warning modal — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html "MODAL 4").
 * Behavior lives in src/io/importer.js (waitForDuplicateResolution).
 */

/** @returns {string} The duplicate-file warning modal markup. */
export function duplicateModalHtml() {
  return `
  <!-- MODAL 4: Duplicate File Warning Modal -->
  <div id="duplicateModal"
    class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5">
      <h3 class="font-bold text-base text-white flex items-center gap-2">
        <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
          </path>
        </svg>
        發現同名檔案
      </h3>
      <p class="text-sm text-slate-300" id="duplicateFileText"></p>
      <div class="flex flex-col space-y-2 pt-2">
        <button id="dupBtnOverwrite"
          class="bg-rose-600 hover:bg-rose-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition">覆寫舊檔案
          (覆蓋)</button>
        <button id="dupBtnKeepBoth"
          class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition">兩者皆保留
          (另存新檔)</button>
        <button id="dupBtnCancel"
          class="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg font-medium transition">取消匯入</button>
      </div>
    </div>
  </div>
`;
}
