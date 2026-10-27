import { pushLayer, popLayer } from '../../utils/dom';
import { TRASH_IDS } from './constants.js';
import { renderTrashView } from './view.js';

/**
 * Open the trash modal on top of whatever is on screen. The list renders
 * before the push so it is fresh even when another overlay is stacked on top;
 * closeTrashModal() restores focus to the sidebar row that opened it.
 */
export function openTrashModal() {
  renderTrashView();
  pushLayer(TRASH_IDS.modal, { restore: renderTrashView });
}

/** Close the trash modal, revealing whatever layer sits beneath it. */
export function closeTrashModal() {
  popLayer(TRASH_IDS.modal);
}
