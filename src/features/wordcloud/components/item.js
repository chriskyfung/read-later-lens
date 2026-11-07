/**
 * @fileoverview Word-cloud item markup helpers.
 *

 * Markup (empty-state span and item spans) preserved byte-for-byte from
 * src/features/wordcloud/behavior/wordcloud.js renderWordCloud(); the host
 * view retains DOM creation, listener wiring, and the click flow (set search
 * query → activateTab('bookmarks') → renderAll).
 */

/**
 * Returns the exact empty-state markup that the monolith uses.
 */
export function wordCloudEmptyStateHtml() {
  return '<span class="text-slate-500 text-xs">尚無文字資料可分析</span>';
}

/**
 * Returns the constant class list for an item span.
 */
export function wordCloudItemClass() {
  return 'word-cloud-item inline-block font-bold cursor-pointer transition p-1.5 text-indigo-300 hover:text-white';
}

/**
 * Builds the label string `${word} (${count})`.
 *
 * @param {{word: string, count: number}} obj
 * @returns {string}
 */
export function wordCloudItemLabel({ word, count }) {
  return `${word} (${count})`;
}
