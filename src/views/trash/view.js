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
