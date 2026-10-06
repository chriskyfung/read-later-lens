/**
 * @fileoverview IndexedDB persistence via `idb` - promise-based wrapper.
 *
 * Replaces the original hand-rolled `indexedDB.open(...)` + request-event
 * boilerplate with a thin, mockable layer so the rest of the app never deals
 * with IDB request events. Behavior matches the monolith: SQLite payloads are
 * kept in memory only (not persisted).
 */

import { openDB, deleteDB } from 'idb';
import { bookmarks, sourceFiles, setBookmarks, setSourceFiles } from './state.js';

const DB_NAME = 'ReadLaterLensDB';

/**
 * Database name used before the Read Later Lens rebrand. Existing users'
 * cached working sets live here and are migrated into `DB_NAME` on first load.
 */
const LEGACY_DB_NAME = 'InstapaperBookmarkManagerDB';

const STORE_NAME = 'app_state';
const DB_VERSION = 1;

/**
 * Key of the optimistic-concurrency revision row inside `app_state`.
 *
 * Written in the SAME transaction as `bookmarks` and `sources`, so the three
 * rows always describe one another. Every write bumps it to a fresh UUID; a
 * tab whose baseline no longer matches the stored row knows another tab wrote
 * in the meantime and must not overwrite that work.
 */
const REV_KEY = 'rev';

/**
 * The revision this tab last read or wrote; `undefined` when the cache holds
 * no revision row yet (pre-revision install, or a fresh database).
 *
 * Per-tab on purpose: IndexedDB is per-origin, so every tab shares one
 * database while each keeps its own `knownRev`. The mismatch between the two
 * is precisely the cross-tab stale-write signal this feature exists to catch.
 *
 * Reset by `closeDb()`. Losing the baseline only ever fails CLOSED — the next
 * save refuses until `loadState()` re-reads — never open.
 *
 * @type {string | undefined}
 */
let knownRev;

/** @type {Promise<import('idb').IDBPDatabase> | null} */
let dbPromise = null;

/**
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * One-time migration from the pre-rebrand database name.
 *
 * Copies the `bookmarks` and `sources` rows from `LEGACY_DB_NAME` into
 * `targetDb`, then removes the legacy database so the migration cannot run
 * twice against stale data.
 *
 * Idempotent: skipped whenever `targetDb` already holds cached data, so a
 * legacy database can never overwrite newer state written after migration.
 *
 * Fail-open by design: any error only logs a warning and leaves the legacy
 * database untouched (no cached data is lost), mirroring the non-fatal error
 * philosophy of `saveState`.
 *
 * @param {import('idb').IDBPDatabase} targetDb
 * @returns {Promise<boolean>} Whether rows were migrated.
 */
async function migrateLegacyDb(targetDb) {
  const existing = await targetDb.get(STORE_NAME, 'bookmarks');
  if (existing) return false; // Target already has data — nothing to migrate.

  let legacyDb = null;
  try {
    // Note: opening creates the database when it is absent; every exit path
    // below closes and deletes it so no empty legacy DB is left behind.
    legacyDb = await openDB(LEGACY_DB_NAME, DB_VERSION);

    if (!legacyDb.objectStoreNames.contains(STORE_NAME)) {
      await legacyDb.close();
      await deleteDB(LEGACY_DB_NAME);
      return false;
    }

    const [legacyBookmarks, legacySources] = await Promise.all([
      legacyDb.get(STORE_NAME, 'bookmarks'),
      legacyDb.get(STORE_NAME, 'sources'),
    ]);

    if (!legacyBookmarks && !legacySources) {
      await legacyDb.close();
      await deleteDB(LEGACY_DB_NAME);
      return false;
    }

    if (legacyBookmarks) await targetDb.put(STORE_NAME, legacyBookmarks);
    if (legacySources) await targetDb.put(STORE_NAME, legacySources);

    await legacyDb.close();
    await deleteDB(LEGACY_DB_NAME);
    return true;
  } catch (err) {
    console.warn('Legacy cache migration failed:', err);
    if (legacyDb) {
      try {
        legacyDb.close();
      } catch {
        // Already closed — nothing to do.
      }
    }
    return false; // Legacy database kept so no cached data is lost.
  }
}

