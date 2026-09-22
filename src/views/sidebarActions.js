/**
 * @fileoverview Sidebar actions — folder select/delete, language filters,
 * and the IndexedDB storage usage indicator.
 *
 * Extracted from the monolith's inline script in index.html.
 * Register listeners AFTER mountSidebar() (src/components/sidebar/panel.js).
 */

import * as state from '../core/state.js';
import { getStorageUsage } from '../core/store.js';
import { showToast } from '../utils/dom.js';

/** @typedef {object} SidebarActionsDeps
 * @property {function} persist - Save state to IndexedDB and refresh usage UI.
 * @property {function} render - Re-render all views (no persistence).
 */
let deps = { persist: () => {}, render: () => {} };

/**
 * Inject side-effect callbacks (same pattern as initImporter).
 * @param {SidebarActionsDeps} injectedDeps
 */
export function initSidebarActions(injectedDeps) {
  deps = { ...deps, ...injectedDeps };
}

/**
 * Refresh the storage usage indicator in the sidebar.
 */
export async function updateStorageUsageUI() {
  const { usageKB, limitMB } = await getStorageUsage();
  document.getElementById('storageUsageText').innerText = `${usageKB} KB / ${limitMB} MB`;
  const pct = Math.min(100, (usageKB / (limitMB * 1024)) * 100);
  document.getElementById('storageProgressBar').style.width = `${pct}%`;
}

/**
 * Select a source folder (generated row data-select-folder).
 * @param {string} folderId
 */
export function selectFolder(folderId) {
  state.setActiveFolder(folderId);
  deps.render();
}

/**
 * Confirm and delete a source file with its bookmarks (generated row data-delete-folder).
 * @param {Event} e
 * @param {string} fileId
 */
export function confirmDeleteFolder(e, fileId) {
  e.stopPropagation();
  const file = state.sourceFiles.get(fileId);
  if (confirm(`確定要刪除檔案「${file ? file.name : ''}」與其包含的所有書籤嗎？`)) {
    deleteFolder(fileId);
  }
}

/**
 * Remove a source file and its bookmarks (monolith side-effect order).
 * @param {string} fileId
 * @param {boolean} [triggerRender=true]
 */
export function deleteFolder(fileId, triggerRender = true) {
  state.sourceFiles.delete(fileId);
  state.setBookmarks(state.bookmarks.filter((b) => b.source_file_id !== fileId));
  if (state.activeFolder === fileId) {
    state.setActiveFolder('ALL');
  }
  deps.persist();
  if (triggerRender) {
    deps.render();
    showToast('已成功刪除檔案及其書籤');
  }
}

/**
 * Attach the all-bookmarks and language-filter listeners.
 */
export function registerSidebarListeners() {
  document.getElementById('tagFilterCloud')?.addEventListener('click', (e) => {
    const pill = e.target.closest('[data-filter-tag]');
    if (!pill) return;
    const tag = pill.dataset.filterTag;
    state.setActiveTag(state.activeTag === tag ? null : tag);
    deps.render();
  });
  // Folder list — delegated select/delete
  document.getElementById('folderList')?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('[data-delete-folder]');
    if (deleteBtn) {
      confirmDeleteFolder(e, deleteBtn.dataset.deleteFolder);
      return;
    }
    const selectBtn = e.target.closest('[data-select-folder]');
    if (selectBtn) {
      selectFolder(selectBtn.dataset.selectFolder);
    }
  });

  // "All bookmarks" folder button
  document.getElementById('allFolderBtn')?.addEventListener('click', () => {
    state.setActiveFolder('ALL');
    deps.render();
  });

  // Language filter pill click delegation
  document.getElementById('languageFilters')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('lang-btn')) {
      document.querySelectorAll('.lang-btn').forEach((b) => {
        b.classList.remove('active', 'bg-indigo-600', 'text-white');
        b.classList.add('bg-slate-700', 'text-slate-300');
      });
      e.target.classList.add('active', 'bg-indigo-600', 'text-white');
      state.setActiveLang(e.target.dataset.lang);
      deps.render();
    }
  });
}
