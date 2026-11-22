/**
 * @fileoverview Reading queue behavior constants — DOM ids, data attributes,
 * and queue capacity limit.
 */

export const MAX_QUEUE_SIZE = 100;

/**
 * DOM element ids used by the reading queue modal and sidebar badge.
 */
export const QUEUE_IDS = {
  modal: 'queueModal',
  list: 'queueList',
  emptyState: 'queueEmptyState',
  summary: 'queueSummary',
  clearBtn: 'clearQueueBtn',
  closeBtn: 'closeQueueBtn',
  // Sidebar queue badge
  titleBadge: 'queueCountBadge',
  // Queue modal header badge (unique ID to avoid collision with sidebar)
  modalTitleBadge: 'queueModalCountBadge',
};

/**
 * Data attributes carried by queue item rows and their action buttons.
 */
export const QUEUE_DATA_ATTRS = {
  queueRow: 'data-queue-row',
  openReader: 'data-open-reader',
  dragHandle: 'data-drag-handle',
  moveTop: 'data-move-top',
  moveBottom: 'data-move-bottom',
  removeQueue: 'data-remove-queue',
};
