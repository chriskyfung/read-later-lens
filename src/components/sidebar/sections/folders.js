/**
 * @fileoverview Sidebar folders / source-files section markup.
 *
 * Static monolith parity: extracted byte-for-byte from the original
 * src/components/sidebar.js sidebarHtml() template (index.html "Left Sidebar").
 * The dynamic file rows inside #folderList are rendered by src/views/sidebar.js.
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
            <span class="flex items-center space-x-2 truncate">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10">
                </path>
              </svg>
              <span class="truncate">全部書籤 (All Items)</span>
            </span>
            <span id="allCountBadge" class="bg-indigo-900/50 text-indigo-200 text-xs px-1.5 py-0.5 rounded">0</span>
          </button>
          <button data-folder="TRASH" id="trashFolderBtn"
            class="folder-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between text-slate-300 border border-transparent hover:bg-slate-700/50">
            <span class="flex items-center space-x-2 truncate">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
                </path>
              </svg>
              <span class="truncate">回收桶 (Trash)</span>
            </span>
            <span id="trashCountBadge" class="bg-rose-900/50 text-rose-200 text-xs px-1.5 py-0.5 rounded">0</span>
          </button>
          <div id="folderListSeparator" class="border-t border-slate-700/60 my-1.5" role="separator"></div>
          <!-- Dynamic File items inserted here -->
        </div>
      </div>`;
}
