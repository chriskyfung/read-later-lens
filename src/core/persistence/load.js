/**
 * @fileoverview Restore state from IndexedDB into the module-level bindings.
 */

import { setBookmarks, setSourceFiles, setReadingQueue } from '../state';
import { REV_KEY, STORE_NAME } from './constants.js';
import { getDb } from './connection.js';
import { migrateLegacyDb } from './migration.js';
import { setKnownRev } from './revision.js';

/**
 * Restore state from IndexedDB into the module-level bindings.
 *
 * Callers own the UI side-effects (render + restore toast), mirroring the
 * original monolith which performed both inside its loader.
 *
 * Also records the cache's current revision as this tab's baseline, so the
 * next `saveState()` can tell whether this tab still agrees with storage. The
 * revision is read even when there is nothing to restore, so a pre-revision
 * cache establishes the `undefined` baseline its first save expects.
 *
 * @returns {Promise<boolean>} `true` when persisted rows were found and applied.
 */
export async function loadState() {
  const db = await getDb();
  await migrateLegacyDb(db);
  const [bookmarksRow, sourcesRow, queueRow, revRow] = await Promise.all([
    db.get(STORE_NAME, 'bookmarks'),
    db.get(STORE_NAME, 'sources'),
    db.get(STORE_NAME, 'readingQueue'),
    db.get(STORE_NAME, REV_KEY),
  ]);
  setKnownRev(revRow?.data);

  if (bookmarksRow && sourcesRow) {
    setBookmarks(bookmarksRow.data || []);
    const sources = sourcesRow.data || [];
    setSourceFiles(new Map(sources.map((s) => [s.id, s])));
    if (queueRow) {
      // Prune stale IDs (bookmarks that no longer exist — purged).
      // Keep trashed IDs so a restore brings them back into the queue.
      const bookmarkIds = new Set((bookmarksRow.data || []).map((b) => b.id));
      const prunedQueue = (queueRow.data || []).filter((id) => bookmarkIds.has(id));
      setReadingQueue(prunedQueue);
    }
    return true;
  }
  return false;
}
