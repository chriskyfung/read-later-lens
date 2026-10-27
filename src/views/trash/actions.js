import * as state from '../../core/state.js';
import { getTrashedBookmarks } from '../../core/filters.js';
import { stateStillFresh } from '../../core/guard.js';
import { showToast } from '../../utils/dom';
import { getDeps } from './deps.js';
import { findTrashedBookmark, collectTrashIds } from './service.js';
import { renderTrashView, patchTrashRow, captureDomRowCount } from './view.js';
import { restoreToast, PURGE_TOAST, emptyToast, purgeConfirm, emptyConfirm } from './constants.js';

/**
 * Shared post-mutation sync: selection cleanup is done by callers (single id
 * vs. batch), then persist → render → trash re-render → toast, in the exact
 * order the monolith used.
 *
 * `patchId` opts into the single-row repaint path: the row for that id is
 * removed (and `restoredRow` prepended when restoring) instead of rebuilding
 * the whole list. Any drift detected by patchTrashRow() falls back to the full
 * render, so the screen can never disagree with state.
 */
function syncAfterMutation(toast) {
  const deps = getDeps();
  deps.persist();
  deps.render();
  renderTrashView();
  showToast(toast);
}

/**
 * Post-mutation sync for a single-row trash mutation: same order as
 * syncAfterMutation, but the trash list is patched (one row removed) instead
 * of rebuilt. `domRowsBefore` must be captured via captureDomRowCount() BEFORE
 * the state mutation; any drift the patch detects falls back to the full
 * render, so the screen can never disagree with state.
 */
function syncAfterSingleRowMutation(toast, id, domRowsBefore) {
  const deps = getDeps();
  deps.persist();
  deps.render();
  if (!patchTrashRow(id, domRowsBefore, getTrashedBookmarks().length)) {
    renderTrashView();
  }
  showToast(toast);
}

/**
 * Restore one bookmark from the trash (clears `deleted_at`).
 * @param {string} id
 * @returns {Promise<boolean>} True when a trashed bookmark was restored; false
 *   when it was not, or when the action was refused because another tab wrote.
 */
export async function restoreBookmark(id) {
  const bookmark = findTrashedBookmark(id);
  if (!bookmark) return false;

  // Gate before the mutation: see deleteBookmark() in workspaceActions.js.
  if (!(await stateStillFresh())) return false;

  // Snapshot the visible row count BEFORE mutating so the single-row patch
  // path can detect any drift against the new projection (see patchTrashRow).
  const domRowsBefore = captureDomRowCount();

  state.restoreBookmarks([id]);
  state.selectedIds.delete(id);
  // Restoring leaves the trash projection: the row is simply removed (the
  // restored bookmark reappears in the grid behind via renderAll above).
  syncAfterSingleRowMutation(restoreToast(bookmark.title), id, domRowsBefore);
  return true;
}

/**
 * Permanently remove one bookmark from the trash.
 * @param {string} id
 * @returns {Promise<boolean>} True when the record was purged.
 */
export async function purgeBookmark(id) {
  const bookmark = findTrashedBookmark(id);
  if (!bookmark) return false;

  // Purging is irreversible, so this is the most expensive place to act on a
  // working set another tab has already changed.
  if (!(await stateStillFresh())) return false;

  const domRowsBefore = captureDomRowCount();
  state.purgeBookmarks([id]);
  state.selectedIds.delete(id);
  syncAfterSingleRowMutation(PURGE_TOAST, id, domRowsBefore);
  return true;
}

/**
 * Confirm, then permanently remove one bookmark.
 * @param {string} id
 * @returns {Promise<boolean>} True when the record was purged.
 */
export async function confirmPurgeBookmark(id) {
  const bookmark = findTrashedBookmark(id);
  if (!bookmark) return false;

  // Gate before the prompt: this is irreversible, so never ask the user to
  // confirm a delete this tab cannot honour. purgeBookmark re-gates.
  if (!(await stateStillFresh())) return false;

  if (!confirm(purgeConfirm(bookmark.title))) {
    return false;
  }
  return purgeBookmark(id);
}

/**
 * Permanently remove every trashed bookmark.
 * @returns {Promise<boolean>} True when at least one record was purged.
 */
export async function emptyTrash() {
  const ids = collectTrashIds();
  if (ids.length === 0) return false;

  // Gate before the mutation: see deleteBookmark() in workspaceActions.js.
  if (!(await stateStillFresh())) return false;

  state.purgeBookmarks(ids);
  ids.forEach((id) => state.selectedIds.delete(id));
  syncAfterMutation(emptyToast(ids.length));
  return true;
}

/**
 * Confirm, then permanently remove every trashed bookmark.
 * @returns {Promise<boolean>} True when the trash was emptied.
 */
export async function confirmEmptyTrash() {
  const count = getTrashedBookmarks().length;
  if (count === 0) return false;

  // Gate before the prompt so the count asked about is the count this tab can
  // still honour; emptyTrash re-gates.
  if (!(await stateStillFresh())) return false;

  if (!confirm(emptyConfirm(count))) {
    return false;
  }
  return emptyTrash();
}
