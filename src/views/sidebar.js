/**
 * @fileoverview Sidebar rendering — facade preserving the public API.
 *
 * The behavior now lives in src/views/sidebar/ (constants, service, deps,
 * folders, tags, view, actions, storage, listeners) and this facade re-exports
 * the stable public surface so importers (src/views/main-view.js, tests) keep
 * working unchanged.
 *
 * Preserves the monolith's folder counts, badges, tag-pill classes and empty
 * placeholder. Missing sidebar elements are skipped; counts are explicitly
 * converted to strings to match browser innerText coercion.
 *
 * The class/markup builders live in src/components/sidebar/folderRow.js and
 * src/components/sidebar/tagPill.js to keep components pure; the view keeps
 * DOM creation, dataset wiring and the click flows.
 *
 * Folder, tag and language interactions are registered by sidebarActions.js.
 */

export { renderSidebarFolders, renderTagCloud, renderSidebar } from './sidebar/index.js';
