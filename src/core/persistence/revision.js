/**
 * @fileoverview Owner of this tab's optimistic-concurrency revision baseline.
 *
 * Leaf module: it holds one piece of mutable state and knows nothing about
 * IndexedDB, so the read/write comparison can be reasoned about (and tested)
 * without a database.
 */

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

/** @returns {string | undefined} The revision this tab last read or wrote. */
export function getKnownRev() {
  return knownRev;
}

/**
 * Record the revision this tab has now seen (read) or written.
 *
 * @param {string | undefined} rev
 */
export function setKnownRev(rev) {
  knownRev = rev;
}

/**
 * Forget the baseline.
 *
 * Used when the underlying connection is dropped: keeping a stale baseline
 * would let a later save skip the rev check against a database that no longer
 * holds what it describes.
 */
export function clearKnownRev() {
  knownRev = undefined;
}
