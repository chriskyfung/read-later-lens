/**
 * @fileoverview Bookmarks markup barrel — stable public surface for the split.
 *
 * Importers reach through this facade (src/features/bookmarks/components/index.js), not
 * into the individual modules, so the internal file layout can evolve without
 * touching callers.
 */

export { bookmarkCardClass, bookmarkCardHtml } from './card.js';
export { panelBookmarksHtml } from './panel.js';
