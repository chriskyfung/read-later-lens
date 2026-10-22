/**
 * @fileoverview Advisory "has another tab changed the library?" probe.
 */

import { REV_KEY, STORE_NAME } from './constants.js';
import { getDb } from './connection.js';
import { getKnownRev } from './revision.js';

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
    return (row?.data ?? undefined) === getKnownRev();
  } catch (err) {
    console.warn('Stale-state probe failed:', err);
    return true;
  }
}
