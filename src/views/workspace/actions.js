/**
 * @fileoverview Workspace bookmark actions — soft delete, favorite toggle and
 * batch trash.
 *
 * The side-effect order (gate → mutate → persist → render → batch bar →
 * toast) is preserved verbatim from the monolith.
 */
import * as state from '../../core/state.js';
import { stateStillFresh } from '../../core/guard.js';
import { updateBatchActionBar } from '../bookmarks.js';
import { showToast } from '../../utils/dom.js';
import { getDeps } from './deps.js';
import {
  TRASHED_TOAST,
  FAVORITE_ON_TOAST,
  FAVORITE_OFF_TOAST,
  BATCH_TRASHED_TOAST,
} from './constants.js';

/**
 * Move a single bookmark to the trash (generated card data-delete-bookmark).
 *
 * Soft delete: the record keeps living in `state.bookmarks` with a `deleted_at`
 * stamp, so the trash view can restore it. Only the trash's own permanent
 * actions (src/views/trash.js) and folder deletion remove records for real.
 *
 * @param {string} id
 * @returns {Promise<boolean>} True when a live bookmark was trashed; false when
 *   it was not, or when the action was refused because another tab wrote.
 */
export async function deleteBookmark(id) {
  const bookmark = state.bookmarks.find((b) => b.id === id && !b.deleted_at);
  if (!bookmark) return false;

  // Gate before the mutation: trashing over a working set this tab has not
  // seen would keep rows the other tab just wrote from ever landing.
  if (!(await stateStillFresh())) return false;

  const deps = getDeps();
  state.trashBookmarks([id]);
  state.selectedIds.delete(id);
  deps.persist();
  deps.render();
  updateBatchActionBar();
  showToast(TRASHED_TOAST(bookmark.title));
  return true;
}

/**
 * Toggle one live bookmark's favorite flag (reader 收藏 button).
 *
 * Mirrors deleteBookmark()'s side-effect order (persist, render, batch bar,
 * toast). Trashed and unknown ids are refused without side effects.
 *
 * @param {string} id
 * @returns {boolean} True when a live bookmark was toggled.
 */
export function toggleFavoriteBookmark(id) {
  const bookmark = state.getBookmarkById(id);
  if (!bookmark || bookmark.deleted_at) return false;

  const deps = getDeps();
  const next = state.toggleFavorite(id);
  deps.persist();
  deps.render();
  updateBatchActionBar();
  showToast(next ? FAVORITE_ON_TOAST(bookmark.title) : FAVORITE_OFF_TOAST(bookmark.title));
  return true;
}

/**
 * Trash one bookmark if it is still live (card-grid delete + reader delete).
 *
 * No `confirm()` prompt: the action is reversible from the trash, so the
 * confirmation step now only guards permanent deletions. Kept as a separate
 * exported wrapper for the reader modal and the delegated grid listener.
 *
 * @param {string} id
 * @returns {Promise<boolean>} True when the bookmark was trashed.
 */
export async function confirmDeleteBookmark(id) {
  return deleteBookmark(id);
}

/**
 * Batch-trash every selected bookmark.
 *
 * Mirrors deleteBookmark()'s side-effect order (persist, render, batch bar,
 * toast). Selected ids that are already trashed keep their original stamp.
 *
 * @returns {Promise<boolean>} True when the batch delete ran; false when
 *   nothing was selected, or when refused because another tab wrote.
 */
export async function deleteSelectedBookmarks() {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return false;

  // Gate before the mutation — see deleteBookmark().
  if (!(await stateStillFresh())) return false;

  const deps = getDeps();
  state.trashBookmarks(ids);
  state.selectedIds.clear();
  deps.persist();
  deps.render();
  updateBatchActionBar();
  showToast(BATCH_TRASHED_TOAST(ids.length));
  return true;
}

/**
 * Batch-trash every selected bookmark (batch-delete button).
 *
 * Reversible, so no `confirm()`; 取消 in the batch bar still clears selection
 * without touching the bookmarks.
 *
 * @returns {Promise<boolean>} True when the batch delete ran.
 */
export async function confirmDeleteSelectedBookmarks() {
  return deleteSelectedBookmarks();
}
