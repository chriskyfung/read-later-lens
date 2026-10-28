/**
 * @fileoverview Sidebar listeners — tag cloud, folder list, All/Trash rows and
 * the language-filter pills.
 *
 * Extracted from src/views/sidebarActions.js `registerSidebarListeners()` when
 * the sidebar split into src/views/sidebar/*. The element ids come from
 * SIDEBAR_IDS and the row selectors from SIDEBAR_DATA_ATTRS, so the markup
 * side and the view side cannot drift apart.
 *
 * Register listeners AFTER mountSidebar() (src/components/sidebar/panel.js).
 */

import * as state from '../../core/state';
import { openTrashModal } from '../trash';
import { getDeps } from './deps.js';
import { SIDEBAR_IDS, SIDEBAR_DATA_ATTRS, FOLDER_ALL } from './constants.js';
import { selectFolder, confirmDeleteFolder } from './actions.js';

/**
 * Attach the all-bookmarks and language-filter listeners.
 */
export function registerSidebarListeners() {
  document.getElementById(SIDEBAR_IDS.tagFilterCloud)?.addEventListener('click', (e) => {
    const pill = e.target.closest(`[${SIDEBAR_DATA_ATTRS.filterTag}]`);
    if (!pill) return;
    const tag = pill.dataset.filterTag;
    state.setActiveTag(state.activeTag === tag ? null : tag);
    getDeps().render();
  });
  // Folder list — delegated select/delete
  document.getElementById(SIDEBAR_IDS.folderList)?.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest(`[${SIDEBAR_DATA_ATTRS.deleteFolder}]`);
    if (deleteBtn) {
      await confirmDeleteFolder(e, deleteBtn.dataset.deleteFolder);
      return;
    }
    const selectBtn = e.target.closest(`[${SIDEBAR_DATA_ATTRS.selectFolder}]`);
    if (selectBtn) {
      selectFolder(selectBtn.dataset.selectFolder);
    }
  });

  // "All bookmarks" folder button
  document.getElementById(SIDEBAR_IDS.allFolderBtn)?.addEventListener('click', () => {
    state.setActiveFolder(FOLDER_ALL);
    getDeps().render();
  });

  // Trash (回收桶) row — opens the dedicated trash modal instead of switching
  // the pseudo-folder (the grid behind it stays mounted). See src/views/trash.
  document.getElementById(SIDEBAR_IDS.trashFolderBtn)?.addEventListener('click', () => {
    // The modal opens on top of whatever is on screen.
    openTrashModal();
  });

  // Language filter pill click delegation
  document.getElementById(SIDEBAR_IDS.languageFilters)?.addEventListener('click', (e) => {
    if (e.target.classList.contains('lang-btn')) {
      document.querySelectorAll('.lang-btn').forEach((b) => {
        b.classList.remove('active', 'bg-indigo-600', 'text-white');
        b.classList.add('bg-slate-700', 'text-slate-300');
      });
      e.target.classList.add('active', 'bg-indigo-600', 'text-white');
      state.setActiveLang(e.target.dataset.lang);
      getDeps().render();
    }
  });
}
