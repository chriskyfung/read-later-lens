/**
 * @fileoverview One-time migration from the pre-rebrand database name.
 *
 * Leaf module: it takes the target database as an argument and never reaches
 * for the shared connection, so it can be reasoned about on its own.
 */

import { openDB, deleteDB } from 'idb';
import { LEGACY_DB_NAME, DB_VERSION, STORE_NAME } from './constants.js';

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
export async function migrateLegacyDb(targetDb) {
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
