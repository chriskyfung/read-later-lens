import * as state from '../../core/state';
import { getTrashedBookmarks } from '../../core/filters.js';

/**
 * Find a trashed bookmark by id — O(1) via the id index in core/state,
 * which every mutator keeps in sync (pinned by
 * tests/views-trash-index-parity.test.js). Semantics match the original linear
 * `find`: only a truthy `deleted_at` counts as trashed, so a record with a
 * falsy stamp (`null`, `undefined`, `''`) is treated as live and returns
 * undefined.
 * @param {string} id
 */
export function findTrashedBookmark(id) {
  const bookmark = state.getBookmarkById(id);
  return state.isTrashed(bookmark) ? bookmark : undefined;
}

/** Ids of the current trash projection (newest-deleted first). */
export const collectTrashIds = () => getTrashedBookmarks().map((b) => b.id);
