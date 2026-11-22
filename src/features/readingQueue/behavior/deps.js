/**
 * @fileoverview Injected side-effect callbacks for the reading queue views.
 *
 * `persist` is injected by src/main.js (it orchestrates the IndexedDB save
 * via persistAfterActionFireAndForget); the reading queue feature never
 * imports app/ directly — which would form an import cycle
 * (readingQueue -> app/persist -> app/shell -> bookmarks -> readingQueue).
 */

/** @typedef {object} ReadingQueueDeps
 * @property {function} persist - Fire-and-forget persist after a queue mutation.
 */
let deps = { persist: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initBookmarks).
 * Merges so partial injection never clobbers the callback.
 * @param {ReadingQueueDeps} [injectedDeps]
 * @returns {ReadingQueueDeps} The current deps (for composition/testing).
 */
export function initReadingQueue(injectedDeps = {}) {
  deps = { ...deps, ...injectedDeps };
  return deps;
}

/**
 * @returns {ReadingQueueDeps} The currently injected deps.
 */
export function getReadingQueueDeps() {
  return deps;
}

/**
 * Fire-and-forget persist after a reading queue mutation, via the injected
 * hook. Falls back to a no-op when nothing has been injected yet (e.g. tests
 * that exercise the queue markup without booting the app).
 * @returns {void}
 */
export function persistAfterQueueAction() {
  deps.persist();
}
