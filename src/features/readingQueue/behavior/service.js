/**
 * @fileoverview Reading queue service — pure read helpers over queue state.
 */

import { bookmarks, readingQueue } from '@/core/state';

/** @returns {number} Current number of items in the queue. */
export function getQueueLength() {
  return readingQueue.length;
}

/**
 * Check whether a bookmark id is already in the queue.
 * @param {string} bookmarkId
 * @returns {boolean}
 */
export function isInQueue(bookmarkId) {
  return readingQueue.includes(bookmarkId);
}

/**
 * Get the zero-based index of a bookmark id in the queue.
 * @param {string} bookmarkId
 * @returns {number} -1 when not present.
 */
export function getQueueIndex(bookmarkId) {
  return readingQueue.indexOf(bookmarkId);
}

/**
 * Return bookmark records that are in the queue, ordered by queue position.
 * Skips trashed bookmarks.
 * @returns {import('../../core/model/BookmarkRecord.js').BookmarkRecord[]}
 */
export function getQueuedBookmarks() {
  const queueSet = new Set(readingQueue);
  return bookmarks
    .filter((b) => !b.deleted_at && queueSet.has(b.id))
    .sort((a, b) => readingQueue.indexOf(a.id) - readingQueue.indexOf(b.id));
}
