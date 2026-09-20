/**
 * @fileoverview Sidebar folder-row presentational helpers.
 *
 * Extracted from src/views/sidebar.js `renderSidebarFolders()` — the class
 * builder for `#allFolderBtn`, plus the class/badge/markup builders for a
 * dynamic source-file row. Classes and markup are preserved byte-for-byte from
 * the monolith; the host view still owns DOM creation and dataset wiring.
 */

/**
 * Class list for the "all files" folder button, driven by selection state.
 *
 * @param {boolean} isActive
 * @returns {string}
 */
export function sidebarAllFolderBtnClass(isActive) {
  return isActive
    ? 'folder-btn active w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
    : 'folder-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between text-slate-300 border border-transparent hover:bg-slate-700/50';
}

/**
 * Class list for a dynamic source-file button, driven by selection state.
 *
 * @param {boolean} isActive
 * @returns {string}
 */
export function sidebarFolderItemClass(isActive) {
  return `dynamic-file-btn folder-btn w-full group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
    isActive
      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
      : 'text-slate-300 border-transparent hover:bg-slate-700/50'
  }`;
}

/**
 * Badge colour classes for a source-file type (csv / json / other).
 *
 * @param {string} type
 * @returns {string}
 */
export function sidebarFolderBadgeColorClass(type) {
  return type === 'csv'
    ? 'bg-amber-900/60 text-amber-200'
    : type === 'json'
      ? 'bg-emerald-900/60 text-emerald-200'
      : 'bg-sky-900/60 text-sky-200';
}

/**
 * Build the inner HTML of a dynamic source-file row.
 *
 * Preserved exactly from the monolith: the type badge, the file name, the
 * bookmark count and the delete button. No DOM reads — pure string builder.
 *
 * @param {{file: {id: string, name: string, type: string}, count: number}} opts
 * @returns {string}
 */
export function sidebarFolderItemHtml({ file, count }) {
  const typeBadgeColor = sidebarFolderBadgeColorClass(file.type);
  return `
        <div class="flex items-center space-x-2 truncate flex-1">
          <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${typeBadgeColor} shrink-0">${file.type}</span>
          <span class="truncate">${file.name}</span>
        </div>
        <div class="flex items-center space-x-1 shrink-0">
            <span class="block group-hover:hidden bg-slate-800 text-slate-400 text-xs px-1.5 py-0.5 rounded">${count}</span>
            <button data-delete-folder class="hidden group-hover:block text-slate-400 hover:text-rose-400 p-1" title="刪除檔案與其書籤">
               <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
      `;
}