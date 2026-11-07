/**
 * @fileoverview Trash feature barrel -- presentation + behavior container.
 *
 * External importers reach through this facade,
 * never into components/ or behavior/ internals.
 */

// --- Presentation (markup only) ---
export {
  trashItemColumns,
  trashItemClass,
  formatDeletedAt,
  trashItemHtml,
  trashModalHtml,
} from './components';

// --- Behavior (state / events / side-effects) ---
export {
  initTrash,
  registerTrashListeners,
  findTrashedBookmark,
  collectTrashIds,
  renderTrashView,
  openTrashModal,
  closeTrashModal,
  restoreBookmark,
  purgeBookmark,
  confirmPurgeBookmark,
  emptyTrash,
  confirmEmptyTrash,
} from './behavior';
