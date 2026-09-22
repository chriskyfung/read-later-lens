/**
 * @fileoverview Concept-linkage graph presentational helpers.
 *
 * Extracted from src/views/linkage.js `renderConceptLinkageGraph()` — the
 * string-built markup (the exact empty-state div and the tooltip tag pills).
 * The helpers preserve the monolith's byte-for-byte HTML and class names; the
 * host view still owns all D3 rendering, DOM element creation, event wiring
 * and interactions.
 */

/**
 * Returns the exact empty-state markup that the monolith uses.
 */
export function linkageEmptyStateHtml() {
  return '<div class="text-slate-500 text-xs flex items-center justify-center h-full">需要至少 2 筆書籤以構建關聯網絡拓撲圖</div>';
}

/**
 * Builds the joined tag-pill markup for the graph tooltip (`#ttTags`).
 *
 * @param {string[]|undefined} tags
 * @returns {string}
 */
export function linkageTooltipTagsHtml(tags) {
  return (tags || [])
    .map(
      (t) =>
        `<span class="bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded text-[10px]">${t}</span>`,
    )
    .join('');
}