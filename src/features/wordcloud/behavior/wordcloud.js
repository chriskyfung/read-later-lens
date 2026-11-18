/**
 * @fileoverview Word-cloud view.
 *
 * Matches the original monolith exactly: monolith span classes, visible
 * `${word} (${count})` labels, the monolith empty-state span, and the click
 * flow (set search query → activateTab('bookmarks') → renderAll()). Tab
 * switching uses the extracted mechanics in ./tabs.js; `renderAll` lives
 * in src/app/shell.js (set by src/main.js).
 *
 * The dynamic markup (empty-state span and item spans) has been moved to
 * ../components/item.js to keep components pure; this file now
 * handles only DOM creation, the click flow, and delegates markup via
 * helpers from ./item.js.
 */

import { getFilteredBookmarks } from 'src/core/filters.js';
import { wordCloudFrequenciesAsync } from '@/analytics';
import { setSearchQuery } from '@/core/state';
import { setSearchInputValue } from '@/features/header';
import { activateTab } from '@/behavior/tabs.js';
import { wordCloudEmptyStateHtml, wordCloudItemClass, wordCloudItemLabel } from '../components';

let deps = { render: () => {} };

export function initWordCloud(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * Render the word-cloud tab.
 *
 * Extraction and aggregation run in a Web Worker (see `wordCloudFrequenciesAsync`),
 * so the main thread stays free for UI work. A loading placeholder renders
 * immediately; the worker result replaces it when ready. Engine loading and
 * failure handling happen inside the worker — this file no longer manages
 * the compromise lifecycle on the main thread.
 */
export async function renderWordCloud() {
  const container = document.getElementById('wordCloudContainer');

  // Show a loading state immediately so the UI never freezes while the
  // worker extracts terms across thousands of bookmarks.
  container.innerHTML = '<span class="text-slate-500 text-xs">正在分析關鍵字…</span>';

  // The filtered list is expensive (relevance scoring, sorting) — compute
  // once per render rather than once per check.
  const filtered = getFilteredBookmarks();

  try {
    // Off-main-thread: extraction + aggregation in the Web Worker.
    // Falls back to synchronous computation if Workers are unavailable
    // or the worker errors — rendering never breaks.
    const items = await wordCloudFrequenciesAsync(filtered);

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
  } catch (err) {
    // `wordCloudFrequenciesAsync` already falls back to sync computation,
    // so this is only for unexpected errors. Render nothing to avoid a
    // half-updated UI; the next renderAll() will retry.
    console.error('Word cloud render failed:', err);
  }
}
