/**
 * @fileoverview Reading queue feature barrel.
 *
 * External importers reach through this facade, never into components/ or
 * behavior/ internals.
 */

export { MAX_QUEUE_SIZE, QUEUE_IDS, QUEUE_DATA_ATTRS } from './behavior/constants.js';
export {
  getQueueLength,
  isInQueue,
  getQueueIndex,
  getQueuedBookmarks,
} from './behavior/service.js';
export {
  addToQueue,
  removeFromQueue,
  moveQueueItem,
  moveQueueItemToTop,
  moveQueueItemToBottom,
  clearQueue,
} from './behavior/actions.js';
export { openQueueModal, closeQueueModal } from './behavior/controller.js';
export { renderQueueView } from './behavior/view.js';
export { registerQueueListeners } from './behavior/listeners.js';
export { queueModalHtml } from './components/queueModal.js';
export { queueItemHtml } from './components/queueItem.js';
