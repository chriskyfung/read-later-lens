/**
 * @fileoverview Trash (回收桶) view — the flat, unfiltered projection of
 * soft-deleted bookmarks, plus restore / permanent-delete / empty-trash
 * actions.
 *
 * Design notes (soft-delete plan):
 *  - The trash is a *projection* over `deleted_at`, not a second store, so it
 *    survives reloads through the existing IndexedDB bookmark blob.
 *  - The list lives in a dedicated modal (src/components/bookmarks/trashModal.js,
 *    opened from the sidebar's 回收桶 row in src/views/sidebarActions.js). The
 *    grid behind it stays mounted, so the modal keeps the current folder,
 *    language, tag and search context; it is intentionally flat and unfiltered
 *    (ignores activeFolder / activeLang / activeTag / searchQuery) — simple and
 *    robust. Reusing the header filters with in-place dimming of non-matching
 *    rows is a backlog item.
 *  - The modal rides the shared layer stack (src/utils/dom.js), so Escape
 *    unwinds it, Tab stays trapped inside it, and close restores focus to the
 *    sidebar row that opened it.
 *  - Folder deletion is deliberately NOT soft: deleteFolder() purges a file's
 *    trashed bookmarks too, so a trashed record can never outlive its source
 *    file and "restore into a deleted folder" is impossible by construction.
 *
 * `persist`/`render` are injected by src/main.js, mirroring sidebarActions and
 * workspaceActions.
 */
import * as state from '../core/state.js';
import { getTrashedBookmarks } from '../core/filters.js';
import { stateStillFresh } from '../core/guard.js';
import { showToast } from '../utils/dom.js';
import { trashItemHtml } from '../components/bookmarks/trashModal.js';
import { pushLayer, popLayer } from '../utils/dom.js';

/** @typedef {object} TrashDeps
 * @property {function} persist - Save state to IndexedDB and refresh usage UI.
 * @property {function} render - Re-render all views (renderAll).
 */
let deps = { persist: () => {}, render: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initSidebarActions).
 * @param {TrashDeps} injectedDeps
 */
export function initTrash(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * Render the modal's list + summary + empty state. Pure DOM orchestration:
 * never touches the bookmark grid or the sidebar — the trash lives in its own
 * modal, so those stay exactly as the current folder/langs/tag/search view
 * leaves them.
 */
export function renderTrashView() {
  const list = document.getElementById('trashList');
  const summary = document.getElementById('trashSummary');
  const emptyState = document.getElementById('trashEmptyState');
  if (!list || !summary || !emptyState) return;

  const trashed = getTrashedBookmarks();

  list.innerHTML = '';
  summary.textContent = `共 ${trashed.length} 筆`;

  if (trashed.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  list.innerHTML = trashed.map((bookmark) => trashItemHtml(bookmark)).join('');
}

/**
 * Open the trash modal on top of whatever is on screen. The list renders
 * before the push so it is fresh even when another overlay is stacked on top;
 * closeTrashModal() restores focus to the sidebar row that opened it.
 */
export function openTrashModal() {
  renderTrashView();
  pushLayer('trashModal', { restore: renderTrashView });
}

/** Close the trash modal, revealing whatever layer sits beneath it. */
export function closeTrashModal() {
  popLayer('trashModal');
}

/**
 * Restore one bookmark from the trash (clears `deleted_at`).
 * @param {string} id
 * @returns {Promise<boolean>} True when a trashed bookmark was restored; false
 *   when it was not, or when the action was refused because another tab wrote.
 */
export async function restoreBookmark(id) {
  const bookmark = state.bookmarks.find((b) => b.id === id && b.deleted_at);
  if (!bookmark) return false;

  // Gate before the mutation: see deleteBookmark() in workspaceActions.js.
  if (!(await stateStillFresh())) return false;

  state.restoreBookmarks([id]);
  state.selectedIds.delete(id);
  deps.persist();
  deps.render();
  renderTrashView();
  showToast(`已還原書籤「${bookmark.title}」`);
  return true;
}

/**
 * Permanently remove one bookmark from the trash.
 * @param {string} id
 * @returns {Promise<boolean>} True when the record was purged.
 */
export async function purgeBookmark(id) {
  const bookmark = state.bookmarks.find((b) => b.id === id);
  if (!bookmark) return false;

  // Purging is irreversible, so this is the most expensive place to act on a
  // working set another tab has already changed.
  if (!(await stateStillFresh())) return false;

  state.purgeBookmarks([id]);
  state.selectedIds.delete(id);
  deps.persist();
  deps.render();
  renderTrashView();
  showToast('已永久刪除該筆書籤');
  return true;
}

/**
 * Confirm, then permanently remove one bookmark.
 * @param {string} id
 * @returns {Promise<boolean>} True when the record was purged.
 */
export async function confirmPurgeBookmark(id) {
  const bookmark = state.bookmarks.find((b) => b.id === id);
  if (!confirm(`確定要永久刪除書籤「${bookmark ? bookmark.title : ''}」嗎？此動作無法復原。`)) {
    return false;
  }
  return purgeBookmark(id);
}

/**
 * Permanently remove every trashed bookmark.
 * @returns {Promise<boolean>} True when at least one record was purged.
 */
export async function emptyTrash() {
  const ids = getTrashedBookmarks().map((b) => b.id);
  if (ids.length === 0) return false;

  // Gate before the mutation: see deleteBookmark() in workspaceActions.js.
  if (!(await stateStillFresh())) return false;

  state.purgeBookmarks(ids);
  ids.forEach((id) => state.selectedIds.delete(id));
  deps.persist();
  deps.render();
  renderTrashView();
  showToast(`已清空回收桶（${ids.length} 筆）`);
  return true;
}

/**
 * Confirm, then permanently remove every trashed bookmark.
 * @returns {Promise<boolean>} True when the trash was emptied.
 */
export async function confirmEmptyTrash() {
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
 * Register AFTER mountModals() (src/components/modals.js) so the buttons exist.
 */
export function registerTrashListeners() {
  document.getElementById('emptyTrashBtn')?.addEventListener('click', confirmEmptyTrash);

  document.getElementById('trashList')?.addEventListener('click', async (e) => {
    const restoreBtn = e.target.closest('[data-restore-bookmark]');
    if (restoreBtn) {
      await restoreBookmark(restoreBtn.dataset.restoreBookmark);
      return;
    }
    const purgeBtn = e.target.closest('[data-purge-bookmark]');
    if (purgeBtn) {
      await confirmPurgeBookmark(purgeBtn.dataset.purgeBookmark);
    }
  });
}
