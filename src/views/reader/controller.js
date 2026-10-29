/**
 * @fileoverview Reader modal controller — layer lifecycle.
 *
 * Open/close goes through pushLayer/popLayer (src/utils/dom/), so a reader
 * opened from a similarity drawer stacks on top of it and unwinds back to it.
 */

import { pushLayer, popLayer } from '../../utils/dom';
import { renderReaderModal } from './view.js';
import { retireReader } from './state.js';

/**
 * Open the reader modal for a given bookmark, stacking it on top of any modal
 * that is already open.
 *
 * @param {string} bookmarkId
 */
export function openReaderModal(bookmarkId) {
  if (!renderReaderModal(bookmarkId)) return;
  pushLayer('readerModal', {
    payload: bookmarkId,
    restore: renderReaderModal,
    onRetire: retireReader,
  });
}

/**
 * Close the reader modal, revealing the layer beneath it if there is one.
 */
export function closeReaderModal() {
  retireReader();
  popLayer('readerModal');
}
