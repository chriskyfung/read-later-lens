/**
 * @fileoverview Selection toggle + batch action bar UI for the bookmark grid.
 *
 * Mutates the live selectedIds Set without re-rendering the grid (monolith
 * parity). Consumed by the grid cards and by src/views/workspace/actions.js.
 */
import { selectedIds } from '../../core/state';
import { WORKSPACE_IDS } from '../../components/workspace/constants.js';

/**
 * Toggle bookmark selection (mutates the live Set; no card re-render —
 * matches the original monolith).
 *
 * @param {string} id
 */
export function toggleSelectBookmark(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  updateBatchActionBar();
}

/**
 * Update the batch action bar visibility + selected count (monolith parity).
 */
export function updateBatchActionBar() {
  const bar = document.getElementById(WORKSPACE_IDS.BATCH_ACTION_BAR);
  const count = document.getElementById(WORKSPACE_IDS.SELECTED_COUNT);
  if (selectedIds.size > 0) {
    count.innerText = selectedIds.size;
    bar.classList.remove('hidden');
    bar.classList.add('flex');
  } else {
    bar.classList.add('hidden');
    bar.classList.remove('flex');
  }
}
