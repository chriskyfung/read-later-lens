/**
 * @fileoverview Modal shell registry + stacking layer.
 *
 * Each overlay's markup was extracted byte-for-byte from the original monolith
 * into its own module under src/components/. Mounting appends the blocks to
 * the end of <body> in the same order the monolith used, so focus order,
 * z-index layers and (for the stackable ones) popstate/Escape semantics are
 * unchanged.
 *
 * - readerModal      -> src/views/readerModal.js
 * - similarityModal  -> src/views/similarityModal.js
 * - saveModal        -> src/io/exporter.js
 * - importModal      -> src/io/import/
 * - duplicateModal   -> src/io/import/
 * - trashModal       -> src/components/bookmarks/trash/modal.js
 * - toast            -> src/utils/dom
 *
 * Listener registration (close buttons) lives in src/views/modalListeners.js
 * and must run AFTER mountModals().
 */
import { readerModalHtml } from './readerModal.js';
import { similarityModalHtml } from './similarityModal.js';
import { saveModalHtml } from './io/saveModal.js';
import { importModalHtml } from './io/importModal.js';
import { duplicateModalHtml } from './io/duplicateModal.js';
import { trashModalHtml } from './bookmarks/trash';
import { toastHtml } from './toast.js';

/**
 * Append all overlay markup to the end of <body> (monolith order preserved).
 */
export function mountModals() {
  document.body.insertAdjacentHTML(
    'beforeend',
    readerModalHtml() +
      similarityModalHtml() +
      saveModalHtml() +
      importModalHtml() +
      duplicateModalHtml() +
      trashModalHtml() +
      toastHtml(),
  );
}
