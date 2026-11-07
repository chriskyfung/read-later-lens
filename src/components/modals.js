/**
 * @fileoverview Modal shell registry + stacking layer.
 *
 * Each overlay's markup was extracted byte-for-byte from the original monolith
 * into its own module under src/components/. Mounting appends the blocks to
 * the end of <body> in the same order the monolith used, so focus order,
 * z-index layers and (for the stackable ones) popstate/Escape semantics are
 * unchanged.
 *
 * - readerModal      -> src/features/reader
 * - similarityModal  -> src/features/similarityModal/behavior/
 * - saveModal        -> src/io/export/
 * - importModal      -> src/io/import/
 * - duplicateModal   -> src/io/import/
 * - trashModal       -> src/features/trash
 * - toast            -> src/utils/dom
 *
 * Listener registration (close buttons) lives in src/app/modalListeners.js
 * and must run AFTER mountModals().
 */
import { readerModalHtml } from '@/features/reader';
import { similarityModalHtml } from '@/features/similarityModal';
import { saveModalHtml } from '@/io/components/saveModal.js';
import { importModalHtml } from '@/io/components/importModal.js';
import { duplicateModalHtml } from '@/io/components/duplicateModal.js';
import { trashModalHtml } from '@/features/trash';
import { toastHtml } from './toast';

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
