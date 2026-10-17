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

/**
 * Whether a stage-2 upgrade repaint is already owed to a pending engine load.
 * Re-renders issued while the chunk is in flight share ONE continuation (the
 * shared load promise), so arrival repaints exactly once.
 */
let upgradePending = false;

export function initWordCloud(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * Render the word-cloud tab — two-stage, never blocking on the engine.
 *
 * Stage 1 always paints immediately with whichever path is current: the
 * lemma-grouped list once the lazily-split `compromise` chunk has arrived
 * (idle/intent prefetch in `main.js` / `workspaceActions.js` usually lands it
 * before this view ever runs), the plain `Intl.Segmenter` path while it is
 * still in flight, and that same plain path for every language after a load
 * failure. Stage 2 is the upgrade: the pending load re-renders this view, the
 * engine-aware memos in `analytics/wordcloud.js` re-key, and the cloud
 * repaints grouped — a refinement the reader perceives, not a wait. The
 * container's native title hint exists only while that upgrade is pending.
 */
export function renderWordCloud() {
  const container = document.getElementById('wordCloudContainer');

  // The filtered list is expensive (relevance scoring, sorting) and needed
  // by both the paint and the gate, so compute it once per render.
  const filtered = getFilteredBookmarks();
  const refining = needsKeywordEngine(filtered);

  paintWordCloud(container, filtered);
  container.title = refining ? '關鍵字分組優化中…' : '';

  if (refining && !upgradePending) {
    // Attach the continuation once: re-renders while the chunk is still in
    // flight share it, so arrival repaints exactly once — never a storm of
    // duplicate upgrades, and nothing left dangling after a failure (the
    // shared promise settles either way and the flag clears first).
    upgradePending = true;
    loadKeywordsEngine().then(() => {
      upgradePending = false;
      deps.render();
    });
  }
}

/**
 * Paint the cloud (or its empty state) into the container — the shared body
 * behind both render stages, so stage 2 is a pure re-paint of stage 1's DOM.
 *
 * @param {HTMLElement} container
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} filtered
 */
function paintWordCloud(container, filtered) {
  const items = wordCloudItems(wordCloudFrequencies(filtered));

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
