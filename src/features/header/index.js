/** @fileoverview Header feature barrel — presentation + behavior container.
 *
 * External importers (src/app/main.js, tests) reach through this facade,
 * never into components/ or behavior/ internals.
 */

// --- Presentation (markup only) ---
export { mountHeader, headerHtml, HEADER_IDS } from './components';

// --- Behavior (state / events / side-effects) ---
export {
  initHeaderDeps as initHeader,
  getDeps,
  registerHeaderListeners,
  setSearchInputValue,
  SEARCH_DEBOUNCE_MS,
} from './behavior';
