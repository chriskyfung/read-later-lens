/**
 * @fileoverview IndexedDB persistence via `idb` - promise-based wrapper.
 *
 * Replaces the original hand-rolled `indexedDB.open(...)` + request-event
 * boilerplate with a thin, mockable layer so the rest of the app never deals
 * with IDB request events. Behavior matches the monolith: SQLite payloads are
 * kept in memory only (not persisted).
 */

import { openDB } from 'idb';
import { bookmarks, sourceFiles, setBookmarks, setSourceFiles } from './state.js';

const DB_NAME = 'InstapaperBookmarkManagerDB';
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

export async function closeDb() {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/** @returns {Promise<void>} */
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
      originalData: v.type === 'sqlite' || v.type === 'db' ? null : v.originalData,
    }));
    await db.put(STORE_NAME, { key: 'bookmarks', data: bookmarks });
    await db.put(STORE_NAME, { key: 'sources', data: sourcesArray });
  } catch (err) {
    // Mirror the monolith: a failed cache write must never break the UI flow.
    console.warn('IndexedDB save failed:', err);
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
