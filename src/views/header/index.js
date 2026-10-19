/**
 * @fileoverview Header behavior barrel — stable public surface for the split.
 *
 * Importers reach through this facade (src/main.js, src/views/domains.js,
 * src/views/wordcloud.js, tests), not into the individual modules, so the
 * internal file layout can evolve without touching callers. Mirrors
 * src/views/trash.js.
 *
 * Layout note: unlike the trash split, the header has no open/close
 * lifecycle (no controller — it is always mounted) and no bookmark
 * projection (no service — search queries are not persisted), so those
 * modules are deliberately absent.
 */

export { initHeaderDeps as initHeader, getDeps } from './deps.js';
export { SEARCH_DEBOUNCE_MS } from './constants.js';
export { setSearchInputValue } from './actions.js';
export { registerHeaderListeners } from './listeners.js';
