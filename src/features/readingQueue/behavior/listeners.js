/**
 * @fileoverview Reading queue listeners — drag-and-drop reorder, row click to
 * open reader, move-top/bottom, remove, clear queue.
 *
 * Register listeners AFTER mountModals() so #queueModal exists.
 */

import { openReaderModal } from '@/features/reader/behavior/controller.js';
import {
  removeFromQueue,
  moveQueueItem,
  moveQueueItemToTop,
  moveQueueItemToBottom,
  clearQueue,
} from '@/features/readingQueue';
import { renderQueueView } from './view.js';
import { QUEUE_IDS, QUEUE_DATA_ATTRS } from './constants.js';
import { closeQueueModal } from './controller.js';

let draggedId = null;

/**
 * Compute the zero-based insert index for a drop on a target row.
 * If the pointer is in the lower half of the target row, insert after it;
 * otherwise insert before it.
 *
 * @param {HTMLElement} targetRow
 * @param {number} clientY
 * @returns {number}
 */
function dropIndex(targetRow, clientY) {
  const rect = targetRow.getBoundingClientRect();
  const center = rect.top + rect.height / 2;
  const allRows = Array.from(document.getElementById(QUEUE_IDS.list)?.children ?? []);
  const targetIndex = allRows.indexOf(targetRow);
  const insertIdx = clientY > center ? targetIndex + 1 : targetIndex;
  return Math.max(0, Math.min(insertIdx, allRows.length));
}

/**
 * Wire all queue modal interaction handlers.
 */
export function registerQueueListeners() {
  const list = document.getElementById(QUEUE_IDS.list);
  const closeBtn = document.getElementById(QUEUE_IDS.closeBtn);
  const clearBtn = document.getElementById(QUEUE_IDS.clearBtn);

  // --- Close button ---
  closeBtn?.addEventListener('click', closeQueueModal);

  // --- Clear queue button ---
  clearBtn?.addEventListener('click', () => {
    if (window.confirm('確定要清空閱讀佇列嗎？')) {
      clearQueue();
      renderQueueView();
    }
  });

  // --- Delegated clicks on the queue list ---
  list?.addEventListener('click', (e) => {
    // Move to top
    const moveTopBtn = e.target.closest(`[${QUEUE_DATA_ATTRS.moveTop}]`);
    if (moveTopBtn) {
      e.stopPropagation();
      moveQueueItemToTop(moveTopBtn.dataset.moveTop);
      renderQueueView();
      return;
    }

    // Move to bottom
    const moveBottomBtn = e.target.closest(`[${QUEUE_DATA_ATTRS.moveBottom}]`);
    if (moveBottomBtn) {
      e.stopPropagation();
      moveQueueItemToBottom(moveBottomBtn.dataset.moveBottom);
      renderQueueView();
      return;
    }

    // Remove from queue
    const removeBtn = e.target.closest(`[${QUEUE_DATA_ATTRS.removeQueue}]`);
    if (removeBtn) {
      e.stopPropagation();
      removeFromQueue(removeBtn.dataset.removeQueue);
      renderQueueView();
      return;
    }

    // Row click → open reader (but not if clicking an action button)
    const row = e.target.closest(`[${QUEUE_DATA_ATTRS.queueRow}]`);
    if (row && !e.target.closest('button')) {
      const id = row.dataset.queueRow;
      if (id) openReaderModal(id);
      return;
    }
  });

  // --- Drag-and-drop reorder ---
  list?.addEventListener('dragstart', (e) => {
    const handle = e.target.closest(`[${QUEUE_DATA_ATTRS.dragHandle}]`);
    if (!handle) return;
    const row = handle.closest(`[${QUEUE_DATA_ATTRS.queueRow}]`);
    if (!row) return;

    draggedId = row.dataset.queueRow;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedId);

    // Visual feedback on the dragged row
    row.classList.add('opacity-40', 'rotate-1', 'shadow-lg');
    e.dataTransfer.setDragImage(row, 0, 0);
  });

  list?.addEventListener('dragend', (e) => {
    e.target
      .closest(`[${QUEUE_DATA_ATTRS.queueRow}]`)
      ?.classList.remove('opacity-40', 'rotate-1', 'shadow-lg');
    document.querySelectorAll('#queueList .drag-over').forEach((el) => {
      el.classList.remove('drag-over');
    });
    draggedId = null;
  });

  list?.addEventListener('dragover', (e) => {
    if (!draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const row = e.target.closest(`[${QUEUE_DATA_ATTRS.queueRow}]`);
    if (row && row.dataset.queueRow !== draggedId) {
      row.classList.add('drag-over');
    }
  });

  list?.addEventListener('dragleave', (e) => {
    const row = e.target.closest(`[${QUEUE_DATA_ATTRS.queueRow}]`);
    if (row) {
      row.classList.remove('drag-over');
    }
  });

  list?.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedId) return;

    const targetRow = e.target.closest(`[${QUEUE_DATA_ATTRS.queueRow}]`);
    if (!targetRow || targetRow.dataset.queueRow === draggedId) {
      document.querySelectorAll('#queueList .drag-over').forEach((el) => {
        el.classList.remove('drag-over');
      });
      return;
    }

    const idx = dropIndex(targetRow, e.clientY);
    moveQueueItem(draggedId, idx);
    renderQueueView();

    document.querySelectorAll('#queueList .drag-over').forEach((el) => {
      el.classList.remove('drag-over');
    });
    draggedId = null;
  });
}
