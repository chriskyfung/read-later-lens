/**
 * @fileoverview Sidebar folders / source-files section markup.
 *
 * The folder / source-files section markup is preserved from the monolith;
 * Tailwind classes and DOM hooks match the original byte-for-byte. The dynamic
 * file rows inside #folderList are rendered by ../behavior/folders.js.
 */

/** @returns {string} The folders / source-files section markup. */
export function sidebarFoldersSectionHtml() {
  return `      <!-- Source Files / Folders -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">資料夾 / 來源檔案</h2>
          <span id="totalSourceCount" class="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">0</span>
        </div>
        <div id="folderList" class="space-y-1">
          <button data-folder="ALL" id="allFolderBtn"
            class="folder-btn active w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
            <span class="flex items-center gap-2 truncate">
              <i class="size-4" data-lucide="gallery-vertical-end"></i>
              <span class="truncate">全部書籤 (All Items)</span>
            </span>
            <span id="allCountBadge" class="bg-indigo-900/50 text-indigo-200 text-xs px-1.5 py-0.5 rounded-sm">0</span>
          </button>
          <button data-folder="TRASH" id="trashFolderBtn"
            class="folder-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between text-slate-300 border border-transparent hover:bg-slate-700/50">
            <span class="flex items-center gap-2 truncate">
              <i class="size-4" data-lucide="trash"></i>
              <span class="truncate">回收桶 (Trash)</span>
            </span>
            <span id="trashCountBadge" class="bg-rose-900/50 text-rose-200 text-xs px-1.5 py-0.5 rounded-sm">0</span>
          </button>
          <div id="folderListSeparator" class="border-t border-slate-700/60 my-1.5" role="separator"></div>
          <!-- Dynamic File items inserted here -->
        </div>
      </div>`;
}
