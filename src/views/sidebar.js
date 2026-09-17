/**
 * @fileoverview Sidebar rendering — folders/source files and the tag cloud.
 *
 * Preserves the monolith's folder counts, badges, tag-pill classes and empty
 * placeholder. Missing sidebar elements are skipped; counts are explicitly
 * converted to strings to match browser innerText coercion.
 *
 * Folder, tag and language interactions are registered by sidebarActions.js.
 * Generated controls carry IDs/tags as DOM data, not inline JavaScript.
 */

import { bookmarks, sourceFiles, activeFolder, activeTag } from '../core/state.js';

/**
 * Render the folder / source-file list in the sidebar.
 */
export function renderSidebarFolders() {
  const folderList = document.getElementById('folderList');
  const allFolderBtn = document.getElementById('allFolderBtn');
  const totalSourceCount = document.getElementById('totalSourceCount');
  const allCountBadge = document.getElementById('allCountBadge');

  if (totalSourceCount) totalSourceCount.innerText = String(sourceFiles.size);
  if (allCountBadge) allCountBadge.innerText = String(bookmarks.length);

  const isAllActive = activeFolder === 'ALL';
  if (allFolderBtn) {
    allFolderBtn.className = isAllActive
      ? 'folder-btn active w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
      : 'folder-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between text-slate-300 border border-transparent hover:bg-slate-700/50';
  }

  if (folderList) {
    folderList.querySelectorAll('.dynamic-file-btn').forEach((el) => el.remove());

    sourceFiles.forEach((file) => {
      const count = bookmarks.filter((b) => b.source_file_id === file.id).length;
      const btn = document.createElement('div');
      const isActive = activeFolder === file.id;

      btn.className = `dynamic-file-btn folder-btn w-full group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
        isActive
          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
          : 'text-slate-300 border-transparent hover:bg-slate-700/50'
      }`;

      const typeBadgeColor =
        file.type === 'csv'
          ? 'bg-amber-900/60 text-amber-200'
          : file.type === 'json'
            ? 'bg-emerald-900/60 text-emerald-200'
            : 'bg-sky-900/60 text-sky-200';

      btn.dataset.selectFolder = file.id;
      btn.innerHTML = `
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
      btn.querySelector('[data-delete-folder]').dataset.deleteFolder = file.id;
      folderList.appendChild(btn);
    });
  }
}

/**
 * Render the tag cloud.
 */
export function renderTagCloud() {
  const container = document.getElementById('tagFilterCloud');
  if (!container) return;

  const tagsMap = new Map();

  bookmarks.forEach((b) => {
    if (b.tags && Array.isArray(b.tags)) {
      b.tags.forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) tagsMap.set(trimmed, (tagsMap.get(trimmed) || 0) + 1);
      });
    }
  });

  if (tagsMap.size === 0) {
    container.innerHTML = '<span class="text-xs text-slate-500 italic">尚無標籤</span>';
    return;
  }

  container.innerHTML = '';
  tagsMap.forEach((cnt, tag) => {
    const isSelected = activeTag === tag;
    const pill = document.createElement('button');
    pill.className = `text-[11px] px-2 py-0.5 rounded-full border transition ${
      isSelected
        ? 'bg-indigo-600 text-white border-indigo-400 font-semibold'
        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
    }`;
    pill.innerText = `#${tag} (${cnt})`;
    pill.dataset.filterTag = tag;
    container.appendChild(pill);
  });
}

/**
 * Render all sidebar pieces (called by the main `renderAll` orchestrator).
 */
export function renderSidebar() {
  renderSidebarFolders();
  renderTagCloud();
}
