/**
 * @fileoverview Domain analytics view.
 *
 * Matches the original monolith exactly: bordered card markup with the
 * `${count} 篇文章 (${pct}%)` caption, rounded percentages, the exact
 * empty-state span, and the click flow (set search query → activateTab
 * ('bookmarks') → renderAll()). `renderAll` lives in src/views/main-view.js
 * (set by src/main.js).
 *
 * The dynamic markup (empty-state span and bar markup) has been moved to
 * src/components/domains/bar.js to keep components pure; this file now
 * handles only DOM creation, the click flow, and delegates markup via
 * helpers from ../components/domains/bar.js.
 */

import { getFilteredBookmarks } from '../core/filters.js';
import { topDomains } from '../analytics/domains.js';
import { setSearchQuery } from '../core/state.js';
import { setSearchInputValue } from './header.js';
import { activateTab } from './tabs.js';
import {
  domainChartEmptyStateHtml,
  domainBarClass,
  domainBarHtml,
} from '../components/domains/bar.js';

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
    container.innerHTML = domainChartEmptyStateHtml();
    return;
  }

  const maxCount = sorted[0][1];
  container.innerHTML = '';

  sorted.forEach(([domain, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    const bar = document.createElement('div');
    bar.className = domainBarClass();
    bar.onclick = () => {
      // The domain chart is URL-derived, so the click flow filters by URL:
      // the 'link:' operator scopes the query to the bookmark URL field.
      const query = `link:${domain}`;
      setSearchQuery(query);
      setSearchInputValue(query);
      activateTab('bookmarks');
      deps.render();
    };
    bar.innerHTML = domainBarHtml({ domain, count, pct });
    container.appendChild(bar);
  });
}
