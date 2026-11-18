/**
 * @fileoverview Duplicate file warning modal — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html "MODAL 4").
 * Behavior lives in src/io/import/ (waitForDuplicateResolution).
 */

/** @returns {string} The duplicate-file warning modal markup. */
export function duplicateModalHtml() {
  return `
  <!-- MODAL 4: Duplicate File Warning Modal -->
  <div id="duplicateModal"
    class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5">
      <h3 class="font-bold text-base text-white flex items-center gap-2">
        <i class="size-5 text-amber-500" data-lucide="triangle-exclamation-point"></i>
        發現同名檔案
      </h3>
      <p class="text-sm text-slate-300" id="duplicateFileText"></p>
      <div class="flex flex-col gap-2 pt-2">
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
