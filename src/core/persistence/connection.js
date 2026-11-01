/**
 * @fileoverview Lifecycle of the single IndexedDB connection.
 *
 * Owns the `dbPromise` singleton, so the rest of `src/core/persistence/` can ask for
 * "the database" without each keeping its own handle.
 */

import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, STORE_NAME } from './constants.js';
import { clearKnownRev } from './revision.js';

/** @type {Promise<import('idb').IDBPDatabase> | null} */
let dbPromise = null;

/**
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
export function getDb() {
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
 * Close the connection and forget everything derived from it.
 *
 * Forgetting the connection forgets the revision we last verified against it.
 * Keeping a stale baseline would let a later save skip the rev check against
 * a database that no longer holds what it describes.
 *
 * Test-only contract: `closeDb()` swaps the underlying database (see
 * store.test.js, which deletes and re-creates it between cases), so the next
 * `saveState()` must refuse until `loadState()` re-reads a baseline against
 * the new database — never compare the OLD baseline against the NEW rows.
 * Production code never calls this: IndexedDB connections stay open for the
 * tab's lifetime, so `knownRev` always describes the database it came from.
 */
export async function closeDb() {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  clearKnownRev();
}
