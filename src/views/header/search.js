/** @fileoverview Header search lifecycle — debounce timer and apply.
 *
 * Extracted from src/views/header.js when the header view split into
 * src/views/header/*. Owns the single searchDebounceTimer so the timer can
 * never have two owners (the drift class that patchTrashRow() guards against
 * in src/views/trash/view.js).
 *
 * Search execution model: full re-renders are too expensive to run on every
 * keystroke (visible input lag on large datasets), so non-empty queries are
 * debounced (SEARCH_DEBOUNCE_MS) and applied once typing pauses. Enter
 * applies immediately (IME-safe), and clearing applies immediately so a
 * reset never feels laggy.
 */

import * as state from '../../core/state';
import { getDeps } from './deps.js';
import { syncClearButton } from './view.js';
import { HEADER_IDS } from '../../components/header/constants.js';
import { SEARCH_DEBOUNCE_MS } from './constants.js';

/** @type {ReturnType<typeof setTimeout> | null} */
let searchDebounceTimer = null;

/** Cancel a pending debounced search, if any. */
export function cancelPendingSearch() {
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
}

/** Schedule a debounced search to run once typing pauses. */
export function scheduleSearch() {
  cancelPendingSearch();
  searchDebounceTimer = setTimeout(applySearch, SEARCH_DEBOUNCE_MS);
}

/**
 * Execute the search now: read the current input value into state and
 * re-render. Single source of truth for "apply a search" — debounce expiry,
 * Enter, and clearing the input all route through here. Search never
 * persists to IndexedDB (monolith parity).
 */
export function applySearch() {
  cancelPendingSearch();
  const input = document.getElementById(HEADER_IDS.searchInput);
  const value = input ? input.value : '';
  state.setSearchQuery(value);
  syncClearButton(value);
  getDeps().render();
}
