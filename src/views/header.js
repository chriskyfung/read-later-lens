/**
 * @fileoverview Header behavior — search input (debounced), quick-reset,
 * and clear-cache flows.
 *
 * Extracted from the monolith's DOMContentLoaded block in index.html.
 * Must be called AFTER mountHeader() (src/components/header.js) so the
 * header elements exist. Listeners for #fileInput and #saveBackBtn remain
 * owned by src/io/importer.js and src/io/exporter.js respectively.
 *
 * Search execution model: full re-renders are too expensive to run on every
 * keystroke (visible input lag on large datasets), so non-empty queries are
 * debounced (SEARCH_DEBOUNCE_MS) and applied once typing pauses. Enter
 * applies immediately (IME-safe), and clearing applies immediately so a
 * reset never feels laggy. Typing itself only updates cheap UI echoes
 * (input text, quick-reset button visibility) — never state or rendering.
 */

import * as state from '../core/state.js';
import { showToast } from '../utils/dom.js';

/** Delay (ms) between the last keystroke and applying the search. */
export const SEARCH_DEBOUNCE_MS = 300;

/** @typedef {object} HeaderDeps
 * @property {function} render - Re-render all views (search does NOT persist, monolith parity).
 * @property {function} persistAndRender - Save state to IndexedDB and re-render views.
 */
let deps = { render: () => {}, persistAndRender: () => {} };

/** @type {ReturnType<typeof setTimeout> | null} */
let searchDebounceTimer = null;

/**
 * Inject side-effect callbacks (same pattern as initImporter).
 * @param {HeaderDeps} injectedDeps
 */
export function initHeader(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * Show/hide the quick-reset button depending on whether the input has text.
 * @param {string} value - Current search input value.
 */
function syncClearButton(value) {
  const btn = document.getElementById('clearSearchBtn');
  if (!btn || !btn.classList) return; // classList guard keeps stub DOMs safe
  if (value) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

/**
 * Cancel a pending debounced search, if any.
 */
function cancelPendingSearch() {
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
}

/**
 * Execute the search now: read the current input value into state and
 * re-render. Single source of truth for "apply a search".
 */
function applySearch() {
  cancelPendingSearch();
  const input = document.getElementById('searchInput');
  const value = input ? input.value : '';
  state.setSearchQuery(value);
  syncClearButton(value);
  deps.render();
}

/**
 * Programmatically set the search input value and keep the quick-reset
 * button in sync. Shared by the domain-chart and word-cloud click-throughs
 * so the reset button never gets out of step with the rendered query.
 * Any pending debounced keystrokes are discarded — the programmatic value
 * replaces whatever the user was typing.
 * @param {string} value
 */
export function setSearchInputValue(value) {
  cancelPendingSearch();
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.value = value;
  syncClearButton(value);
}

/**
 * Attach the search-input (debounced + Enter), quick-reset, and
 * clear-cache handlers.
 */
export function registerHeaderListeners() {
  // Search input — typing only updates cheap UI echoes; the expensive
  // state write + render is debounced (or triggered by Enter / clearing).
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const value = e.target.value;
    syncClearButton(value); // instant echo — no render
    cancelPendingSearch();
    if (value === '') {
      // Clearing applies immediately — a reset should never lag.
      applySearch();
    } else {
      searchDebounceTimer = setTimeout(applySearch, SEARCH_DEBOUNCE_MS);
    }
  });

  // Enter — apply the search immediately (cancels any pending debounce).
  // IME guard: confirming a zh-TW candidate must NOT trigger a search.
  document.getElementById('searchInput')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.isComposing || e.keyCode === 229) return;
    applySearch();
  });

  // Quick-reset button — drops pending keystrokes, clears the query and
  // input, hides itself, refocuses, and re-renders (never persists).
  document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
    cancelPendingSearch();
    state.setSearchQuery('');
    const input = document.getElementById('searchInput');
    if (input) {
      input.value = '';
      if (typeof input.focus === 'function') input.focus();
    }
    syncClearButton('');
    deps.render();
  });

  // Clear cache button
  document.getElementById('clearCacheBtn')?.addEventListener('click', () => {
    if (confirm('確定要清除 IndexedDB 中的本地快取書籤資料嗎？')) {
      const icon = document.getElementById('clearCacheIcon');
      icon.classList.add('animate-spin');

      setTimeout(() => {
        state.setBookmarks([]);
        state.sourceFiles.clear(); // in-place clear (monolith parity)
        deps.persistAndRender();
        icon.classList.remove('animate-spin');
        showToast('已成功清空本地快取');
      }, 400);
    }
  });
}
