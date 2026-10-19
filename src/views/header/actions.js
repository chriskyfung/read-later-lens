/** @fileoverview Header actions — guard → mutate → persist/render → toast.
 *
 * Extracted from src/views/header.js when the header view split into
 * src/views/header/*. Mirrors src/views/trash/actions.js (same order:
 * gate before mutation, then persist + render + toast).
 *
 * clearSearch() is shared by the domain-chart and word-cloud click-throughs
 * via setSearchInputValue(), so the reset button never gets out of step with
 * the rendered query.
 */

import * as state from '../../core/state.js';
import { stateStillFresh, STALE_STATE_MESSAGE } from '../../core/guard.js';
import { showToast } from '../../utils/dom.js';
import { getDeps } from './deps.js';
import { cancelPendingSearch } from './search.js';
import { syncClearButton, setClearCacheSpinning } from './view.js';
import { HEADER_IDS } from '../../components/header/constants.js';
import { CLEAR_CACHE_CONFIRM, CACHE_CLEARED_TOAST } from './constants.js';

/**
 * Drop pending keystrokes, clear the query and input, hide the reset
 * button, refocus, and re-render — never persists.
 */
export function clearSearch() {
  cancelPendingSearch();
  state.setSearchQuery('');
  const input = document.getElementById(HEADER_IDS.searchInput);
  if (input) {
    input.value = '';
    if (typeof input.focus === 'function') input.focus();
  }
  syncClearButton('');
  getDeps().render();
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
  const input = document.getElementById(HEADER_IDS.searchInput);
  if (!input) return;
  input.value = value;
  syncClearButton(value);
}

/**
 * Clear cache flow: confirm → freshness gate → wipe state in place →
 * persistAndRender → toast (conflict or success). The spinner always unwinds,
 * even when the gate refuses or the save reports a conflict.
 */
export async function clearCache() {
  if (!confirm(CLEAR_CACHE_CONFIRM)) return;

  setClearCacheSpinning(true);

  setTimeout(async () => {
    try {
      // Gate before the only destructive header action: wiping on top of a
      // working set this tab has not seen would strand the other tab's
      // rows in storage while the in-memory session claims they are gone.
      // stateStillFresh() already toasted the refusal — stop there.
      if (!(await stateStillFresh())) return;

      state.setBookmarks([]);
      state.sourceFiles.clear(); // in-place clear (monolith parity)

      // A conflict lost its race between the gate and the save, so the
      // cache still holds the other tab's working set: clear the spinner
      // and say why nothing was wiped instead of claiming success.
      const saved = await getDeps().persistAndRender();
      if (saved && typeof saved === 'object' && saved.conflict === true) {
        showToast(STALE_STATE_MESSAGE);
        return;
      }
      showToast(CACHE_CLEARED_TOAST);
    } finally {
      setClearCacheSpinning(false);
    }
  }, 400);
}
