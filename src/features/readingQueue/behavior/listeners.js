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
import { renderQueueView, patchQueueRow, captureDomRowCount } from './view.js';
import { QUEUE_IDS, QUEUE_DATA_ATTRS } from './constants.js';
import { closeQueueModal } from './controller.js';
import { updateQueueBadge } from '@/features/sidebar/behavior';
import { renderBookmarkCards } from '@/features/bookmarks';
import { persistAfterActionFireAndForget } from '@/app/persist.js';
import { showToast } from '@/utils/dom';

/**
 * Find the element after which the dragged item should be inserted,
 * based on the mouse Y position. Returns null if the item should go at the end.
 * Similar to the reference example's getDragAfterElement.
 *
 * @param {HTMLElement} container The queue list container
 * @param {number} y The clientY position of the mouse
 * @returns {HTMLElement|null} The element after which to insert, or null for end
 */
function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(`[${QUEUE_DATA_ATTRS.queueRow}]:not(.dragging)`),
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}

let draggedElement = null;

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
      persistAfterActionFireAndForget();
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
      persistAfterActionFireAndForget();
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
      persistAfterActionFireAndForget();
      showToast('已移至最下層');
      return;
    }

    // Remove from queue
    const removeBtn = e.target.closest(`[${QUEUE_DATA_ATTRS.removeQueue}]`);
    if (removeBtn) {
      e.stopPropagation();
      const id = removeBtn.dataset.removeQueue;
      const expectedRows = captureDomRowCount();
      removeFromQueue(id);
      const patched = patchQueueRow(id, expectedRows, 'remove');
      if (!patched) renderQueueView();
      updateQueueBadge();
      renderBookmarkCards();
      persistAfterActionFireAndForget();
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

  // --- Action menu dropdown toggle ---
  list?.addEventListener('click', (_e) => {
    const trigger = _e.target.closest('[data-queue-actions] > button');
    if (!trigger) return;

    const actionsContainer = trigger.closest('[data-queue-actions]');
    const menu = actionsContainer?.querySelector('.action-menu');
    if (!menu) return;

    // Close all other open menus
    document.querySelectorAll('#queueList .action-menu').forEach((m) => {
      if (m !== menu) {
        m.classList.add('opacity-0', 'invisible', 'translate-y-1');
        m.classList.remove('opacity-100', 'visible', 'translate-y-0');
      }
    });

    // Toggle this menu
    const isOpen = menu.classList.contains('opacity-100');
    if (isOpen) {
      menu.classList.add('opacity-0', 'invisible', 'translate-y-1');
      menu.classList.remove('opacity-100', 'visible', 'translate-y-0');
      trigger.setAttribute('aria-expanded', 'false');
    } else {
      menu.classList.remove('opacity-0', 'invisible', 'translate-y-1');
      menu.classList.add('opacity-100', 'visible', 'translate-y-0');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  // Close action menus when clicking outside
  document.addEventListener('click', (_e) => {
    if (!_e.target.closest('[data-queue-actions]')) {
      document.querySelectorAll('#queueList .action-menu').forEach((menu) => {
        menu.classList.add('opacity-0', 'invisible', 'translate-y-1');
        menu.classList.remove('opacity-100', 'visible', 'translate-y-0');
        const trigger = menu.closest('[data-queue-actions]')?.querySelector('button');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // --- Drag-and-drop reorder (matches reference example pattern) ---
  list?.addEventListener('dragstart', (e) => {
    const handle = e.target.closest(`[${QUEUE_DATA_ATTRS.dragHandle}]`);
    if (!handle) return;
    const row = handle.closest(`[${QUEUE_DATA_ATTRS.queueRow}]`);
    if (!row) return;

    draggedElement = row;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.queueRow);
    e.dataTransfer.setDragImage(row, 0, 0);
  });

  list?.addEventListener('dragend', (_e) => {
    if (draggedElement) {
      draggedElement.classList.remove('dragging');
    }
    document.querySelectorAll(`#${QUEUE_IDS.list} .over`).forEach((el) => {
      el.classList.remove('over');
    });
    draggedElement = null;
  });

  list?.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedElement) return;

    const afterElement = getDragAfterElement(list, e.clientY);

    // Clear previous 'over' state
    document.querySelectorAll(`#${QUEUE_IDS.list} .over`).forEach((el) => {
      el.classList.remove('over');
    });

    if (afterElement) {
      // Insert before the element we're hovering over
      afterElement.classList.add('over');
      list.insertBefore(draggedElement, afterElement);
    } else {
      // Insert at the end
      list.appendChild(draggedElement);
    }
  });

  list?.addEventListener('dragleave', (e) => {
    // Only clear 'over' when leaving the list entirely
    if (!list.contains(e.relatedTarget)) {
      document.querySelectorAll(`#${QUEUE_IDS.list} .over`).forEach((el) => {
        el.classList.remove('over');
      });
    }
  });

  list?.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedElement) return;

    const id = draggedElement.dataset.queueRow;

    // dragover() already moved the row to its final visual position, so the
    // drop index is simply its current DOM position.
    const allRows = Array.from(list.querySelectorAll(`[${QUEUE_DATA_ATTRS.queueRow}]`));
    const newIndex = allRows.indexOf(draggedElement);

    // Clear visual states
    document.querySelectorAll(`#${QUEUE_IDS.list} .over`).forEach((el) => {
      el.classList.remove('over');
    });
    draggedElement.classList.remove('dragging');

    if (newIndex >= 0) {
      moveQueueItem(id, newIndex);
      renderQueueView();
      updateQueueBadge();
      renderBookmarkCards();
      persistAfterActionFireAndForget();
      showToast('已調整佇列順序');
    }

    draggedElement = null;
  });
}
