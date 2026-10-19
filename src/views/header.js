/**
 * @fileoverview Header behavior — search input (debounced), quick-reset,
 * and clear-cache flows.
 *
 * The behavior now lives in src/views/header/ (constants, deps, search,
 * view, actions, listeners) and this facade re-exports the stable public
 * API so importers (src/main.js, src/views/domains.js, src/views/wordcloud.js,
 * tests) keep working unchanged.
 *
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
 *
 * Layout note: unlike the trash split (src/views/trash/), the header has no
 * open/close lifecycle (no controller — it is always mounted) and no
 * bookmark projection (no service — search queries are not persisted), so
 * those modules are deliberately absent.
 */

export { initHeaderDeps as initHeader, getDeps } from './header/deps.js';
export { SEARCH_DEBOUNCE_MS } from './header/constants.js';
export { setSearchInputValue } from './header/actions.js';
export { registerHeaderListeners } from './header/listeners.js';
