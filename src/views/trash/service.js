import * as state from '../../core/state.js';
import { getTrashedBookmarks } from '../../core/filters.js';

/**
 * Find a trashed bookmark by id. Keeps the original linear-scan semantics
 * (sees the current array identity even if an index is stale).
 * @param {string} id
 */
export const findTrashedBookmark = (id) => state.bookmarks.find((b) => b.id === id && b.deleted_at);

/** Ids of the current trash projection (newest-deleted first). */
export const collectTrashIds = () => getTrashedBookmarks().map((b) => b.id);
