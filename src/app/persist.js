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
import { saveState } from '../core/store';
import { updateStorageUsageUI } from '../views/sidebar';
import { showToast } from '../utils/dom';
import { STALE_STATE_MESSAGE } from '../core/guard.js';
import { renderAll } from '../views/main-view.js';

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

async function persistAndRender() {
  const { persisted, conflict } = await persistCore();

  let rendered = false;
  try {
    renderAll();
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

export { persistCore, persistAndRender, persistAfterAction };
