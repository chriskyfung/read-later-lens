/** @fileoverview Header listener wiring — search input, quick-reset, clear cache.
 *
 * Extracted from src/views/header.js when the header view split into
 * src/views/header/*. Mirrors src/views/trash/listeners.js: each call binds
 * once, missing markup is tolerated (optional chaining), and the returned
 * disposer removes exactly the handlers this call added.
 *
 * Register AFTER mountHeader() (src/components/header.js) so the header
 * elements exist. Listeners for #fileInput and #saveBackBtn remain owned by
 * src/io/importer.js and src/io/exporter.js respectively.
 */

import { HEADER_IDS } from '../../components/header/constants.js';
import { applySearch, scheduleSearch } from './search.js';
import { clearSearch, clearCache } from './actions.js';
import { syncClearButton } from './view.js';

/**
 * Attach the search-input (debounced + Enter), quick-reset, and
 * clear-cache handlers.
 * @returns {function} Disposer that removes exactly the handlers this call added.
 */
export function registerHeaderListeners() {
  const input = document.getElementById(HEADER_IDS.searchInput);

  // Search input — typing only updates cheap UI echoes; the expensive
  // state write + render is debounced (or triggered by Enter / clearing).
  const onSearchInput = (e) => {
    const value = e.target.value;
    syncClearButton(value); // instant echo — no render
    if (value === '') {
      // Clearing applies immediately — a reset should never lag.
      applySearch();
    } else {
      scheduleSearch();
    }
  };

  // Enter — apply the search immediately (cancels any pending debounce).
  // IME guard: confirming a zh-TW candidate must NOT trigger a search.
  const onSearchKeydown = (e) => {
    if (e.key !== 'Enter') return;
    if (e.isComposing || e.keyCode === 229) return;
    applySearch();
  };

  input?.addEventListener('input', onSearchInput);
  input?.addEventListener('keydown', onSearchKeydown);

  // Quick-reset button — drops pending keystrokes, clears the query and
  // input, hides itself, refocuses, and re-renders (never persists).
  document.getElementById(HEADER_IDS.clearSearchBtn)?.addEventListener('click', clearSearch);

  // Clear cache button — confirm → freshness gate → wipe → persist/render → toast.
  document.getElementById(HEADER_IDS.clearCacheBtn)?.addEventListener('click', clearCache);

  return () => {
    input?.removeEventListener('input', onSearchInput);
    input?.removeEventListener('keydown', onSearchKeydown);
    document.getElementById(HEADER_IDS.clearSearchBtn)?.removeEventListener('click', clearSearch);
    document.getElementById(HEADER_IDS.clearCacheBtn)?.removeEventListener('click', clearCache);
  };
}
