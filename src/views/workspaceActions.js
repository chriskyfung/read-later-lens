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
 * Delete a single bookmark (generated card data-delete-bookmark).
 * @param {string} id
 */
export function deleteBookmark(id) {
  state.setBookmarks(state.bookmarks.filter((b) => b.id !== id));
  state.selectedIds.delete(id);
  deps.persist();
  deps.render();
  updateBatchActionBar();
  showToast('已成功刪除該筆書籤');
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

  // Batch Delete — monolith order: persist, then render, then batch bar, toast.
  document.getElementById('batchDeleteBtn')?.addEventListener('click', () => {
    state.setBookmarks(state.bookmarks.filter((b) => !state.selectedIds.has(b.id)));
    state.selectedIds.clear();
    deps.persist();
    deps.render();
    updateBatchActionBar();
    showToast('已批量刪除選擇的書籤');
  });

  // Batch Cancel
  document.getElementById('batchCancelBtn')?.addEventListener('click', () => {
    state.selectedIds.clear();
    renderBookmarkCards();
    updateBatchActionBar();
  });

  // Bookmark delete — delegated from bookmark grid
  document.getElementById('bookmarkCardsGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-bookmark]');
    if (btn) deleteBookmark(btn.dataset.deleteBookmark);
  });

  // D3 Zoom Controls (zoom/pan state lives in src/views/linkage.js)
  document.getElementById('zoomInBtn')?.addEventListener('click', () => zoomGraphBy(1.3));
  document.getElementById('zoomOutBtn')?.addEventListener('click', () => zoomGraphBy(1 / 1.3));
  document.getElementById('resetGraphBtn')?.addEventListener('click', () => resetGraphZoom());
}
