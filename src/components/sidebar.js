/**
 * @fileoverview Left sidebar — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html
 * "Left Sidebar"). Behavior mapping:
 *  - folder rows (dynamic)  → src/views/sidebar.js (renderer)
 *  - folder select/delete   → src/views/sidebarActions.js (window.IBM.* onclick)
 *  - allFolderBtn / languageFilters → src/views/sidebarActions.js
 *  - storage usage          → src/views/sidebarActions.js (updateStorageUsageUI)
 *  - tag cloud (dynamic)    → src/views/sidebar.js
 *
 * mountSidebar() inserts the sidebar as the FIRST child of the #appBody
 * wrapper (insertAdjacentHTML 'afterbegin'), preserving the monolith's DOM
 * order (header > body-wrapper > [sidebar, main]).
 */

/** @returns {string} The sidebar markup. */
export function sidebarHtml() {
  return `
    <!-- Left Sidebar -->
    <aside
      class="w-72 bg-slate-800/50 border-r border-slate-700/80 flex flex-col shrink-0 overflow-y-auto p-4 space-y-6">

      <!-- Source Files / Folders -->
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
          <!-- Dynamic File items inserted here -->
        </div>
      </div>

      <!-- Language Filters -->
      <div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">語系過濾</h2>
        <div id="languageFilters" class="flex flex-wrap gap-1.5">
          <button data-lang="ALL"
            class="lang-btn active text-xs px-2.5 py-1 rounded-md bg-indigo-600 text-white font-medium">全部</button>
          <button data-lang="en"
            class="lang-btn text-xs px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300">英文
            (EN)</button>
          <button data-lang="zh"
            class="lang-btn text-xs px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300">中文
            (ZH)</button>
          <button data-lang="ja"
            class="lang-btn text-xs px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300">日文
            (JA)</button>
          <button data-lang="other"
            class="lang-btn text-xs px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300">其他</button>
        </div>
      </div>

      <!-- Custom Tags Filter -->
      <div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">自訂標籤</h2>
        <div id="tagFilterCloud" class="flex flex-wrap gap-1">
          <span class="text-xs text-slate-500 italic">尚無標籤</span>
        </div>
      </div>

      <!-- IndexedDB Storage Info -->
      <div class="pt-4 border-t border-slate-700/60 mt-auto">
        <div class="text-[11px] text-slate-400 flex justify-between mb-1">
          <span>快取儲存空間</span>
          <span id="storageUsageText">0 KB / 50MB</span>
        </div>
        <div class="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div id="storageProgressBar" class="bg-indigo-500 h-full w-0 transition-all duration-300"></div>
        </div>
      </div>
    </aside>
`;
}

/**
 * Insert the sidebar as the first child of the #appBody wrapper
 * (monolith DOM order: header > body-wrapper > [sidebar, main]).
 */
export function mountSidebar() {
  document.getElementById('appBody').insertAdjacentHTML('afterbegin', sidebarHtml());
}
