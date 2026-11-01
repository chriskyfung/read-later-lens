/**
 * @fileoverview Bookmarks markup barrel — stable public surface for the split.
 *
 * Importers reach through this facade (src/components/bookmarks/index.js), not
 * into the individual modules, so the internal file layout can evolve without
 * touching callers. Mirrors src/components/bookmarks/trash/index.js.
 */

export { bookmarkCardClass, bookmarkCardHtml } from './card.js';
export { panelBookmarksHtml } from './panel.js';
export {
  trashItemColumns,
  trashItemClass,
  formatDeletedAt,
  trashItemHtml,
  trashModalHtml,
} from './trash';
