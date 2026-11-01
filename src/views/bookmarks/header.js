/**
 * @fileoverview Bookmark grid header side-effects.
 *
 * Owns #filteredCount / #selectAllCheckbox / #activeFilterSummary writes and
 * the folder/source-file name resolution. Uses WORKSPACE_IDS for the shell
 * control-bar id that belongs to the workspace shell.
 */
import { selectedIds, activeFolder, activeLang, sourceFiles } from '../../core/state';
import { WORKSPACE_IDS } from '../../components/workspace/constants.js';

/**
 * Resolve the human-readable folder / source-file name (monolith parity):
 * 'ALL' → 全部檔案, known folder → file.name, unknown → 未知.
 *
 * @returns {string}
 */
export function resolveFolderName() {
  let folderName = '全部檔案';
  if (activeFolder !== 'ALL') {
    const f = sourceFiles.get(activeFolder);
    folderName = f ? f.name : '未知';
  }
  return folderName;
}

/**
 * Update the grid header side-effects (#filteredCount, #selectAllCheckbox,
 * #activeFilterSummary). Reads activeLang / folder / selection state.
 *
 * @param {import('../../core/model/BookmarkRecord.js').BookmarkRecord[]} filtered
 */
export function updateBookmarksHeader(filtered) {
  document.getElementById(WORKSPACE_IDS.FILTERED_COUNT).innerText = filtered.length;
  document.getElementById('selectAllCheckbox').checked =
    filtered.length > 0 && filtered.every((b) => selectedIds.has(b.id));
  document.getElementById('activeFilterSummary').innerText =
    `目前分類: ${resolveFolderName()} | 語系: ${activeLang} | 符合: ${filtered.length} 筆`;
}
