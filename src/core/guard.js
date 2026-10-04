/**
 * @fileoverview One gate for "has another tab changed the library?".
 *
 * Combines the storage probe (`isStateFresh`) with the single user-facing
 * refusal message, so every destructive action refuses the same way instead of
 * each view inventing its own wording.
 *
 * The probe is advisory: `saveState()` repeats the same comparison *inside* its
 * writing transaction and remains the authoritative check, so an action that
 * slips past here can never produce a silent stale write — at worst it mutates
 * memory, is refused at persist, and is reported by `persistAfterAction`.
 */

import { isStateFresh } from './store.js';
import { showToast } from '../utils/dom.js';

/**
 * The short reason shared by every surface that has to say *why* an action was
 * refused — the guard's own toast and the importer's per-file failure text.
 * The reason is the base string; the full message composes from it, so one
 * edit propagates everywhere instead of drifting between copies.
 */
export const STALE_STATE_REASON = '另一個分頁已更新資料';

/** The full refusal shown when another tab's write makes an action unsafe. */
export const STALE_STATE_MESSAGE = `${STALE_STATE_REASON}，請重新載入後再試`;

/**
 * Ask whether the action may proceed, refusing it (with a toast) when it may not.
 *
 * Call before the first mutation: `if (!(await stateStillFresh())) return false;`
 *
 * Fails open on *any* error rather than closed. A guard must never be the
 * reason an action cannot run — the worst case of opening here is that the
 * write is refused one layer later by `saveState()`, which cannot be skipped.
 *
 * @returns {Promise<boolean>} `true` when this tab may proceed; `false` when
 *   another tab has written since this tab last read or wrote the cache.
 *
 * The "probe failed" warning is intentionally worded in guard terms (`gate`),
 * not storage terms (`probe`): both layers log the same underlying failure,
 * and the wording tells a log reader at a glance which layer admitted the
 * action anyway (this gate) versus which simply reported no divergence.
 */
export async function stateStillFresh() {
  let fresh;
  try {
    fresh = await isStateFresh();
  } catch (err) {
    console.warn('Stale-state gate failed open:', err);
    return true;
  }
  if (fresh) return true;

  showToast(STALE_STATE_MESSAGE);
  return false;
}
