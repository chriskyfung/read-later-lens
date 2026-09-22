/**
 * @fileoverview Domain analytics panel — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html
 * "Panel 3: Domain Analytics View"). Rendering lives in
 * src/views/domains.js.
 */

/** @returns {string} The domains panel markup. */
export function panelDomainsHtml() {
  return `
        <!-- Panel 3: Domain Analytics View -->
        <div id="panelDomains" class="tab-panel hidden">
          <div class="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5 mb-6">
            <h3 class="text-sm font-semibold text-indigo-300 mb-1">📊 來源域名與網站統計分析</h3>
            <p class="text-xs text-slate-400">分析您收藏的前 15 大熱門網站來源與比例。點擊特定域名可立即篩選該來源文章。</p>
          </div>
          <div id="domainChartContainer" class="space-y-3 max-w-3xl mx-auto">
            <!-- Dynamic Domain Bars -->
          </div>
        </div>
`;
}
