/**
 * @fileoverview Header behavior barrel — stable public surface for the split.
 *
 * Importers reach through this facade (src/main.js, tests), not into the
 * individual modules, so the internal file layout can evolve without
 * touching callers.
 */

export { initHeaderDeps, getDeps } from './deps.js';
export { registerHeaderListeners } from './listeners.js';
export { setSearchInputValue } from './actions.js';
export { SEARCH_DEBOUNCE_MS } from './constants.js';
