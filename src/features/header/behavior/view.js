/**
 * @fileoverview Header view layer — pure DOM echoes, zero state.
 *
 * Never touches `state` or renders views — that is the province of
 * ./search.js and ./actions.js.
 * The classList guards keep stub DOMs safe in unit tests.
 */

import { HEADER_IDS } from '../components/constants.js';

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

/** Position and show the search help tooltip. */
export function showSearchHelpTooltip() {
  const tooltip = document.getElementById(HEADER_IDS.searchHelpTooltip);
  const trigger = document.getElementById(HEADER_IDS.searchHelpBtn);
  if (!tooltip || !trigger) return;

  const rect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  // Position above trigger, centered horizontally
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  const viewportPadding = 8;
  left = Math.max(
    viewportPadding,
    Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding),
  );

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${rect.top - tooltipRect.height - 8}px`;
  tooltip.classList.remove('hidden');
}

/** Hide the search help tooltip. */
export function hideSearchHelpTooltip() {
  const tooltip = document.getElementById(HEADER_IDS.searchHelpTooltip);
  if (!tooltip) return;
  tooltip.classList.add('hidden');
  tooltip.style.left = '';
  tooltip.style.top = '';
}
