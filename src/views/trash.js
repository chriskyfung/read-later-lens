/**
 * @fileoverview Trash (回收桶) view — the flat, unfiltered list of soft-deleted
 * bookmarks, plus restore / permanent-delete / empty-trash actions.
 *
 * Design notes (see the soft-delete plan):
 *  - The trash is a *projection* over `deleted_at`, not a second store, so it
 *    survives reloads through the existing IndexedDB bookmark blob.
 *  - The list is intentionally flat and unfiltered (ignores activeFolder /
 *    activeLang / activeTag / searchQuery) — simple and robust. Reusing the
 *    header filters (with in-place dimming of non-matching rows) is a backlog item.
 *  - Folder deletion is deliberately NOT soft: deleteFolder() purges a file's
 *    trashed bookmarks too, so a trashed bookmark can never outlive its source
 *    file and "restore into a deleted folder" is impossible by construction.
 *
 * `persist`/`render` are injected by src/main.js, mirroring sidebarActions and
 * workspaceActions.
 */

import * as state from '../core/state.js';
import { getTrashedBookmarks } from '../core/filters.js';
import { showToast } from '../utils/dom.js';
import { trashItemClass, trashItemHtml } from '../components/bookmarks/trashPanel.js';

/** @typedef {object} TrashDeps
 * @property {function} persist - Save state to IndexedDB and refresh usage UI.
 * @property {function} render - Re-render all views (renderAll).
 */
let deps = { persist: () => {}, render: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initWorkspaceActions).
 * @param {TrashDeps} injectedDeps
 */
export function initTrash(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * Build a single trashed-bookmark row and wire its dataset ids.
 *
 * @param {import('../model/BookmarkRecord.js').BookmarkRecord} bookmark
 * @returns {HTMLDivElement}
 */
export function createTrashItem(bookmark) {
  const item = document.createElement('div');
  item.className = trashItemClass();
  item.innerHTML = trashItemHtml(bookmark);
  item.querySelector('[data-restore-bookmark]').dataset.restoreBookmark = bookmark.id;
  item.querySelector('[data-purge-bookmark]').dataset.purgeBookmark = bookmark.id;
  return item;
}

/**
 * Render the trash panel (and hide the bookmark grid / empty state).
 *
 * Also owns the shared grid header (`#filteredCount`, `#selectAllCheckbox`,
 * `#activeFilterSummary`) while the trash is active, because the active-filter
 * pipeline yields nothing for the 'TRASH' pseudo-folder.
 */
export function renderTrashView() {
  const panel = document.getElementById('trashPanel');
  const list = document.getElementById('trashList');
  if (!panel || !list) return;

  const grid = document.getElementById('bookmarkCardsGrid');
  const emptyState = document.getElementById('emptyState');
  const trashEmptyState = document.getElementById('trashEmptyState');
  const summary = document.getElementById('trashSummary');

  panel.classList.remove('hidden');
  grid?.classList.add('hidden');
  emptyState?.classList.add('hidden');

  const trashed = getTrashedBookmarks();

  if (summary) summary.innerText = `共 ${trashed.length} 筆`;
  const filteredCount = document.getElementById('filteredCount');
  if (filteredCount) filteredCount.innerText = String(trashed.length);
  const selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll) selectAll.checked = false;
  const filterSummary = document.getElementById('activeFilterSummary');
  if (filterSummary) filterSummary.innerText = `目前分類: 回收桶 | 符合: ${trashed.length} 筆`;

  list.innerHTML = '';
  if (trashed.length === 0) {
    trashEmptyState?.classList.remove('hidden');
    return;
  }
  trashEmptyState?.classList.add('hidden');
  trashed.forEach((b) => list.appendChild(createTrashItem(b)));
}

/**
 * Restore one bookmark from the trash (clears `deleted_at`).
 *
 * @param {string} id
 * @returns {boolean} True when a trashed bookmark was restored.
 */
export function restoreBookmark(id) {
  const bookmark = state.bookmarks.find((b) => b.id === id && b.deleted_at);
  if (!bookmark) return false;

  state.restoreBookmarks([id]);
  state.selectedIds.delete(id);
  deps.persist();
  deps.render();
  showToast(`已還原書籤「${bookmark.title}」`);
  return true;
}

/**
 * Permanently remove one bookmark from the trash.
 *
 * @param {string} id
 * @returns {boolean} True when the record was purged.
 */
export function purgeBookmark(id) {
  const bookmark = state.bookmarks.find((b) => b.id === id);
  if (!bookmark) return false;

  state.purgeBookmarks([id]);
  state.selectedIds.delete(id);
  deps.persist();
  deps.render();
  showToast('已永久刪除該筆書籤');
  return true;
}

/**
 * Confirm, then permanently remove one bookmark.
 *
 * @param {string} id
 * @returns {boolean} True when the record was purged.
 */
export function confirmPurgeBookmark(id) {
  const bookmark = state.bookmarks.find((b) => b.id === id);
  if (!confirm(`確定要永久刪除書籤「${bookmark ? bookmark.title : ''}」嗎？此動作無法復原。`)) {
    return false;
  }
  return purgeBookmark(id);
}

/**
 * Permanently remove every trashed bookmark.
 *
 * @returns {boolean} True when at least one record was purged.
 */
export function emptyTrash() {
  const ids = getTrashedBookmarks().map((b) => b.id);
  if (ids.length === 0) return false;

  state.purgeBookmarks(ids);
  ids.forEach((id) => state.selectedIds.delete(id));
  deps.persist();
  deps.render();
  showToast(`已清空回收桶（${ids.length} 筆）`);
  return true;
}

/**
 * Confirm, then permanently remove every trashed bookmark.
 *
 * @returns {boolean} True when the trash was emptied.
 */
export function confirmEmptyTrash() {
  const count = getTrashedBookmarks().length;
  if (count === 0) return false;
  if (!confirm(`確定要永久刪除回收桶中的 ${count} 筆書籤嗎？此動作無法復原。`)) {
    return false;
  }
  return emptyTrash();
}

/**
 * Attach the trash listeners (delegated row actions + empty trash).
 *
 * Register AFTER mountWorkspace() (src/components/workspace.js).
 */
export function registerTrashListeners() {
  document.getElementById('emptyTrashBtn')?.addEventListener('click', confirmEmptyTrash);

  document.getElementById('trashList')?.addEventListener('click', (e) => {
    const restoreBtn = e.target.closest('[data-restore-bookmark]');
    if (restoreBtn) {
      restoreBookmark(restoreBtn.dataset.restoreBookmark);
      return;
    }
    const purgeBtn = e.target.closest('[data-purge-bookmark]');
    if (purgeBtn) confirmPurgeBookmark(purgeBtn.dataset.purgeBookmark);
  });
}
