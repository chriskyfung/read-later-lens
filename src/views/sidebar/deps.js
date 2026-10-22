/**
 * @fileoverview Sidebar dependency injection — same pattern as
 * initTrashDeps (src/views/trash/deps.js).
 *
 * Extracted from src/views/sidebarActions.js when the sidebar split into
 * src/views/sidebar/*.
 */

/** @typedef {object} SidebarActionsDeps
 * @property {function} persist - Save state to IndexedDB and refresh usage UI.
 * @property {function} render - Re-render all views (no persistence).
 */
let deps = { persist: () => {}, render: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initImporter).
 * Merges so partial injection never clobbers the other callback.
 * @param {SidebarActionsDeps} [injectedDeps]
 * @returns {SidebarActionsDeps} The current deps (for composition/testing).
 */
export function initSidebarActions(injectedDeps = {}) {
  deps = { ...deps, ...injectedDeps };
  return deps;
}

/**
 * @returns {SidebarActionsDeps} The current deps.
 */
export function getDeps() {
  return deps;
}