export async function closeDb() {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  // Forgetting the connection forgets the revision we last verified against it.
  // Keeping a stale baseline would let a later save skip the rev check against
  // a database that no longer holds what it describes.
  //
  // Test-only contract: `closeDb()` swaps the underlying database (see
  // store.test.js, which deletes and re-creates it between cases), so the next
  // `saveState()` must refuse until `loadState()` re-reads a baseline against
  // the new database — never compare the OLD baseline against the NEW rows.
  // Production code never calls this: IndexedDB connections stay open for the
  // tab's lifetime, so `knownRev` always describes the database it came from.
  knownRev = undefined;
}

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
    // Only serializable source metadata is persisted. Source records carry no
    // file handles — save-back writes a copy (Save-As, then a download), so a
    // handle would have no reader even if one were kept. SQLite payloads stay
    // in memory only.
    const sourcesArray = Array.from(sourceFiles.entries()).map(([, v]) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      profile: v.profile,
      originalData: v.type === 'sqlite' || v.type === 'db' ? null : v.originalData,
      // The observed table layout is tiny (a name plus a column list), unlike the
      // payload above, so it IS persisted: without it a reload would make the
      // original `.db` shape unknowable and save-back would have to guess.
      sqliteSchema: v.sqliteSchema ?? null,
      // Same reasoning as `sqliteSchema` above: a header row is a few short
      // strings, so persisting it keeps the source's own CSV layout knowable
      // after a reload instead of re-guessed from the app's internal schema.
      csvColumns: v.csvColumns ?? null,
      // And the same for the dialect: two short strings, and without them a
      // ;-delimited or LF source would silently return as comma + CRLF after a
      // reload, re-parsed from the raw text only to guess the wrong shape.
      csvDialect: v.csvDialect ?? null,
    }));
    // One transaction for every row: IndexedDB commits a transaction only if
    // ALL of its requests succeed, so a failure on the second row can no longer
    // leave `bookmarks` updated while `sources` still describes the old folder
    // set. The revision read stays inside this transaction too, which is what
    // makes the check atomic — readwrite transactions on one store are
    // serialised, so no other tab can write between our read and our puts.
    // Nothing unrelated may be awaited in here, or the transaction commits first.
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const stored = await tx.store.get(REV_KEY);
    if ((stored?.data ?? undefined) !== knownRev) {
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
    knownRev = nextRev;
    return { persisted: true, conflict: false };
  } catch (err) {
    // Mirror the monolith: a failed cache write must never break the UI flow.
    // The caller (persistAndRender) turns this into a visible warning.
    console.warn('IndexedDB save failed:', err);
    return { persisted: false, conflict: false };
  }
}

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
  const [bookmarksRow, sourcesRow, revRow] = await Promise.all([
    db.get(STORE_NAME, 'bookmarks'),
    db.get(STORE_NAME, 'sources'),
    db.get(STORE_NAME, REV_KEY),
  ]);
  knownRev = revRow?.data;

  if (bookmarksRow && sourcesRow) {
    setBookmarks(bookmarksRow.data || []);
    const sources = sourcesRow.data || [];
    setSourceFiles(new Map(sources.map((s) => [s.id, s])));
    return true;
  }
  return false;
}

/**
 * Report whether this tab's view of the library still matches storage.
 *
 * A cheap up-front probe for destructive actions: catching a divergence before
 * the state is mutated keeps the in-memory working set, the rendered view and
 * the cache agreeing with each other, instead of mutating first and finding out
 * at persist time. `saveState()` repeats the same check inside its transaction
 * and remains the authoritative one, because another tab can still write in the
 * gap between this probe and that write — failing open here therefore degrades
 * to "refused at persist", never to a silent stale write.
 *
 * Fails open: a storage error must not lock the user out of their own library
 * when the real guard is the persist itself.
 *
 * @returns {Promise<boolean>} `false` when another tab has written since this
 *   tab last read or wrote the cache.
 */
export async function isStateFresh() {
  try {
    const db = await getDb();
    const row = await db.get(STORE_NAME, REV_KEY);
    return (row?.data ?? undefined) === knownRev;
  } catch (err) {
    console.warn('Stale-state probe failed:', err);
    return true;
  }
}

/**
 * Estimate storage usage for the UI meter.
 *
 * @returns {Promise<{ usageKB: number, limitMB: number }>}
 */
export async function getStorageUsage() {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return { usageKB: 0, limitMB: 50 };
  }
  const estimate = await navigator.storage.estimate();
  const usageKB = Math.round((estimate.usage || 0) / 1024);
  const limitMB = 50;
  return { usageKB, limitMB };
}
