/** @fileoverview Header shell — assembles the presentational blocks into the full header.
 *
 * Extracted verbatim from src/components/header.js when the header markup
 * split into src/components/header/*. mountHeader() still inserts the header
 * as the FIRST child of <body> (insertAdjacentHTML 'afterbegin'), preserving
 * the monolith's DOM order.
 *
 * The shell changes rarely (layout / a11y) while the blocks churn with copy
 * and styling, so they live apart — same rationale as
 * src/components/bookmarks/trash/modal.js vs item.js.
 */

import { HEADER_IDS } from './constants.js';
import { headerBrandingHtml } from './branding.js';
import { headerSearchBarHtml } from './searchBar.js';
import { headerActionsHtml } from './actions.js';

/** @returns {string} The header markup. */
export function headerHtml() {
  return `
  <!-- Top Navigation Header -->
  <header id="${HEADER_IDS.appHeader}"
    class="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700 px-6 py-3 flex items-center justify-between z-20 shrink-0">
    <div class="flex items-center gap-3">
${headerBrandingHtml()}
    </div>

    <div class="flex items-center gap-2 flex-1 max-w-xl mx-8">
${headerSearchBarHtml()}
    </div>

    <div class="flex items-center gap-2">
${headerActionsHtml()}
    </div>
  </header>
`;
}

/**
 * Insert the header as the first child of <body> (monolith DOM order).
 */
export function mountHeader() {
  document.body.insertAdjacentHTML('afterbegin', headerHtml());
}
