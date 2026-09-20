/**
 * @fileoverview Workspace actions — tab switching, sorting, select-all and
 * batch operations, and the D3 graph zoom controls.
 *
 * Extracted from the monolith's DOMContentLoaded block in index.html.
 * Must be registered AFTER mountWorkspace() (src/components/workspace.js).
 *
 * `persist`/`render` are injected by src/main.js (they orchestrate the
 * IndexedDB save + full re-render); all other dependencies are imported
 * directly from their modules.
 */

import * as state from '../core/state.js';
import { getFilteredBookmarks } from '../core/filters.js';
import { renderBookmarkCards, updateBatchActionBar } from './bookmarks.js';
import { activateTab } from './tabs.js';
import { renderWordCloud } from './wordcloud.js';
import { renderDomainChart } from './domains.js';
import { renderConceptLinkageGraph, zoomGraphBy, resetGraphZoom } from './linkage.js';
import { showToast } from '../utils/dom.js';

/** @typedef {object} WorkspaceActionsDeps
 * @property {function} persist - Save state to IndexedDB and refresh usage UI.
 * @property {function} render - Re-render all views (renderAll).
 */
let deps = { persist: () => {}, render: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initImporter).
 * @param {WorkspaceActionsDeps} injectedDeps
 */
export function initWorkspaceActions(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * Activate a tab and lazily render heavy panel content.
 * Called by the registered tab-button listeners.
 * @param {string} tabId
 */
export function switchTab(tabId) {
  activateTab(tabId);
  if (tabId === 'wordcloud') renderWordCloud();
  if (tabId === 'domains') renderDomainChart();
  if (tabId === 'linkage') renderConceptLinkageGraph();
}

/**
 * Move a single bookmark to the trash (generated card data-delete-bookmark).
 *
 * Soft delete: the record keeps living in `state.bookmarks` with a `deleted_at`
 * stamp, so the trash view can restore it. Only the trash's own permanent
 * actions (src/views/trash.js) and folder deletion remove records for real.
 *
 * @param {string} id
 * @returns {boolean} True when a live bookmark was trashed.
 */
export function deleteBookmark(id) {
  const bookmark = state.bookmarks.find((b) => b.id === id && !b.deleted_at);
  if (!bookmark) return false;

  state.trashBookmarks([id]);
  state.selectedIds.delete(id);
  deps.persist();
  deps.render();
  updateBatchActionBar();
  showToast(`已將書籤「${bookmark.title}」移至回收桶`);
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
 * @returns {boolean} True when the bookmark was trashed.
 */
export function confirmDeleteBookmark(id) {
  return deleteBookmark(id);
}

/**
 * Batch-trash every selected bookmark.
 *
 * Mirrors deleteBookmark()'s side-effect order (persist, render, batch bar,
 * toast). Selected ids that are already trashed keep their original stamp.
 */
export function deleteSelectedBookmarks() {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return false;

  state.trashBookmarks(ids);
  state.selectedIds.clear();
  deps.persist();
  deps.render();
  updateBatchActionBar();
  showToast(`已將 ${ids.length} 筆書籤移至回收桶`);
  return true;
}

/**
 * Batch-trash every selected bookmark (batch-delete button).
 *
 * Reversible, so no `confirm()`; 取消 in the batch bar still clears selection
 * without touching the bookmarks.
 *
 * @returns {boolean} True when the batch delete ran.
 */
export function confirmDeleteSelectedBookmarks() {
  return deleteSelectedBookmarks();
}

/**
 * Attach the workspace listeners (sort, tabs, select-all, batch, zoom).
 */
export function registerWorkspaceListeners() {
  // Sort dropdown — monolith parity: sets sort and re-renders only.
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.setSortBy(e.target.value);
    deps.render();
  });

  // Tab switcher delegation
  document.querySelectorAll('.main-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Select All checkbox
  document.getElementById('selectAllCheckbox')?.addEventListener('change', (e) => {
    const filtered = getFilteredBookmarks();
    if (e.target.checked) {
      filtered.forEach((b) => state.selectedIds.add(b.id));
    } else {
      state.selectedIds.clear();
    }
    renderBookmarkCards();
    updateBatchActionBar();
  });

  // Batch Delete — confirm first, then the extracted monolith-order body.
  document
    .getElementById('batchDeleteBtn')
    ?.addEventListener('click', confirmDeleteSelectedBookmarks);

  // Batch Cancel
  document.getElementById('batchCancelBtn')?.addEventListener('click', () => {
    state.selectedIds.clear();
    renderBookmarkCards();
    updateBatchActionBar();
  });

  // Bookmark delete — delegated from bookmark grid (confirm first).
  document.getElementById('bookmarkCardsGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-bookmark]');
    if (btn) confirmDeleteBookmark(btn.dataset.deleteBookmark);
  });

  // D3 Zoom Controls (zoom/pan state lives in src/views/linkage.js)
  document.getElementById('zoomInBtn')?.addEventListener('click', () => zoomGraphBy(1.3));
  document.getElementById('zoomOutBtn')?.addEventListener('click', () => zoomGraphBy(1 / 1.3));
  document.getElementById('resetGraphBtn')?.addEventListener('click', () => resetGraphZoom());
}
