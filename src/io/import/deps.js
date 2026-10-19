/** @fileoverview Importer dependency injection — same pattern as initTrashDeps.
 *
 * Extracted from src/io/importer.js when the importer split into
 * src/io/import/*. Mirrors src/views/header/deps.js and src/views/trash/deps.js.
 */

/** Dependencies injected from the main application orchestrator.
 * @typedef {object} ImporterDeps
 * @property {function} persistAndRender - Callback to save state to IndexedDB and
 *   re-render views. Resolves to `{persisted, rendered}` (see src/main.js), or to
 *   nothing for a fire-and-forget stub. `persisted: false` marks a failed cache
 *   write, which the importer rolls back.
 * @property {function} [render] - Re-render the views after state is rolled back.
 *   Persistence is intentionally not retried here: the transaction already failed
 *   to reach storage, and the rollback must only make the in-memory session match
 *   what the next reload will show.
 */
let deps = {
  persistAndRender: () => {},
  render: () => {},
};

/**
 * Initialize importer with necessary side-effect callbacks.
 * Merges so partial injection never clobbers the other callback.
 * @param {ImporterDeps} [injectedDeps]
 * @returns {ImporterDeps} The current deps (for composition/testing).
 */
export function initImporter(injectedDeps = {}) {
  deps = { ...deps, ...injectedDeps };
  return deps;
}

export function getDeps() {
  return deps;
}

export { deps };
