/**
 * @fileoverview Domain analytics presentational helpers.
 *
 * Extracted from src/views/domains.js `renderDomainChart()` — markup that is
 * generated as a pure string builder. The helpers preserve the monolith’s
 * byte‑for‑byte HTML and class names; the host view (renderDomainChart) still
 * owns DOM element creation, event wiring and the click flow.
 */

import { escapeHtml } from '../../utils/dom.js';

/**
 * Returns the exact empty‑state markup that the monolith uses.
 */
export function domainChartEmptyStateHtml() {
  return '<span class="text-slate-500 text-xs flex justify-center py-10">尚無域名資料</span>';
}

/**
 * Returns the constant class list for a domain bar.
 */
export function domainBarClass() {
  return 'p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl hover:border-indigo-500/50 cursor-pointer transition';
}

/**
 * Builds the inner HTML of a domain bar.
 *
 * @param {{domain: string, count: number, pct: number}} opts
 * @returns {string} The HTML snippet for a single bar.
 */
export function domainBarHtml({ domain, count, pct }) {
  return `
        <div class="flex justify-between items-center text-xs mb-1.5">
          <span class="font-semibold text-slate-200">${escapeHtml(domain)}</span>
          <span class="text-slate-400 font-mono">${count} 篇文章 (${pct}%)</span>
        </div>
        <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
          <div class="bg-indigo-500 h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      `;
}