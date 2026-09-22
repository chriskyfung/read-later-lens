/**
 * @fileoverview Modal close-button listener registration.
 *
 * Extracted from the monolith's DOMContentLoaded block in index.html. Must be
 * called AFTER mountModals() (src/components/modals.js) so the buttons exist.
 * All other modal button wiring (save/back, unified exports, duplicate
 * resolution, file input) lives with its owning feature module (src/io/*).
 */

import { closeReaderModal } from './readerModal.js';
import { closeSimilarityModal } from './similarityModal.js';

/**
 * Attach close handlers for the reader and similarity modals.
 */
export function registerModalListeners() {
  document.getElementById('closeReaderBtn')?.addEventListener('click', closeReaderModal);
  document.getElementById('closeReaderFooterBtn')?.addEventListener('click', closeReaderModal);
  document.getElementById('closeSimilarityBtn')?.addEventListener('click', closeSimilarityModal);
}
