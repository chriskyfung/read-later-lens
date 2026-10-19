/** @fileoverview Header view layer — pure DOM echoes, zero state.
 *
 * Extracted from src/views/header.js when the header view split into
 * src/views/header/*. Never touches `state` or renders views — that is the
 * province of src/views/header/search.js and src/views/header/actions.js.
 * The classList guards keep stub DOMs safe in unit tests.
 */

import { HEADER_IDS } from '../../components/header/constants.js';

/**
 * Show/hide the quick-reset button depending on whether the input has text.
 * @param {string} value - Current search input value.
 */
export function syncClearButton(value) {
  const btn = document.getElementById(HEADER_IDS.clearSearchBtn);
  if (!btn || !btn.classList) return; // classList guard keeps stub DOMs safe
  if (value) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

/** Show/hide the clear-cache spinner icon. @param {boolean} spinning */
export function setClearCacheSpinning(spinning) {
  const icon = document.getElementById(HEADER_IDS.clearCacheIcon);
  if (!icon || !icon.classList) return;
  if (spinning) {
    icon.classList.add('animate-spin');
  } else {
    icon.classList.remove('animate-spin');
  }
}
