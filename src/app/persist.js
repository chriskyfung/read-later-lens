/**
 * @fileoverview Shared persistence core — save state to IndexedDB and refresh
 * the storage meter. Used by both `persistAndRender` (importer) and
 * `persistAfterAction` (view actions) so the save/conflict/storage-UI logic
 * lives in one place.
 *
 * Never rejects: a failed cache write must never break the UI flow. Returns the
 * write outcome so callers can decide on toasts/rendering.
 *
 * @returns {Promise<{persisted: boolean, conflict: boolean}>}
 */
import { saveState } from '../core/persistence';
import { updateStorageUsageUI, updateQueueBadge } from '@/features/sidebar';
import { showToast } from '../utils/dom';
import { STALE_STATE_MESSAGE } from '../core/guard.js';
import { setPersistError } from '@/core/state';

/** Toast text when a post-action persist write fails for a reason other than a
 * cross-tab conflict (e.g. quota, transaction abort). The conflict case keeps
 * its own message.
 */
export const PERSIST_WRITE_FAILED_MESSAGE = '無法寫入本機快取，剛才的變更可能不會保留';

async function persistCore() {
  let persisted = false;
  let conflict = false;
  try {
    const saved = await saveState();
    persisted = saved !== false && saved?.persisted !== false;
    conflict = saved?.conflict === true;
  } catch (err) {
    console.warn('IndexedDB save failed:', err);
  }

  try {
    await updateStorageUsageUI();
  } catch (err) {
    console.warn('Storage usage update failed:', err);
  }

  return { persisted, conflict };
}

async function persistAndRender(render) {
  const { persisted, conflict } = await persistCore();

  let rendered = false;
  try {
    render();
    rendered = true;
  } catch (err) {
    console.warn('Render failed:', err);
  }

  return { persisted, rendered, conflict };
}

async function persistAfterAction() {
  const { persisted, conflict } = await persistCore();

  if (!persisted && !conflict) {
    showToast(PERSIST_WRITE_FAILED_MESSAGE);
  } else if (conflict) {
    showToast(STALE_STATE_MESSAGE);
  }

  return { persisted, conflict };
}

/**
 * Fire-and-forget persist for non-critical operations (e.g., reading queue mutations).
 * Returns immediately with optimistic success, shows toast on failure.
 * Sets persistError state so the queue badge can surface persistent failure.
 * @returns {Promise<{persisted: boolean, conflict: boolean}>}
 */
export async function persistAfterActionFireAndForget() {
  // Fire-and-forget: don't await the save, let it run in background
  // This avoids blocking the UI thread for 1-3 seconds
  persistCore()
    .then(({ persisted, conflict }) => {
      if (!persisted && !conflict) {
        showToast(PERSIST_WRITE_FAILED_MESSAGE);
        setPersistError(true);
        updateQueueBadge();
      } else if (conflict) {
        showToast(STALE_STATE_MESSAGE);
        setPersistError(true);
        updateQueueBadge();
      } else {
        // Success — clear any previous error
        setPersistError(false);
        updateQueueBadge();
      }
    })
    .catch((err) => {
      console.warn('Persist after action failed:', err);
      setPersistError(true);
      updateQueueBadge();
    });

  // Return immediately with optimistic success
  return { persisted: true, conflict: false };
}

export { persistCore, persistAndRender, persistAfterAction };
