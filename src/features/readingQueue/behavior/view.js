/**
 * @fileoverview Reading queue view — DOM rendering only.
 *
 * Renders the modal's list + summary + empty state. Pure DOM orchestration:
 * never touches the bookmark grid or the sidebar — the queue lives in its own
 * modal, so those stay exactly as the current folder/langs/tag/search view
 * leaves them.
 */

import { queueItemHtml } from '../components';
import { getQueuedBookmarks } from './service.js';
import { QUEUE_IDS } from './constants.js';
import { getBookmarkDomain } from '@/utils/url.js';
import { createIcons, GripVertical, Ellipsis, ListStart, ListEnd, ListX } from 'lucide';

/**
 * Render the queue modal's list + summary + empty state.
 *
 * @returns {boolean} Whether the render succeeded (modal elements exist).
 */
export function renderQueueView() {
  const list = document.getElementById(QUEUE_IDS.list);
  const summary = document.getElementById(QUEUE_IDS.summary);
  const emptyState = document.getElementById(QUEUE_IDS.emptyState);
  const countBadge = document.getElementById(QUEUE_IDS.modalTitleBadge);
  if (!list || !summary || !emptyState) return false;

  const queued = getQueuedBookmarks();

  if (countBadge) countBadge.textContent = String(queued.length);
  summary.textContent = `${queued.length} 個項目`;

  // Clear on every render so the list always mirrors the projection.
  list.innerHTML = '';

  if (queued.length === 0) {
    emptyState.classList.remove('hidden');
    return true;
  }
  emptyState.classList.add('hidden');

  list.innerHTML = queued
    .map((bookmark, index) =>
      queueItemHtml({
        bookmark,
        index,
        domain: getBookmarkDomain(bookmark.url),
      }),
    )
    .join('');

  createIcons({ icons: { GripVertical, Ellipsis, ListStart, ListEnd, ListX }, list });
  return true;
}

/**
 * Snapshot the queue list's current DOM row count — call BEFORE mutating state
 * so patchQueueRow() can detect drift between the visible list and the new
 * projection. Returns 0 when the list is not mounted.
 * @returns {number}
 */
export function captureDomRowCount() {
  return document.getElementById(QUEUE_IDS.list)?.children.length ?? 0;
}

/**
 * Patch the queue UI after a single-row mutation (add / remove / reorder),
 * leaving every untouched row node in place instead of rebuilding the whole list.
 *
 * @param {string} id Id of the row that changed.
 * @param {number} expectedDomRows Row count the DOM must still show — captured
 *   BEFORE the mutation via captureDomRowCount().
 * @param {string} operation One of 'add', 'remove', 'move'
 * @returns {boolean} True when the patch landed; false when the DOM drifted.
 */
export function patchQueueRow(id, expectedDomRows, operation) {
  const list = document.getElementById(QUEUE_IDS.list);
  const summary = document.getElementById(QUEUE_IDS.summary);
  const emptyState = document.getElementById(QUEUE_IDS.emptyState);
  const countBadge = document.getElementById(QUEUE_IDS.modalTitleBadge);
  if (!list || !summary || !emptyState) return false;

  const rows = Array.from(list.children);
  // The DOM still shows the pre-mutation state (the caller captured its row
  // count before mutating); a mismatch means some other render interleaved,
  // so refuse to guess and let the caller rebuild.
  if (rows.length !== expectedDomRows) return false;

  const queued = getQueuedBookmarks();

  if (operation === 'add') {
    // Find the new item's index in the queue
    const newIndex = queued.findIndex((b) => b.id === id);
    if (newIndex === -1) return false;

    // Create the new row
    const newRow = document.createElement('div');
    newRow.innerHTML = queueItemHtml({
      bookmark: queued[newIndex],
      index: newIndex,
      domain: getBookmarkDomain(queued[newIndex].url),
    });
    const newElement = newRow.firstElementChild;

    // Insert at the correct position
    if (newIndex < rows.length) {
      list.insertBefore(newElement, rows[newIndex]);
    } else {
      list.appendChild(newElement);
    }

    // Update indices for all rows after the new one
    const allRows = Array.from(list.children);
    allRows.forEach((row, i) => {
      const indexSpan = row.querySelector('.text-xs.text-slate-500.font-mono.w-6.text-right');
      if (indexSpan) indexSpan.textContent = String(i + 1);
      row.dataset.queueRow = queued[i].id;
      row.dataset.openReader = queued[i].id;
      // Update all data attributes
      const dragHandle = row.querySelector('[data-drag-handle]');
      if (dragHandle) dragHandle.dataset.dragHandle = queued[i].id;
      const moveTop = row.querySelector('[data-move-top]');
      if (moveTop) moveTop.dataset.moveTop = queued[i].id;
      const moveBottom = row.querySelector('[data-move-bottom]');
      if (moveBottom) moveBottom.dataset.moveBottom = queued[i].id;
      const removeBtn = row.querySelector('[data-remove-queue]');
      if (removeBtn) removeBtn.dataset.removeQueue = queued[i].id;
    });
  } else if (operation === 'remove') {
    const target = rows.find((row) => row.getAttribute?.('data-queue-row') === id);
    if (!target) return false;
    target.remove();

    // Update indices for remaining rows
    const allRows = Array.from(list.children);
    allRows.forEach((row, i) => {
      const indexSpan = row.querySelector('.text-xs.text-slate-500.font-mono.w-6.text-right');
      if (indexSpan) indexSpan.textContent = String(i + 1);
      row.dataset.queueRow = queued[i].id;
      row.dataset.openReader = queued[i].id;
      const dragHandle = row.querySelector('[data-drag-handle]');
      if (dragHandle) dragHandle.dataset.dragHandle = queued[i].id;
      const moveTop = row.querySelector('[data-move-top]');
      if (moveTop) moveTop.dataset.moveTop = queued[i].id;
      const moveBottom = row.querySelector('[data-move-bottom]');
      if (moveBottom) moveBottom.dataset.moveBottom = queued[i].id;
      const removeBtn = row.querySelector('[data-remove-queue]');
      if (removeBtn) removeBtn.dataset.removeQueue = queued[i].id;
    });
  } else if (operation === 'move') {
    // For move operations, full re-render is simpler and safer
    return false;
  }

  // Update summary and badge
  if (countBadge) countBadge.textContent = String(queued.length);
  summary.textContent = `${queued.length} 個項目`;

  if (queued.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  createIcons({ icons: { GripVertical, Ellipsis, ListStart, ListEnd, ListX } });

  return true;
}
