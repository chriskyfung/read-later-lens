/** @fileoverview Reader feature barrel — presentation + behavior container.
 *
 * External importers reach through this facade,
 * never into components/ or behavior/ internals.
 */

// --- Presentation ( DOM rendering only) ---
export { readerModalHtml } from './components';

// --- Behavior (state / side‑effects / layer lifecycle) ---
export {
  renderReaderModal,
  syncReaderFavoriteButton,
  getReaderBookmarkId,
  openReaderModal,
  closeReaderModal,
  applyFavoriteVariant,
} from './behavior';
