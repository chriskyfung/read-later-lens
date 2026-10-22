/**
 * @fileoverview Sidebar actions — facade preserving the public API.
 *
 * The behavior now lives in src/views/sidebar/ (deps, actions, storage,
 * listeners) and this facade re-exports the stable public surface so importers
 * (src/main.js, tests) keep working unchanged.
 *
 * Extracted from the monolith's inline script in index.html.
 * Register listeners AFTER mountSidebar() (src/components/sidebar/panel.js).
 */

export { initSidebarActions, getDeps } from './sidebar/index.js';
export { updateStorageUsageUI } from './sidebar/index.js';
export { selectFolder, confirmDeleteFolder, deleteFolder } from './sidebar/index.js';
export { registerSidebarListeners } from './sidebar/index.js';
