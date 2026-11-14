/**
 * @fileoverview Header listener wiring — search input, quick-reset, clear cache.
 *
 * Each call binds once, missing markup is tolerated (optional chaining), and the
 * returned disposer removes exactly the handlers this call added.
 *
 * Register AFTER mountHeader() (../components/shell.js)
 * so the header elements exist. Listeners for #fileInput and #saveBackBtn
 * remain owned by src/io/import/ and src/io/export/ respectively.
 */

import { HEADER_IDS } from '../components/constants.js';
import { applySearch, scheduleSearch } from './search.js';
import { clearSearch, clearCache } from './actions.js';
import { syncClearButton, showSearchHelpTooltip, hideSearchHelpTooltip } from './view.js';

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

  // Search help button — show tooltip on hover/focus, hide on blur/outside
  const helpBtn = document.getElementById(HEADER_IDS.searchHelpBtn);
  const tooltip = document.getElementById(HEADER_IDS.searchHelpTooltip);

  let hideTimeout = null;

  const show = () => {
    clearTimeout(hideTimeout);
    showSearchHelpTooltip();
  };

  const hide = () => {
    hideTimeout = setTimeout(hideSearchHelpTooltip, 150); // small delay for mouse travel
  };

  // Mouse
  helpBtn?.addEventListener('mouseenter', show);
  helpBtn?.addEventListener('mouseleave', hide);
  tooltip?.addEventListener('mouseenter', show);
  tooltip?.addEventListener('mouseleave', hide);

  // Keyboard focus
  helpBtn?.addEventListener('focus', show);
  helpBtn?.addEventListener('blur', hide);

  // Click toggle (touch / screen readers)
  const handleHelpClick = (e) => {
    e.preventDefault();
    if (tooltip?.classList.contains('hidden')) show();
    else hide();
  };
  helpBtn?.addEventListener('click', handleHelpClick);

  // Escape key to dismiss
  const onEscape = (e) => {
    if (e.key === 'Escape') hideSearchHelpTooltip();
  };
  document.addEventListener('keydown', onEscape);

  // Click outside to dismiss
  const onClickOutside = (e) => {
    if (!helpBtn?.contains(e.target) && !tooltip?.contains(e.target)) {
      hideSearchHelpTooltip();
    }
  };
  document.addEventListener('mousedown', onClickOutside);

  return () => {
    input?.removeEventListener('input', onSearchInput);
    input?.removeEventListener('keydown', onSearchKeydown);
    document.getElementById(HEADER_IDS.clearSearchBtn)?.removeEventListener('click', clearSearch);
    document.getElementById(HEADER_IDS.clearCacheBtn)?.removeEventListener('click', clearCache);

    // Tooltip cleanup
    helpBtn?.removeEventListener('mouseenter', show);
    helpBtn?.removeEventListener('mouseleave', hide);
    tooltip?.removeEventListener('mouseenter', show);
    tooltip?.removeEventListener('mouseleave', hide);
    helpBtn?.removeEventListener('focus', show);
    helpBtn?.removeEventListener('blur', hide);
    helpBtn?.removeEventListener('click', handleHelpClick);
    document.removeEventListener('keydown', onEscape);
    document.removeEventListener('mousedown', onClickOutside);
    clearTimeout(hideTimeout);
  };
}
