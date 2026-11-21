/**
 * @fileoverview Injected side-effect callbacks for the bookmarks views.
 *
 * `persist` and `rerender` orchestrate IndexedDB persistence and a full grid
 * re-render; both live in the app/ orchestration layer (src/app/persist.js,
 * src/app/shell.js). They are injected by src/main.js (same pattern as
 * initSidebarActions / initWorkspaceActions) so the bookmarks feature never
 * imports app/ directly — which would form an import cycle
 * (bookmarks -> app/persist -> app/shell -> bookmarks).
 */

/** @typedef {object} BookmarksDeps
 * @property {function} persist - Fire-and-forget persist after a queue mutation.
 * @property {function} rerender - Re-render the bookmark grid.
 */
let deps = { persist: () => {}, rerender: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initImporter).
 * Merges so partial injection never clobbers the other callback.
 * @param {BookmarksDeps} [injectedDeps]
 * @returns {BookmarksDeps} The current deps (for composition/testing).
 */
export function initBookmarks(injectedDeps = {}) {
  deps = { ...deps, ...injectedDeps };
  return deps;
}

/**
 * @returns {BookmarksDeps} The currently injected deps.
 */
export function getBookmarksDeps() {
  return deps;
}

/**
 * Fire-and-forget persist after a bookmark/queue mutation, via the injected
 * hook. Falls back to a no-op when nothing has been injected yet (e.g. tests
 * that exercise the card markup without booting the app).
 * @returns {void}
 */
export function persistAfterBookmarkAction() {
  deps.persist();
}
