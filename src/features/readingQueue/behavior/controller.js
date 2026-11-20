import { pushLayer, popLayer } from '@/utils/dom';
import { QUEUE_IDS } from './constants.js';
import { renderQueueView } from './view.js';

/**
 * Open the queue modal on top of whatever is on screen. The list renders
 * before the push so it is fresh even when another overlay is stacked on top;
 * closeQueueModal() restores focus to the element that opened it.
 */
export function openQueueModal() {
  renderQueueView();
  pushLayer(QUEUE_IDS.modal, { restore: renderQueueView });
}

/** Close the queue modal, revealing whatever layer sits beneath it. */
export function closeQueueModal() {
  popLayer(QUEUE_IDS.modal);
}
