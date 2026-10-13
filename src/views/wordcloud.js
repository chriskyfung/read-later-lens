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
import { needsKeywordEngine, loadKeywordsEngine } from '../analytics/keywords.js';

let deps = { render: () => {} };

export function initWordCloud(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * Render the word-cloud tab.
 *
 * The English keyword engine is loaded lazily: when the visible library needs
 * it, a loading placeholder renders once and the view re-renders itself when
 * the chunk arrives. A failed load falls through to the legacy tokenizer, so
 * the cloud still renders (see `keywords.js`).
 */
export function renderWordCloud() {
  const container = document.getElementById('wordCloudContainer');

  if (needsKeywordEngine(getFilteredBookmarks())) {
    container.innerHTML = '<span class="text-slate-500 text-xs">正在載入關鍵字分析引擎…</span>';
    loadKeywordsEngine().then(() => deps.render());
    return;
  }

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
