/** @fileoverview Workspace feature barrel — presentation + behavior container.

External importers reach through this facade,
never into components/ or behavior/ internals.
*/

// --- Presentation (markup only) ---
export { WORKSPACE_IDS, workspaceHtml, mountWorkspace } from './components';

// --- Behavior (state / events / side-effects) ---
export {
  initWorkspaceActions,
  deleteBookmark,
  toggleFavoriteBookmark,
  confirmDeleteBookmark,
  deleteSelectedBookmarks,
  confirmDeleteSelectedBookmarks,
  registerWorkspaceListeners,
} from './behavior';
