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
import { bookmarks, setSearchQuery } from '../core/state.js';
import { setSearchInputValue } from './header.js';
import { activateTab } from './tabs.js';
import { wordCloudEmptyStateHtml, wordCloudLoadingHtml } from '../components/wordcloud/item.js';
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
 * Render the word-cloud tab — cheap gate first, heavy work deferred while
 * the engine is still in flight.
 *
 * Opening the tab must never freeze the main thread: while the lazily-split
 * `compromise` chunk is pending, only the loading placeholder is written
 * (microseconds), and the filtering + plain-path extraction pass runs in a
 * macrotask — after the browser has painted the tab switch and the loader.
 * (Before the two-stage change, that pass ran INSIDE the click handler and
 * froze a first open for hundreds of ms on a real-size library.) The
 * deferred pass then paints whichever path is current: lemma-grouped if the
 * chunk already arrived (idle/intent prefetch usually wins), the plain
 * `Intl.Segmenter` path while it is still in flight, and that same plain
 * path for every language after a load failure. Stage 2 is the upgrade: the
 * pending load re-renders this view, the engine-aware memos in
 * `analytics/wordcloud.js` re-key, and the cloud repaints grouped — a
 * refinement the reader perceives, not a wait.
 *
 * Fast path (engine settled, or no English documents in the library):
 * everything stays synchronous — the memos make it cheap and no loader
 * flashes.
 */
export function renderWordCloud() {
  const container = document.getElementById('wordCloudContainer');

  // Cheap gate: the LIVE state binding and memoized per-record language
  // detection, short-circuiting at the first English document — no
  // filtering, no extraction. (Gating on `getFilteredBookmarks()` would pay
  // for the relevance sort just to decide to defer it.)
  if (needsKeywordEngine(bookmarks)) {
    container.innerHTML = wordCloudLoadingHtml();
    container.title = '';
    setTimeout(() => {
      const filtered = getFilteredBookmarks();
      paintWordCloud(container, filtered);
      refine(container, filtered);
    }, 0);
    return;
  }

  const filtered = getFilteredBookmarks();
  paintWordCloud(container, filtered);
  refine(container, filtered);
}

/**
 * Stage-2 bookkeeping, shared by the sync fast path and the deferred first
 * paint: surface the pending upgrade natively (container title) and attach
 * the single continuation that repaints exactly once when the chunk lands —
 * never a storm of duplicate upgrades, and nothing left dangling after a
 * failure (the shared promise settles either way and the flag clears first).
 *
 * @param {HTMLElement} container
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord[]} filtered
 */
function refine(container, filtered) {
  const refining = needsKeywordEngine(filtered);
  container.title = refining ? '關鍵字分組優化中…' : '';

  if (refining && !upgradePending) {
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
