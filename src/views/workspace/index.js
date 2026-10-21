/**
 * @fileoverview Facade for the workspace view modules.
 *
 * Re-exports the public surface of src/views/workspace/* so existing import
 * paths (src/views/workspaceActions.js) keep working.
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
