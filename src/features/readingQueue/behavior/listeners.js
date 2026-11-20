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
  getQueuedBookmarks,
} from '@/features/readingQueue';
import { renderQueueView } from './view.js';
import { QUEUE_IDS, QUEUE_DATA_ATTRS } from './constants.js';
import { closeQueueModal } from './controller.js';
import { updateQueueBadge } from '@/features/sidebar/behavior';
import { renderBookmarkCards } from '@/features/bookmarks';
import { persistAfterAction } from '@/app/persist.js';
import { showToast } from '@/utils/dom';

let draggedId = null;

/**
 * Compute the zero-based insert index for a drop on a target row.
 * If the pointer is in the lower half of the target row, insert after it;
 * otherwise insert before it. Accounts for scroll position.
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
      const countBefore = getQueuedBookmarks().length;
      clearQueue();
      renderQueueView();
      updateQueueBadge();
      renderBookmarkCards();
      persistAfterAction();
      if (countBefore > 0) showToast(`已清空閱讀佇列（${countBefore} 項）`);
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
      updateQueueBadge();
      renderBookmarkCards();
      persistAfterAction();
      showToast('已移至最上層');
      return;
    }

    // Move to bottom
    const moveBottomBtn = e.target.closest(`[${QUEUE_DATA_ATTRS.moveBottom}]`);
    if (moveBottomBtn) {
      e.stopPropagation();
      moveQueueItemToBottom(moveBottomBtn.dataset.moveBottom);
      renderQueueView();
      updateQueueBadge();
      renderBookmarkCards();
      persistAfterAction();
      showToast('已移至最下層');
      return;
    }

    // Remove from queue
    const removeBtn = e.target.closest(`[${QUEUE_DATA_ATTRS.removeQueue}]`);
    if (removeBtn) {
      e.stopPropagation();
      removeFromQueue(removeBtn.dataset.removeQueue);
      renderQueueView();
      updateQueueBadge();
      renderBookmarkCards();
      persistAfterAction();
      showToast('已移出閱讀佇列');
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

    // Store dragged id in dataTransfer (survives dragend→drop race)
    const id = row.dataset.queueRow;
    draggedId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setDragImage(row, 0, 0);

    // Visual feedback on the dragged row
    row.classList.add('dragging');
  });

  list?.addEventListener('dragend', (e) => {
    const row = e.target.closest(`[${QUEUE_DATA_ATTRS.queueRow}]`);
    row?.classList.remove('dragging');
    document.querySelectorAll('#queueList .drag-over').forEach((el) => {
      el.classList.remove('drag-over');
    });
    // NOTE: do NOT clear draggedId here — dragend fires before drop in Chrome.
    // Clear it at the end of the drop handler instead.
  });

  list?.addEventListener('dragover', (e) => {
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const row = e.target.closest(`[${QUEUE_DATA_ATTRS.queueRow}]`);
    if (row && row.dataset.queueRow !== data) {
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
    // Read dragged id from dataTransfer (not the module variable, which may be cleared by dragend)
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    const targetRow = e.target.closest(`[${QUEUE_DATA_ATTRS.queueRow}]`);
    if (!targetRow || targetRow.dataset.queueRow === id) {
      document.querySelectorAll('#queueList .drag-over').forEach((el) => {
        el.classList.remove('drag-over');
      });
      return;
    }

    const idx = dropIndex(targetRow, e.clientY);
    moveQueueItem(id, idx);
    renderQueueView();
    updateQueueBadge();
    renderBookmarkCards();
    persistAfterAction();
    showToast('已調整佇列順序');

    document.querySelectorAll('#queueList .drag-over').forEach((el) => {
      el.classList.remove('drag-over');
    });
    draggedId = null;
  });
}
