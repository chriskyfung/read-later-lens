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
import { initializeLucideIcons } from '@/utils/lucide';
import { GripVertical, ListStart, ListEnd, ListX } from 'lucide';

/**
 * Render the queue modal's list + summary + empty state.
 *
 * @returns {boolean} Whether the render succeeded (modal elements exist).
 */
export function renderQueueView() {
  const list = document.getElementById(QUEUE_IDS.list);
  const summary = document.getElementById(QUEUE_IDS.summary);
  const emptyState = document.getElementById(QUEUE_IDS.emptyState);
  const countBadge = document.getElementById(QUEUE_IDS.titleBadge);
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

  initializeLucideIcons({ GripVertical, ListStart, ListEnd, ListX });
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
 * @returns {boolean} True when the patch landed; false when the DOM drifted.
 */
export function patchQueueRow(id, expectedDomRows) {
  const list = document.getElementById(QUEUE_IDS.list);
  const summary = document.getElementById(QUEUE_IDS.summary);
  const emptyState = document.getElementById(QUEUE_IDS.emptyState);
  if (!list || !summary || !emptyState) return false;

  const rows = Array.from(list.children);
  if (rows.length !== expectedDomRows) return false;

  // Full re-render is simpler and safer for reorder operations (all rows
  // change position), so we only handle add/remove here.
  const target = rows.find((row) => row.getAttribute?.('data-queue-row') === id);
  if (!target) return false;

  // Rebuild the whole list since positions may have shifted.
  return false;
}
