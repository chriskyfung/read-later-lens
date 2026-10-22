/**
 * @fileoverview Sidebar folders / source-files renderer.
 *
 * Extracted from src/views/sidebar.js `renderSidebarFolders()` when the
 * sidebar split into src/views/sidebar/*. The markup helpers stay pure in
 * src/components/sidebar/folderRow.js; this module owns DOM creation, dataset
 * wiring and the trash fallback policy.
 *
 * Preserves the monolith's folder counts, badges, classes and empty
 * placeholder. Missing sidebar elements are skipped; counts are explicitly
 * converted to strings to match browser innerText coercion.
 */

import { activeFolder, setActiveFolder, sourceFiles } from '../../core/state.js';
import {
  sidebarAllFolderBtnClass,
  sidebarFolderItemClass,
  sidebarFolderItemHtml,
  sidebarTrashBtnClass,
} from '../../components/sidebar/folderRow.js';
import {
  SIDEBAR_IDS,
  SIDEBAR_DATA_ATTRS,
  DYNAMIC_FILE_BTN_CLASS,
  FOLDER_ALL,
  FOLDER_TRASH,
} from './constants.js';
import { partitionBookmarks, countActiveByFolder } from './service.js';

/**
 * Fallback policy: with an empty trash, the TRASH pseudo-row shows nothing, so
 * the sidebar must not sit on a dead row.
 *
 * Deliberately a state mutation inside the render path — it must happen
 * BEFORE the "All" row's active state is computed, so the All row renders
 * active in the same pass.
 *
 * @param {string} currentFolder
 * @param {number} trashedCount
 * @returns {boolean} True when the active folder was reset to ALL.
 */
export function applyTrashFallback(currentFolder, trashedCount) {
  if (currentFolder === FOLDER_TRASH && trashedCount === 0) {
    setActiveFolder(FOLDER_ALL);
    return true;
  }
  return false;
}

/**
 * Render the folder / source-file list in the sidebar.
 *
 * Counts only active (non-trashed) bookmarks so the badges agree with the
 * grid; the trash row carries its own badge fed by the trashed population.
 */
export function renderSidebarFolders() {
  const folderList = document.getElementById(SIDEBAR_IDS.folderList);
  const allFolderBtn = document.getElementById(SIDEBAR_IDS.allFolderBtn);
  const totalSourceCount = document.getElementById(SIDEBAR_IDS.totalSourceCount);
  const allCountBadge = document.getElementById(SIDEBAR_IDS.allCountBadge);
  const trashFolderBtn = document.getElementById(SIDEBAR_IDS.trashFolderBtn);
  const trashCountBadge = document.getElementById(SIDEBAR_IDS.trashCountBadge);

  const { activeList, active, trashed } = partitionBookmarks();

  applyTrashFallback(activeFolder, trashed);

  if (totalSourceCount) totalSourceCount.innerText = String(sourceFiles.size);
  if (allCountBadge) allCountBadge.innerText = String(active);
  if (trashCountBadge) trashCountBadge.innerText = String(trashed);

  const isAllActive = activeFolder === FOLDER_ALL;
  if (allFolderBtn) {
    allFolderBtn.className = sidebarAllFolderBtnClass(isAllActive);
  }
  if (trashFolderBtn) {
    trashFolderBtn.className = sidebarTrashBtnClass(activeFolder === FOLDER_TRASH);
    // Applied after the className reset above, which would otherwise drop it.
    trashFolderBtn.classList.toggle('hidden', trashed === 0);
  }

  if (folderList) {
    folderList.querySelectorAll(`.${DYNAMIC_FILE_BTN_CLASS}`).forEach((el) => el.remove());

    const counts = countActiveByFolder(activeList);
    sourceFiles.forEach((file) => {
      const count = counts.get(file.id) || 0;
      const btn = document.createElement('div');
      const isActive = activeFolder === file.id;

      btn.className = sidebarFolderItemClass(isActive);

      btn.dataset.selectFolder = file.id;
      btn.innerHTML = sidebarFolderItemHtml({ file, count });
      btn.querySelector(`[${SIDEBAR_DATA_ATTRS.deleteFolder}]`).dataset.deleteFolder = file.id;
      folderList.appendChild(btn);
    });
  }
}
