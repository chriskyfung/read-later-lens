/**
 * @fileoverview Database identity and row keys for the IndexedDB cache.
 *
 * Leaf module: depends on nothing, so every other module in `src/core/store/`
 * can import the names it needs without creating a cycle.
 */

/** Name of the IndexedDB database holding the cached working set. */
export const DB_NAME = 'ReadLaterLensDB';

/**
 * Database name used before the Read Later Lens rebrand. Existing users'
 * cached working sets live here and are migrated into `DB_NAME` on first load.
 */
export const LEGACY_DB_NAME = 'InstapaperBookmarkManagerDB';

/** Name of the single object store that holds every persisted row. */
export const STORE_NAME = 'app_state';

/** Schema version of the database. */
export const DB_VERSION = 1;

/**
 * Key of the optimistic-concurrency revision row inside `app_state`.
 *
 * Written in the SAME transaction as `bookmarks` and `sources`, so the three
 * rows always describe one another. Every write bumps it to a fresh UUID; a
 * tab whose baseline no longer matches the stored row knows another tab wrote
 * in the meantime and must not overwrite that work.
 */
export const REV_KEY = 'rev';
