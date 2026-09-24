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
}

/**
 * Persist the current working set (bookmarks + source metadata) to IndexedDB.
 *
 * Never rejects — mirroring the monolith, a failed cache write must never break
 * the UI flow — but it does REPORT the outcome so callers (`persistAndRender`
 * → the importer) can tell the user when this session is not cached instead of
 * failing silently.
 *
 * @returns {Promise<boolean>} `true` when both rows were written, `false` when
 *   the write failed (also logged as a warning).
 */
export async function saveState() {
  try {
    const db = await getDb();
    // Only serializable source metadata is persisted. The File /
    // FileSystemFileHandle is deliberately NOT stored (mirrors the monolith,
    // which omitted it to avoid duplicating the blob already held in
    // `originalData`). SQLite payloads stay in memory only.
    const sourcesArray = Array.from(sourceFiles.entries()).map(([, v]) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      profile: v.profile,
      originalData: v.type === 'sqlite' || v.type === 'db' ? null : v.originalData,
    }));
    await db.put(STORE_NAME, { key: 'bookmarks', data: bookmarks });
    await db.put(STORE_NAME, { key: 'sources', data: sourcesArray });
    return true;
  } catch (err) {
    // Mirror the monolith: a failed cache write must never break the UI flow.
    // The caller (persistAndRender) turns this into a visible warning.
    console.warn('IndexedDB save failed:', err);
    return false;
  }
}

/**
 * Restore state from IndexedDB into the module-level bindings.
 *
 * Callers own the UI side-effects (render + restore toast), mirroring the
 * original monolith which performed both inside its loader.
 *
 * @returns {Promise<boolean>} `true` when persisted rows were found and applied.
 */
export async function loadState() {
  const db = await getDb();
  await migrateLegacyDb(db);
  const [bookmarksRow, sourcesRow] = await Promise.all([
    db.get(STORE_NAME, 'bookmarks'),
    db.get(STORE_NAME, 'sources'),
  ]);

  if (bookmarksRow && sourcesRow) {
    setBookmarks(bookmarksRow.data || []);
    const sources = sourcesRow.data || [];
    setSourceFiles(new Map(sources.map((s) => [s.id, s])));
    return true;
  }
  return false;
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
