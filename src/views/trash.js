/**
 * @fileoverview Trash (回收桶) view — facade preserving the public API.
 *
 * Design notes (soft-delete plan):
 *  - The trash is a *projection* over `deleted_at`, not a second store, so it
 *    survives reloads through the existing IndexedDB bookmark blob.
 *  - The list lives in a dedicated modal (src/components/bookmarks/trashModal.js,
 *    opened from the sidebar's 回收桶 row in src/views/sidebarActions.js). The
 *    grid behind it stays mounted, so the modal keeps the current folder,
 *    language, tag and search context; it is intentionally flat and unfiltered
 *    (ignores activeFolder / activeLang / activeTag / searchQuery) — simple and
 *    robust. Reusing the header filters with in-place dimming of non-matching
 *    rows is a backlog item.
 *  - The modal rides the shared layer stack (src/utils/dom.js), so Escape
 *    unwinds it, Tab stays trapped inside it, and close restores focus to the
 *    sidebar row that opened it.
 *  - Folder deletion is deliberately NOT soft: deleteFolder() purges a file's
 *    trashed bookmarks too, so a trashed record can never outlive its source
 *    file and "restore into a deleted folder" is impossible by construction.
 *
 * Implementation lives in src/views/trash/ (constants, deps, service, view,
 * controller, actions, listeners); this module only re-exports so existing
 * importers (src/main.js, src/views/sidebarActions.js, tests) keep working.
 * `persist`/`render` are injected by src/main.js, mirroring sidebarActions and
 * workspaceActions.
 */
export { initTrashDeps as initTrash, getDeps } from './trash/deps.js';
export { findTrashedBookmark, collectTrashIds } from './trash/service.js';
export { renderTrashView } from './trash/view.js';
export { openTrashModal, closeTrashModal } from './trash/controller.js';
export {
  restoreBookmark,
  purgeBookmark,
  confirmPurgeBookmark,
  emptyTrash,
  confirmEmptyTrash,
} from './trash/actions.js';
export { registerTrashListeners } from './trash/listeners.js';
