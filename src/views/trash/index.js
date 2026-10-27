/**
 * @fileoverview Trash view barrel — stable public surface for the split.
 *
 * Importers reach through this barrel (src/views/trash/index.js), not into the
 * individual modules, so the internal file layout can evolve without touching
 * callers.
 */

export { initTrashDeps as initTrash, getDeps } from './deps.js';
export { findTrashedBookmark, collectTrashIds } from './service.js';
export { renderTrashView } from './view.js';
export { openTrashModal, closeTrashModal } from './controller.js';
export {
  restoreBookmark,
  purgeBookmark,
  confirmPurgeBookmark,
  emptyTrash,
  confirmEmptyTrash,
} from './actions.js';
export { registerTrashListeners } from './listeners.js';
