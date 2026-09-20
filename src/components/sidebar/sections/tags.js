/**
 * @fileoverview Sidebar custom-tag cloud section markup.
 *
 * Static monolith parity: extracted byte-for-byte from the original
 * src/components/sidebar.js sidebarHtml() template (index.html "Left Sidebar").
 * The placeholder reuses sidebarTagCloudEmptyStateHtml() from ../tagPill.js so
 * the static hint and the runtime empty state cannot drift apart.
 */

import { sidebarTagCloudEmptyStateHtml } from '../tagPill.js';

/** @returns {string} The custom tags section markup. */
export function sidebarTagCloudSectionHtml() {
  return `      <!-- Custom Tags Filter -->
      <div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">自訂標籤</h2>
        <div id="tagFilterCloud" class="flex flex-wrap gap-1">
          ${sidebarTagCloudEmptyStateHtml()}
        </div>
      </div>`;
}