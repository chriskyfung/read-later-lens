/**
 * @fileoverview Word-cloud view.
 *
 * Matches the original monolith exactly: monolith span classes, visible
 * `${word} (${count})` labels, the monolith empty-state span, and the click
 * flow (set search query → activateTab('bookmarks') → renderAll()). Tab
 * switching uses the extracted mechanics in ./tabs.js; `renderAll` lives
 * in src/views/main-view.js (set by src/main.js).
 *
 * The dynamic markup (empty-state span and item spans) has been moved to
 * src/components/wordcloud/item.js to keep components pure; this file now
 * handles only DOM creation, the click flow, and delegates markup via
 * helpers from ./item.js.
 */

import { getFilteredBookmarks } from '../core/filters.js';
import { wordCloudFrequencies, wordCloudItems } from '../analytics/wordcloud.js';
import { setSearchQuery } from '../core/state.js';
import { setSearchInputValue } from './header.js';
import { activateTab } from './tabs.js';
import { wordCloudEmptyStateHtml } from '../components/wordcloud/item.js';
import { wordCloudItemClass, wordCloudItemLabel } from '../components/wordcloud/item.js';

let deps = { render: () => {} };

export function initWordCloud(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/** Render the word-cloud tab. */
export function renderWordCloud() {
  const container = document.getElementById('wordCloudContainer');
  const items = wordCloudItems(wordCloudFrequencies(getFilteredBookmarks()));

  if (items.length === 0) {
    container.innerHTML = wordCloudEmptyStateHtml();
    return;
  }

  container.innerHTML = '';

  items.forEach(({ word, count, sizeRatio }) => {
    const item = document.createElement('span');
    item.className = wordCloudItemClass();
    item.style.fontSize = `${sizeRatio}rem`;
    item.innerText = wordCloudItemLabel({ word, count });
    item.onclick = () => {
      setSearchQuery(word);
      setSearchInputValue(word);
      activateTab('bookmarks');
      deps.render();
    };
    container.appendChild(item);
  });
}
