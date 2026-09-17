/**
 * @fileoverview Similarity matrix modal — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html "MODAL 2").
 * Behavior lives in src/views/similarityModal.js.
 */

/** @returns {string} The similarity modal markup. */
export function similarityModalHtml() {
  return `
  <!-- MODAL 2: Article Similarity Matrix Drawer/Modal -->
  <div id="similarityModal"
    class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div
      class="bg-slate-800 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/90">
        <div>
          <h3 class="font-bold text-base text-white">⚡ 相似文章推薦分析 (Cosine Similarity)</h3>
          <p class="text-xs text-slate-400">基於 TF-IDF 向量演算法計算當前文章與庫存其他文章的相似度。</p>
        </div>
        <button id="closeSimilarityBtn" class="text-slate-400 hover:text-white">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="p-6 overflow-y-auto space-y-4">
        <div class="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl">
          <span class="text-xs text-indigo-400 font-semibold block mb-1">目標文章:</span>
          <p id="simTargetTitle" class="text-sm font-bold text-white"></p>
        </div>
        <div class="space-y-3">
          <h4 class="text-xs font-bold uppercase text-slate-400">關聯度最高的文章列表：</h4>
          <div id="simResultsList" class="space-y-2">
            <!-- Dynamic similarity items -->
          </div>
        </div>
      </div>
    </div>
  </div>
`;
}
