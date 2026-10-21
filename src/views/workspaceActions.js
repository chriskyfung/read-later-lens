/**
 * @fileoverview Compatibility facade for the workspace view modules.
 *
 * The implementation moved to src/views/workspace/*; this module keeps the
 * historical import path working.
 */
export {
  initWorkspaceActions,
  switchTab,
  zoomIn,
  zoomOut,
  resetZoom,
  applyWeighting,
  deleteBookmark,
  toggleFavoriteBookmark,
  confirmDeleteBookmark,
  deleteSelectedBookmarks,
  confirmDeleteSelectedBookmarks,
  registerWorkspaceListeners,
} from './workspace/index.js';
