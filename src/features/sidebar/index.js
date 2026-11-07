/** @fileoverview Sidebar feature barrel — presentation + behavior container.

External importers reach through this facade,
never into components/ or behavior/ internals.
*/

// --- Presentation (markup only) ---
export {
  sidebarHtml,
  mountSidebar,
  sidebarFolderItemHtml,
  sidebarFolderItemClass,
  sidebarTagPillClass,
} from './components';

// --- Behavior (state / events / side-effects) ---
export {
  initSidebarActions,
  renderSidebar,
  registerSidebarListeners,
  updateStorageUsageUI,
} from './behavior';
