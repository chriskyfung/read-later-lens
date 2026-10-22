/**
 * @fileoverview Sidebar actions — folder select/delete.
 *
 * Extracted from src/views/sidebarActions.js when the sidebar split into
 * src/views/sidebar/*. The language-filter listeners live in
 * src/views/sidebar/listeners.js and the storage indicator in
 * src/views/sidebar/storage.js.
 */

import * as state from '../../core/state.js';
import { stateStillFresh } from '../../core/guard.js';
import { showToast } from '../../utils/dom.js';
import { getDeps } from './deps.js';
import { FOLDER_ALL } from './constants.js';

/**
 * Select a source folder (generated row data-select-folder).
 * @param {string} folderId
 */
export function selectFolder(folderId) {
  state.setActiveFolder(folderId);
  getDeps().render();
}

/**
 * Confirm and delete a source file with its bookmarks (generated row data-delete-folder).
 * @param {Event} e
 * @param {string} fileId
 */
export async function confirmDeleteFolder(e, fileId) {
  e.stopPropagation();
  const file = state.sourceFiles.get(fileId);
  if (confirm(`確定要刪除檔案「${file ? file.name : ''}」與其包含的所有書籤嗎？`)) {
    return deleteFolder(fileId);
  }
  return false;
}

/**
 * Remove a source file and its bookmarks — permanently (monolith side-effect
 * order, extended with the trash purge).
 *
 * Folder deletion is deliberately NOT a soft delete: the file, its active
 * bookmarks AND its trashed bookmarks all go away in one step. That invariant is
 * what makes "restore into a deleted folder" impossible, so no trashed record
 * can ever point at a missing source file.
 *
 * @param {string} fileId
 * @param {boolean} [triggerRender=true]
 * @returns {Promise<boolean>} `true` when the file and its bookmarks were deleted;
 *   `false` when nothing was deleted, or when refused because another tab wrote.
 */
export async function deleteFolder(fileId, triggerRender = true) {
  // Gate before the first mutation: deleting on top of a working set this tab
  // has not seen would discard rows the other tab just wrote.
  if (!(await stateStillFresh())) return false;

  // Purge every record owned by the file, trashed or not.
  const doomed = state.bookmarks.filter((b) => b.source_file_id === fileId).map((b) => b.id);
  state.sourceFiles.delete(fileId);
  state.purgeBookmarks(doomed);
  doomed.forEach((id) => state.selectedIds.delete(id));
  if (state.activeFolder === fileId) {
    state.setActiveFolder(FOLDER_ALL);
  }
  const { persist, render } = getDeps();
  persist();
  if (triggerRender) {
    render();
    showToast('已刪除檔案及其所有書籤（含回收桶）');
  }
  return true;
}
