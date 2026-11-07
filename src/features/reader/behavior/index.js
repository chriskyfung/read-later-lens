/**
 * @fileoverview Barrel file for the reader feature.
 *
 * External importers reach through this facade,
 * never into components/ or behavior/ internals.
 */

export { renderReaderModal, syncReaderFavoriteButton } from './view.js';
export { getReaderBookmarkId } from './state.js';
export { openReaderModal, closeReaderModal } from './controller.js';
export { applyFavoriteVariant } from './favorite.js';
