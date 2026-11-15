/**
 * @fileoverview Concept-linkage graph panel — presentational markup only.
 *
 * The core markup structure (zoom controls, D3 tooltip, tab-panel wrapper)
 * is preserved from the monolith; Tailwind classes and DOM hooks match the
 * original byte-for-byte. Graph rendering + zoom state live in ../behavior/;
 * the zoom buttons are wired by src/features/workspace/.
 */

/** @returns {string} The linkage panel markup. */
export function panelLinkageHtml() {
  return `
        <!-- Panel 4: Concept Linkage Graph View -->
        <div id="panelLinkage" class="tab-panel hidden h-full flex flex-col relative">
          <div
            class="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 mb-4 flex justify-between items-center z-10">
            <div>
              <h3 class="text-sm font-semibold text-indigo-300"><svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="m12.342 9.316 1.764-3.527"/><path d="m12.59 14.545 2.35 3.759"/><path d="m13.982 12.332 4.03.447"/><path d="M5.414 17.586 8.88 14.12"/><path d="M9.025 9.742 5.317 5.505"/><circle cx="11" cy="12" r="3"/><circle cx="15" cy="4" r="2"/><circle cx="16" cy="20" r="2"/><circle cx="20" cy="13" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="4" cy="4" r="2"/></svg> 書籤概念關聯圖 (D3 Force Graph)</h3>
              <p class="text-xs text-slate-400">依據共用關鍵字與域名建立拓撲。節點大小代表關聯度，顏色代表域名。支援滾輪縮放與拖曳。</p>
            </div>
            <div class="flex items-center gap-2">
              <button id="zoomInBtn" class="bg-slate-700 hover:bg-slate-600 text-slate-200 p-1.5 rounded-lg"
                title="放大"><svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path>
                </svg></button>
              <button id="zoomOutBtn" class="bg-slate-700 hover:bg-slate-600 text-slate-200 p-1.5 rounded-lg"
                title="縮小"><svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path>
                </svg></button>
              <button id="resetGraphBtn"
                class="bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 px-3 py-1.5 rounded-lg">重置視圖</button>
              <label class="text-xs text-slate-300 flex items-center gap-1 cursor-pointer">
                <input type="checkbox" id="weightingTfidfToggle" class="accent-indigo-500">
                TF-IDF 權重
              </label>
            </div>
          </div>
          <div id="d3GraphCanvas"
            class="flex-1 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden min-h-112.5">
            <!-- D3 SVG injected here -->
          </div>

          <!-- D3 Tooltip -->
          <div id="graphTooltip"
            class="fixed opacity-0 pointer-events-none z-50 bg-slate-800 border border-indigo-500/50 p-3 rounded-lg shadow-2xl transition-opacity duration-200 max-w-xs -translate-x-1/2 -translate-y-full -mt-2.5">
            <div id="ttTitle" class="text-sm font-bold text-white mb-1 leading-snug line-clamp-2"></div>
            <div class="text-[10px] text-indigo-300 font-mono mb-1 truncate" id="ttDomain"></div>
            <div class="flex flex-wrap gap-1" id="ttTags"></div>
          </div>
        </div>
`;
}
