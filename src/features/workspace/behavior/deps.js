/**
 * @fileoverview Injected side-effect callbacks for the workspace views.
 *
 * `persist`/`render` are injected by src/main.js (they orchestrate the
 * IndexedDB save + full re-render); all other dependencies are imported
 * directly from their modules.
 */

/** @typedef {object} WorkspaceActionsDeps
 * @property {function} persist - Save state to IndexedDB and refresh usage UI.
 * @property {function} render - Re-render all views (renderAll).
 */
let deps = { persist: () => {}, render: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initImporter).
 * @param {WorkspaceActionsDeps} [injectedDeps]
 * @returns {WorkspaceActionsDeps} The merged deps.
 */
export function initWorkspaceActions(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
  return deps;
}

/**
 * @returns {WorkspaceActionsDeps} The currently injected deps.
 */
export function getDeps() {
  return deps;
}
