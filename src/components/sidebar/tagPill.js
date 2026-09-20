/**
 * @fileoverview Sidebar tag-pill presentational helpers.
 *
 * Extracted from src/views/sidebar.js `renderTagCloud()` — the exact empty
 * placeholder, the pill class list and the `#${tag} (${count})` label. Markup
 * and classes are preserved byte-for-byte from the monolith; the host view
 * still owns DOM creation and the `data-filter-tag` dataset wiring.
 */

/**
 * Returns the exact tag-cloud empty placeholder that the monolith uses
 * (shared by the static sidebar markup and the runtime renderer).
 */
export function sidebarTagCloudEmptyStateHtml() {
  return '<span class="text-xs text-slate-500 italic">尚無標籤</span>';
}

/**
 * Class list for a tag pill, driven by selection state.
 *
 * @param {boolean} isSelected
 * @returns {string}
 */
export function sidebarTagPillClass(isSelected) {
  return `text-[11px] px-2 py-0.5 rounded-full border transition ${
    isSelected
      ? 'bg-indigo-600 text-white border-indigo-400 font-semibold'
      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
  }`;
}

/**
 * Builds the tag-pill label `#${tag} (${count})`.
 *
 * @param {{tag: string, count: number}} opts
 * @returns {string}
 */
export function sidebarTagPillLabel({ tag, count }) {
  return `#${tag} (${count})`;
}