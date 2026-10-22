/**
 * @fileoverview Sidebar barrel — stable public surface for the split.
 *
 * Importers reach through the facades (src/views/sidebar.js,
 * src/views/sidebarActions.js), not into the individual modules, so the
 * internal file layout can evolve without touching callers. Mirrors
 * src/views/header/index.js.
 */

export { SIDEBAR_IDS, SIDEBAR_DATA_ATTRS, FOLDER_ALL, FOLDER_TRASH } from './constants.js';
export {
  getActiveSidebarBookmarks,
  partitionBookmarks,
  countActiveByFolder,
  collectTagCounts,
} from './service.js';
export { initSidebarActions, getDeps } from './deps.js';
export { renderSidebarFolders, applyTrashFallback } from './folders.js';
export { renderTagCloud } from './tags.js';
export { renderSidebar } from './view.js';
export { selectFolder, confirmDeleteFolder, deleteFolder } from './actions.js';
export { updateStorageUsageUI } from './storage.js';
export { registerSidebarListeners } from './listeners.js';
