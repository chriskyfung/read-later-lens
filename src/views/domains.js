/**
 * @fileoverview Domain analytics view.
 *
 * Matches the original monolith exactly: bordered card markup with the
 * `${count} 篇文章 (${pct}%)` caption, rounded percentages, the exact
 * empty-state span, and the click flow (set search query → activateTab
 * ('bookmarks') → renderAll()). `renderAll` lives in src/views/main-view.js
 * (set by src/main.js).
 */

import { escapeHtml } from '../utils/dom.js';
import { getFilteredBookmarks } from '../core/filters.js';
import { topDomains } from '../analytics/domains.js';
import { setSearchQuery } from '../core/state.js';
import { activateTab } from './tabs.js';

let deps = { render: () => {} };

export function initDomains(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/** Render the domain chart tab. */
export function renderDomainChart() {
  const container = document.getElementById('domainChartContainer');
  if (!container) return;

  const sorted = topDomains(getFilteredBookmarks(), 15);

  if (sorted.length === 0) {
    container.innerHTML =
      '<span class="text-slate-500 text-xs flex justify-center py-10">尚無域名資料</span>';
    return;
  }

  const maxCount = sorted[0][1];
  container.innerHTML = '';

  sorted.forEach(([domain, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    const bar = document.createElement('div');
    bar.className =
      'p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl hover:border-indigo-500/50 cursor-pointer transition';
    bar.onclick = () => {
      setSearchQuery(domain);
      document.getElementById('searchInput').value = domain;
      activateTab('bookmarks');
      deps.render();
    };
    bar.innerHTML = `
        <div class="flex justify-between items-center text-xs mb-1.5">
          <span class="font-semibold text-slate-200">${escapeHtml(domain)}</span>
          <span class="text-slate-400 font-mono">${count} 篇文章 (${pct}%)</span>
        </div>
        <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
          <div class="bg-indigo-500 h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      `;
    container.appendChild(bar);
  });
}
