/**
 * @fileoverview Reader view barrel — stable public surface for the split.
 *
 * Importers reach through this facade (src/views/reader/index.js), not into
 * the individual modules, so the internal file layout can evolve without
 * touching callers. Mirrors src/components/bookmarks/trash/index.js and
 * src/views/trash/index.js.
 */

export { openReaderModal, closeReaderModal } from './controller.js';
export { renderReaderModal, syncReaderFavoriteButton } from './view.js';
export { getReaderBookmarkId } from './state.js';
