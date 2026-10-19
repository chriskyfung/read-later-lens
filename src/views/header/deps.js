/** @fileoverview Header dependency injection — same pattern as initTrashDeps.
 *
 * Extracted from src/views/header.js when the header view split into
 * src/views/header/*. Mirrors src/views/trash/deps.js.
 */

/** @typedef {object} HeaderDeps
 * @property {function} render - Re-render all views (search does NOT persist, monolith parity).
 * @property {function} persistAndRender - Save state to IndexedDB and re-render views.
 */
let deps = { render: () => {}, persistAndRender: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initImporter / initTrashDeps).
 * Merges so partial injection never clobbers the other callback.
 * @param {HeaderDeps} [injectedDeps]
 * @returns {HeaderDeps} The current deps (for composition/testing).
 */
export function initHeaderDeps(injectedDeps = {}) {
  deps = { ...deps, ...injectedDeps };
  return deps;
}

export function getDeps() {
  return deps;
}
