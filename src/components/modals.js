/**
 * @fileoverview Modal components aggregator — mounts all overlay markup.
 *
 * Each overlay's markup was extracted byte-for-byte from the original
 * monolith (index.html). Mounting appends the blocks to the end of <body>
 * in the same order the monolith used, so paint order / z-index stacking
 * is unchanged.
 *
 * Behavior mapping:
 *  - readerModal      → src/views/readerModal.js
 *  - similarityModal  → src/views/similarityModal.js
 *  - saveModal        → src/io/exporter.js
 *  - importModal      → src/io/importer.js
 *  - duplicateModal   → src/io/importer.js
 *  - toast            → src/utils/dom.js
 *
 * Listener registration (close buttons) lives in src/views/modalListeners.js
 * and must run AFTER mountModals().
 */

import { readerModalHtml } from './readerModal.js';
import { similarityModalHtml } from './similarityModal.js';
import { saveModalHtml } from './saveModal.js';
import { importModalHtml } from './importModal.js';
import { duplicateModalHtml } from './duplicateModal.js';
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
      toastHtml(),
  );
}
