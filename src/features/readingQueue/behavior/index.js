/**
 * @fileoverview Reading queue behavior barrel — stable public surface.
 */

export { MAX_QUEUE_SIZE, QUEUE_IDS, QUEUE_DATA_ATTRS } from './constants.js';
export { getQueueLength, isInQueue, getQueueIndex, getQueuedBookmarks } from './service.js';
export {
  addToQueue,
  removeFromQueue,
  moveQueueItem,
  moveQueueItemToTop,
  moveQueueItemToBottom,
  clearQueue,
} from './actions.js';
export { openQueueModal, closeQueueModal } from './controller.js';
export { renderQueueView } from './view.js';
export { initReadingQueue, persistAfterQueueAction } from './deps.js';
