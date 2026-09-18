/**
 * @fileoverview Modal listener registration — close buttons + reader actions.
 *
 * Extracted from the monolith's DOMContentLoaded block in index.html. Must be
 * called AFTER mountModals() (src/components/modals.js) so the buttons exist.
 * All other modal button wiring (save/back, unified exports, duplicate
 * resolution, file input) lives with its owning feature module (src/io/*).
 *
 * This module is a leaf (imported only by src/main.js and its test) and is the
 * safe wiring surface for the reader's 🗑️ 刪除 and ⚡ 相似 buttons: it can import
 * confirmDeleteBookmark from workspaceActions.js without closing the
 * workspaceActions → bookmarks → readerModal cycle.
 */

import { closeReaderModal, getReaderBookmarkId } from './readerModal.js';
import { openSimilarityModal, closeSimilarityModal } from './similarityModal.js';
import { confirmDeleteBookmark } from './workspaceActions.js';

/**
 * Attach close handlers for the reader and similarity modals.
 */
export function registerModalListeners() {
  document.getElementById('closeReaderBtn')?.addEventListener('click', closeReaderModal);
  document.getElementById('closeSimilarityBtn')?.addEventListener('click', closeSimilarityModal);

  // Reader actions (Phase 2). Confirm-gated delete reuses the workspaceActions
  // primitive; a cancelled confirm leaves the reader open. The similarity button
  // closes the reader and opens the similarity drawer for the same bookmark
  // (mirrors the similarity-row click ordering in src/views/similarityModal.js).
  document.getElementById('readerDeleteBtn')?.addEventListener('click', () => {
    const id = getReaderBookmarkId();
    if (id && confirmDeleteBookmark(id)) closeReaderModal();
  });
  document.getElementById('readerSimilarityBtn')?.addEventListener('click', () => {
    const id = getReaderBookmarkId();
    if (id) {
      closeReaderModal();
      openSimilarityModal(id);
    }
  });
}
