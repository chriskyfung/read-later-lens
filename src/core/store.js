/**
 * @fileoverview IndexedDB persistence via `idb` - promise-based wrapper.
 *
 * Replaces the original hand-rolled `indexedDB.open(...)` + request-event
 * boilerplate with a thin, mockable layer so the rest of the app never deals
 * with IDB request events. Behavior matches the monolith: SQLite payloads are
 * kept in memory only (not persisted).
 *
 * This is a *thin facade* over src/core/store/*. Splitting the file into focused
 * submodules keeps each concern isolated without forcing every importer to
 * rewrite its import path: every public name — the persistence entry points,
 * the stale-state probe, the storage meter and the test-only closer — is
 * re-exported from here.
 *
 * Layout:
 *   store/constants.js  — database identity and row keys (leaf).
 *   store/revision.js   — this tab's revision baseline (leaf).
 *   store/serialize.js  — projection of the source map into persistable rows.
 *   store/connection.js — the single IndexedDB connection and `closeDb()`.
 *   store/migration.js  — one-time migration from the pre-rebrand database.
 *   store/freshness.js  — the advisory "another tab wrote?" probe.
 *   store/save.js       — `saveState()` (all-or-nothing, conflict-aware).
 *   store/load.js       — `loadState()`.
 *   store/storage.js    — `getStorageUsage()` (leaf).
 *
 * The names are re-exported, never wrapped: `vi.spyOn(store, 'isStateFresh')`
 * on this module must still reach the implementation the guard reads.
 */

export { saveState, loadState, isStateFresh, getStorageUsage, closeDb } from './store/index.js';
