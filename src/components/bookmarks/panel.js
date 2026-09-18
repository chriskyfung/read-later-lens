/**
 * @fileoverview Bookmarks grid panel — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html
 * "Panel 1: Bookmarks Grid View"). Card rendering lives in
 * src/views/bookmarks.js.
 */

/** @returns {string} The bookmarks panel markup. */
export function panelBookmarksHtml() {
  return `
        <!-- Panel 1: Bookmarks Grid View -->
        <div id="panelBookmarks" class="tab-panel">

          <!-- Select All Header Row -->
          <div class="flex items-center justify-between mb-4 pb-2 border-b border-slate-800 text-xs text-slate-400">
            <label class="flex items-center space-x-2 cursor-pointer select-none">
              <input type="checkbox" id="selectAllCheckbox"
                class="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-800">
              <span>全選本頁書籤</span>
            </label>
            <span id="activeFilterSummary" class="text-slate-500">顯示全部資料</span>
          </div>

          <!-- Bookmark Cards Container -->
          <div id="bookmarkCardsGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Dynamic bookmark cards inserted here -->
          </div>

          <!-- Empty State -->
          <div id="emptyState" class="hidden flex flex-col items-center justify-center py-20 text-center">
            <div class="bg-slate-800/80 p-4 rounded-full text-slate-500 mb-4">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253">
                </path>
              </svg>
            </div>
            <h3 class="text-slate-300 font-semibold mb-1">尚未載入書籤或未找到符合的資料</h3>
            <p class="text-slate-500 text-xs max-w-sm mb-4">點擊右上角的「匯入」載入 Instapaper 的 CSV, JSON 或 SQLite (.db) 檔案。</p>
          </div>
        </div>
`;
}
