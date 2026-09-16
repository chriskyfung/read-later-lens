/**
 * @fileoverview Word-cloud view.
 *
 * Matches the original monolith exactly: monolith span classes, visible
 * `${word} (${count})` labels, the monolith empty-state span, and the click
 * flow (set search query → activateTab('bookmarks') → renderAll()). Tab
 * switching uses the extracted mechanics in ./tabs.js; `renderAll` lives
 * in src/views/main-view.js (bridged via window.IBM.renderAll, set by
 * src/main.js).
 */

import { getFilteredBookmarks } from '../core/filters.js';
import { wordCloudFrequencies, wordCloudItems } from '../analytics/wordcloud.js';
import { setSearchQuery } from '../core/state.js';
import { activateTab } from './tabs.js';

/**
 * Render the word-cloud tab.
 */
export function renderWordCloud() {
  const container = document.getElementById('wordCloudContainer');
  const items = wordCloudItems(wordCloudFrequencies(getFilteredBookmarks()));

  if (items.length === 0) {
    container.innerHTML = '<span class="text-slate-500 text-xs">尚無文字資料可分析</span>';
    return;
  }

  container.innerHTML = '';

  items.forEach(({ word, count, sizeRatio }) => {
    const item = document.createElement('span');
    item.className =
      'word-cloud-item inline-block font-bold cursor-pointer transition p-1.5 text-indigo-300 hover:text-white';
    item.style.fontSize = `${sizeRatio}rem`;
    item.innerText = `${word} (${count})`;
    item.onclick = () => {
      setSearchQuery(word);
      document.getElementById('searchInput').value = word;
      activateTab('bookmarks');
      window.IBM.renderAll();
    };
    container.appendChild(item);
  });
}
