/**
 * @fileoverview Sidebar projections — pure functions over the bookmark and
 * source-file state. No DOM access.
 *
 * Extracted from src/views/sidebar.js when the sidebar view split into
 * src/views/sidebar/*. Mirrors src/views/trash/service.js.
 *
 * Two counting policies coexist here and must not be merged: the folder badges
 * count ACTIVE bookmarks only (so they agree with the grid), while the tag
 * cloud counts EVERY bookmark, trashed ones included. The inconsistency is
 * observable in the UI and predates the split — it is preserved on purpose.
 */

import { bookmarks } from '../../core/state';

/**
 * The active (non-trashed) bookmarks — the population the folder badges and
 * the grid agree on.
 *
 * @returns {import('../../core/model/BookmarkRecord.js').BookmarkRecord[]}
 */
export function getActiveSidebarBookmarks() {
  return bookmarks.filter((b) => !b.deleted_at);
}

/**
 * Partition the bookmarks into the active list and the trashed count.
 *
 * One filter pass serves both the folder badges (active only) and the trash
 * badge (trashed only).
 *
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord[]} [list]
 * @returns {{activeList: import('../../core/model/BookmarkRecord.js').BookmarkRecord[], active: number, trashed: number}}
 */
export function partitionBookmarks(list = bookmarks) {
  const activeList = list.filter((b) => !b.deleted_at);
  return {
    activeList,
    active: activeList.length,
    trashed: list.length - activeList.length,
  };
}

/**
 * Count the active bookmarks per source file, in a single pass.
 *
 * The previous implementation filtered the whole active list once per source
 * file (O(files × bookmarks)) and read `source_file_id` that many times per
 * bookmark; this map reads it once. The resulting numbers are identical.
 *
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord[]} [activeList]
 * @returns {Map<string, number>} Count per source_file_id (absent = 0).
 */
export function countActiveByFolder(activeList = getActiveSidebarBookmarks()) {
  const counts = new Map();
  activeList.forEach((b) => {
    const id = b.source_file_id;
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  return counts;
}

/**
 * Collect the tag occurrence counts for the tag cloud.
 *
 * Counts every bookmark (trashed included), counts OCCURRENCES rather than
 * distinct bookmarks, trims each tag and drops blank ones. First-seen order is
 * preserved (Map iteration order), which the pill order depends on.
 *
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord[]} [list]
 * @returns {Map<string, number>}
 */
export function collectTagCounts(list = bookmarks) {
  const tagsMap = new Map();
  list.forEach((b) => {
    if (b.tags && Array.isArray(b.tags)) {
      b.tags.forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) tagsMap.set(trimmed, (tagsMap.get(trimmed) || 0) + 1);
      });
    }
  });
  return tagsMap;
}
