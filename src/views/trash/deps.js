/** @typedef {object} TrashDeps
 * @property {function} persist - Save state to IndexedDB and refresh usage UI.
 * @property {function} render - Re-render all views (renderAll).
 */
let deps = { persist: () => {}, render: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initSidebarActions).
 * Merges so partial injection never clobbers the other callback.
 * @param {TrashDeps} [injectedDeps]
 * @returns {TrashDeps} The current deps (for composition/testing).
 */
export function initTrashDeps(injectedDeps = {}) {
  deps = { ...deps, ...injectedDeps };
  return deps;
}

export function getDeps() {
  return deps;
}
