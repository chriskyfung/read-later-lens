/**
 * @fileoverview Persist the current working set (bookmarks + source metadata).
 */

import { bookmarks, sourceFiles } from '../state.js';
import { REV_KEY, STORE_NAME } from './constants.js';
import { getDb } from './connection.js';
import { getKnownRev, setKnownRev } from './revision.js';
import { toPersistedSources } from './serialize.js';

/**
 * Persist the current working set (bookmarks + source metadata) to IndexedDB.
 *
 * Never rejects — mirroring the monolith, a failed cache write must never break
 * the UI flow — but it does REPORT the outcome so callers (`persistAndRender`
 * → the importer) can tell the user when this session is not cached instead of
 * failing silently.
 *
 * Two guarantees beyond "did the write succeed":
 *
 *  - **All or nothing.** Every row goes up in one transaction, so a failure on
 *    the second row can no longer leave `bookmarks` updated while `sources`
 *    still describes the previous folder set. That split was reachable before:
 *    a synchronous `DataCloneError` on the second `put` threw straight out of
 *    the function while the first `put` had already committed.
 *  - **Never overwrite another tab.** IndexedDB is shared per origin, so a
 *    second tab's import, deletion or cache wipe is invisible to this one. The
 *    stored revision is compared with the baseline this tab last read, inside
 *    the writing transaction; a mismatch means someone else wrote meanwhile,
 *    and this write is refused rather than silently discarding their work.
 *
 * @returns {Promise<{persisted: boolean, conflict: boolean}>} `persisted` is
 *   false when the write failed (also logged as a warning) or was refused as a
 *   conflict; `conflict` distinguishes "another tab changed the library" from
 *   "the cache rejected us" so the caller can say something useful.
 */
export async function saveState() {
  try {
    const db = await getDb();
    const sourcesArray = toPersistedSources(sourceFiles);
    // One transaction for every row: IndexedDB commits a transaction only if
    // ALL of its requests succeed, so a failure on the second row can no longer
    // leave `bookmarks` updated while `sources` still describes the old folder
    // set. The revision read stays inside this transaction too, which is what
    // makes the check atomic — readwrite transactions on one store are
    // serialised, so no other tab can write between our read and our puts.
    // Nothing unrelated may be awaited in here, or the transaction commits first.
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const stored = await tx.store.get(REV_KEY);
    if ((stored?.data ?? undefined) !== getKnownRev()) {
      // Nothing is queued yet, so aborting is enough — and it is required: an
      // open transaction with no further requests commits anyway, which would
      // report success while having written nothing.
      tx.abort();
      await tx.done.catch(() => {
        // Expected: abort() rejects tx.done with an AbortError we already own.
      });
      console.warn('IndexedDB save refused: another tab changed the library');
      return { persisted: false, conflict: true };
    }

    const nextRev = globalThis.crypto.randomUUID();
    // Every request gets its own no-op rejection handler the moment it is
    // queued. abort() rejects everything already queued, so a row left without
    // a handler by a LATER put throwing synchronously would surface as an
    // unhandled rejection and take the page down. `tx.done` stays the single
    // success/failure signal — it rejects whenever the transaction does.
    const put = (key, data) => {
      const request = tx.store.put({ key, data });
      request.catch(() => {});
      return request;
    };

    try {
      put('bookmarks', bookmarks);
      put('sources', sourcesArray);
      put(REV_KEY, nextRev);
    } catch (err) {
      // A synchronous throw (DataCloneError) once the first row is queued would
      // otherwise let that row COMMIT on its own: abort both or neither.
      tx.abort();
      await tx.done.catch(() => {});
      throw err;
    }

    await tx.done;
    setKnownRev(nextRev);
    return { persisted: true, conflict: false };
  } catch (err) {
    // Mirror the monolith: a failed cache write must never break the UI flow.
    // The caller (persistAndRender) turns this into a visible warning.
    console.warn('IndexedDB save failed:', err);
    return { persisted: false, conflict: false };
  }
}
