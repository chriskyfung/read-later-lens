/**
 * @fileoverview Reading queue actions — state mutations with capacity enforcement.
 *
 * All mutations create a new array (never mutate in place) so callers that
 * hold the old reference see a consistent snapshot.
 */

import { readingQueue, setReadingQueue } from '@/core/state';
import { MAX_QUEUE_SIZE } from './constants.js';

/**
 * Add a bookmark to the end of the queue.
 * Idempotent: returns false when already queued.
 * Returns false when the queue is at capacity.
 * @param {string} bookmarkId
 * @returns {boolean} True when added.
 */
export function addToQueue(bookmarkId) {
  if (readingQueue.includes(bookmarkId)) return false;
  if (readingQueue.length >= MAX_QUEUE_SIZE) return false;
  setReadingQueue([...readingQueue, bookmarkId]);
  return true;
}

/**
 * Remove a bookmark from the queue.
 * Returns false when not present.
 * @param {string} bookmarkId
 * @returns {boolean} True when removed.
 */
export function removeFromQueue(bookmarkId) {
  const idx = readingQueue.indexOf(bookmarkId);
  if (idx === -1) return false;
  const next = [...readingQueue];
  next.splice(idx, 1);
  setReadingQueue(next);
  return true;
}

/**
 * Move a queued item to a new zero-based index (clamped to valid range).
 * @param {string} bookmarkId
 * @param {number} newIndex
 * @returns {boolean} True when moved.
 */
export function moveQueueItem(bookmarkId, newIndex) {
  const oldIdx = readingQueue.indexOf(bookmarkId);
  if (oldIdx === -1) return false;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= readingQueue.length) newIndex = readingQueue.length - 1;
  if (oldIdx === newIndex) return true;
  const next = [...readingQueue];
  next.splice(oldIdx, 1);
  next.splice(newIndex, 0, bookmarkId);
  setReadingQueue(next);
  return true;
}

/**
 * Move a queued item to the top (index 0).
 * @param {string} bookmarkId
 * @returns {boolean}
 */
export function moveQueueItemToTop(bookmarkId) {
  return moveQueueItem(bookmarkId, 0);
}

/**
 * Move a queued item to the bottom (last index).
 * @param {string} bookmarkId
 * @returns {boolean}
 */
export function moveQueueItemToBottom(bookmarkId) {
  return moveQueueItem(bookmarkId, readingQueue.length - 1);
}

/**
 * Clear the entire queue.
 */
export function clearQueue() {
  setReadingQueue([]);
}
