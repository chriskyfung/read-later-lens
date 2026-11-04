/**
 * @fileoverview Facade for the workspace view modules.
 */
export { initWorkspaceActions, getDeps } from './deps.js';
export { switchTab } from './tabActions.js';
export { zoomIn, zoomOut, resetZoom, applyWeighting } from './graphActions.js';
export {
  deleteBookmark,
  toggleFavoriteBookmark,
  confirmDeleteBookmark,
  deleteSelectedBookmarks,
  confirmDeleteSelectedBookmarks,
} from './actions.js';
export { registerWorkspaceListeners } from './listeners.js';
