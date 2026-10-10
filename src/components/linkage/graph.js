/**
 * @fileoverview Concept-linkage graph presentational helpers.
 *
 * Extracted from src/views/linkage.js `renderConceptLinkageGraph()` — the
 * string-built markup (the exact empty-state div and the tooltip tag pills).
 * The helpers preserve the class names and structure of the monolith; the
 * empty-state copy no longer matches the monolith's 'needs at least 2' wording,
 * since the view now renders a single node.
 * host view still owns all D3 rendering, DOM element creation, event wiring
 * and interactions.
 */

import { escapeHtml } from '../../utils/dom.js';

/**
 * Returns the empty-state markup shown when the graph has no bookmarks to render.
 */
export function linkageEmptyStateHtml() {
  return '<div class="text-slate-500 text-xs flex items-center justify-center h-full">尚無書籤可構建關聯網絡拓撲圖</div>';
}

/**
 * Builds the joined tag-pill markup for the graph tooltip (`#ttTags`).
 *
 * Tags come straight from imported records (CSV/JSON cells are split, never
 * sanitized), so each one is escaped before it reaches `innerHTML` — otherwise a
 * crafted tag would run the moment the user hovers a graph node.
 *
 * @param {string[]|undefined} tags
 * @returns {string}
 */
export function linkageTooltipTagsHtml(tags) {
  return (tags || [])
    .map(
      (t) =>
        `<span class="bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded-sm text-[10px]">${escapeHtml(t)}</span>`,
    )
    .join('');
}
