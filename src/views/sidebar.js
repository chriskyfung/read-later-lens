/**
 * @fileoverview Sidebar rendering — folders/source files and the tag cloud.
 *
 * Preserves the monolith's folder counts, badges, tag-pill classes and empty
 * placeholder. Missing sidebar elements are skipped; counts are explicitly
 * converted to strings to match browser innerText coercion.
 *
 * The class/markup builders live in src/components/sidebar/folderRow.js and
 * src/components/sidebar/tagPill.js to keep components pure; this view keeps
 * DOM creation, dataset wiring and the click flows.
 *
 * Folder, tag and language interactions are registered by sidebarActions.js.
 * Generated controls carry IDs/tags as DOM data, not inline JavaScript.
 */

import { bookmarks, sourceFiles, activeFolder, activeTag, setActiveFolder } from '../core/state.js';
import {
  sidebarAllFolderBtnClass,
  sidebarFolderItemClass,
  sidebarFolderItemHtml,
  sidebarTrashBtnClass,
} from '../components/sidebar/folderRow.js';
import {
  sidebarTagCloudEmptyStateHtml,
  sidebarTagPillClass,
  sidebarTagPillLabel,
} from '../components/sidebar/tagPill.js';

/**
 * Render the folder / source-file list in the sidebar.
 *
 * Counts only active (non-trashed) bookmarks so the badges agree with the grid;
 * the trash row carries its own badge fed by the trashed population.
 */
export function renderSidebarFolders() {
  const folderList = document.getElementById('folderList');
  const allFolderBtn = document.getElementById('allFolderBtn');
  const totalSourceCount = document.getElementById('totalSourceCount');
  const allCountBadge = document.getElementById('allCountBadge');
  const trashFolderBtn = document.getElementById('trashFolderBtn');
  const trashCountBadge = document.getElementById('trashCountBadge');

  const active = bookmarks.filter((b) => !b.deleted_at);
  const trashedCount = bookmarks.length - active.length;

  // If the last trashed bookmark was purged while the user sat in the trash
  // view, fall back to the All-Items view — the trash row is about to hide.
  if (trashedCount === 0 && activeFolder === 'TRASH') {
    setActiveFolder('ALL');
  }

  if (totalSourceCount) totalSourceCount.innerText = String(sourceFiles.size);
  if (allCountBadge) allCountBadge.innerText = String(active.length);
  if (trashCountBadge) trashCountBadge.innerText = String(trashedCount);

  const isAllActive = activeFolder === 'ALL';
  if (allFolderBtn) {
    allFolderBtn.className = sidebarAllFolderBtnClass(isAllActive);
  }
  if (trashFolderBtn) {
    trashFolderBtn.className = sidebarTrashBtnClass(activeFolder === 'TRASH');
    // Applied after the className reset above, which would otherwise drop it.
    trashFolderBtn.classList.toggle('hidden', trashedCount === 0);
  }

  if (folderList) {
    folderList.querySelectorAll('.dynamic-file-btn').forEach((el) => el.remove());

    sourceFiles.forEach((file) => {
      const count = active.filter((b) => b.source_file_id === file.id).length;
      const btn = document.createElement('div');
      const isActive = activeFolder === file.id;

      btn.className = sidebarFolderItemClass(isActive);

      btn.dataset.selectFolder = file.id;
      btn.innerHTML = sidebarFolderItemHtml({ file, count });
      btn.querySelector('[data-delete-folder]').dataset.deleteFolder = file.id;
      folderList.appendChild(btn);
    });
  }
}

/**
 * Render the tag cloud.
 */
export function renderTagCloud() {
  const container = document.getElementById('tagFilterCloud');
  if (!container) return;

  const tagsMap = new Map();

  bookmarks.forEach((b) => {
    if (b.tags && Array.isArray(b.tags)) {
      b.tags.forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) tagsMap.set(trimmed, (tagsMap.get(trimmed) || 0) + 1);
      });
    }
  });

  if (tagsMap.size === 0) {
    container.innerHTML = sidebarTagCloudEmptyStateHtml();
    return;
  }

  container.innerHTML = '';
  tagsMap.forEach((cnt, tag) => {
    const isSelected = activeTag === tag;
    const pill = document.createElement('button');
    pill.className = sidebarTagPillClass(isSelected);
    pill.innerText = sidebarTagPillLabel({ tag, count: cnt });
    pill.dataset.filterTag = tag;
    container.appendChild(pill);
  });
}

/**
 * Render all sidebar pieces (called by the main `renderAll` orchestrator).
 */
export function renderSidebar() {
  renderSidebarFolders();
  renderTagCloud();
}
