import { on } from '../../utils/dom';
import { TRASH_IDS } from './constants.js';
import { confirmEmptyTrash, restoreBookmark, confirmPurgeBookmark } from './actions.js';

/**
 * Attach the trash listeners (delegated row actions + empty trash).
 *
 * Register AFTER mountModals() (src/components/modals.js) so the buttons exist.
 * Each call binds once (same as the original); the returned disposer removes
 * exactly the handlers this call added.
 * @returns {function} Disposer that removes both listeners.
 */
export function registerTrashListeners() {
  const onTrashListClick = async (e) => {
    const restoreBtn = e.target.closest('[data-restore-bookmark]');
    if (restoreBtn) {
      await restoreBookmark(restoreBtn.dataset.restoreBookmark);
      return;
    }
    const purgeBtn = e.target.closest('[data-purge-bookmark]');
    if (purgeBtn) {
      await confirmPurgeBookmark(purgeBtn.dataset.purgeBookmark);
    }
  };

  // `on()` warns + returns false when markup is missing instead of throwing,
  // so boot-time registration never aborts sibling bindings. confirmEmptyTrash
  // is bound directly (not wrapped) so dispatchers awaiting the click observe
  // the async empty operation — same as the original addEventListener call.
  on(TRASH_IDS.emptyBtn, 'click', confirmEmptyTrash);
  on(TRASH_IDS.list, 'click', onTrashListClick);

  return () => {
    document.getElementById(TRASH_IDS.emptyBtn)?.removeEventListener('click', confirmEmptyTrash);
    document.getElementById(TRASH_IDS.list)?.removeEventListener('click', onTrashListClick);
  };
}
