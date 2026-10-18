import { trashItemHtml } from '../../components/bookmarks/trashModal.js';
import { getTrashedBookmarks } from '../../core/filters.js';
import { TRASH_IDS, summaryText } from './constants.js';

/**
 * Render the modal's list + summary + empty state. Pure DOM orchestration:
 * never touches the bookmark grid or the sidebar — the trash lives in its own
 * modal, so those stay exactly as the current folder/langs/tag/search view
 * leaves them.
 */
export function renderTrashView() {
  const list = document.getElementById(TRASH_IDS.list);
  const summary = document.getElementById(TRASH_IDS.summary);
  const emptyState = document.getElementById(TRASH_IDS.emptyState);
  if (!list || !summary || !emptyState) return;

  const trashed = getTrashedBookmarks();

  summary.textContent = summaryText(trashed.length);

  // Clear on every render so the list always mirrors the projection, including
  // the empty case (清空回收桶 / last purge) — otherwise the previous rows
  // would linger behind the empty-state banner.
  list.innerHTML = '';

  if (trashed.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  list.innerHTML = trashed.map((bookmark) => trashItemHtml(bookmark)).join('');
}

/**
 * Snapshot the trash list's current DOM row count — call BEFORE mutating state
 * so patchTrashRow() can detect drift between the visible list and the new
 * projection. Returns 0 when the list is not mounted, which never matches a
 * pre-mutation list of rows, so patching is refused and the full render runs.
 * @returns {number}
 */
export function captureDomRowCount() {
  return document.getElementById(TRASH_IDS.list)?.children.length ?? 0;
}

/**
 * Patch the trash UI after a single-row mutation (restore / purge), leaving
 * every untouched row node in place instead of rebuilding the whole list.
 *
 * Safe by construction: the only new HTML written here would be produced by
 * the same audited trashItemHtml() builder the full render uses — but this
 * path only *removes* a row (restored and purged bookmarks both leave the
 * trash projection), so no new HTML is written at all. Row nodes carry the
 * `data-trash-row` id handle (escaped in trashItemHtml via the same
 * escapeHtml() attribute path as the action buttons).
 *
 * @param {string} id Id of the row that left the trash (restored or purged).
 * @param {number} expectedDomRows Row count the DOM must still show — captured
 *   BEFORE the mutation via captureDomRowCount() so any drift between what the
 *   user sees and what the patch assumes forces a full-render fallback.
 * @param {number} remainingCount Post-mutation trash size (0 → show the
 *   empty-state banner). Computed by the caller from the projection, so this
 *   helper never re-derives state it was not given.
 * @returns {boolean} True when the patch landed; false when the DOM drifted
 *   from what the caller captured — the caller must then fall back to
 *   renderTrashView() so the screen never disagrees with state.
 */
export function patchTrashRow(id, expectedDomRows, remainingCount) {
  const list = document.getElementById(TRASH_IDS.list);
  const summary = document.getElementById(TRASH_IDS.summary);
  const emptyState = document.getElementById(TRASH_IDS.emptyState);
  if (!list || !summary || !emptyState) return false;

  const rows = Array.from(list.children);
  // The DOM still shows the pre-mutation state (the caller captured its row
  // count before mutating); a mismatch means some other render interleaved,
  // so refuse to guess and let the caller rebuild.
  if (rows.length !== expectedDomRows) return false;

  const target = rows.find((row) => row.getAttribute?.('data-trash-row') === id);
  if (!target) return false;
  target.remove();

  summary.textContent = summaryText(remainingCount);
  if (remainingCount === 0) {
    emptyState.classList.remove('hidden');
  }
  return true;
}
