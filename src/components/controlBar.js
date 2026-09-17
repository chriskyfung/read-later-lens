/**
 * @fileoverview Workspace control bar — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html
 * "Control Bar: Sort, View Tabs & Batch Actions"). Behavior mapping:
 *  - .main-tab buttons → src/views/workspaceActions.js (registerWorkspaceListeners)
 *  - sortSelect        → src/views/workspaceActions.js
 *  - batch actions     → src/views/workspaceActions.js
 *  - filteredCount     → src/views/bookmarks.js / tabs.js (renderers)
 */

/** @returns {string} The control bar markup. */
export function controlBarHtml() {
  return `
      <!-- Control Bar: Sort, View Tabs & Batch Actions -->
      <div class="bg-slate-800/40 border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
        <!-- View Mode Tabs -->
        <div class="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button data-tab="bookmarks"
            class="main-tab active px-3 py-1 rounded-md text-xs font-semibold text-white bg-indigo-600 shadow">
            書籤列表 (<span id="filteredCount">0</span>)
          </button>
          <button data-tab="wordcloud"
            class="main-tab px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200">
            ☁️ 文字雲 (Word Cloud)
          </button>
          <button data-tab="domains"
            class="main-tab px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200">
            📊 域名統計
          </button>
          <button data-tab="linkage"
            class="main-tab px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200">
            🕸️ 概念關聯網
          </button>
        </div>

        <!-- Right Controls: Sort Dropdown & Batch Selection -->
        <div class="flex items-center space-x-3">
          <!-- Sort Dropdown -->
          <div class="flex items-center space-x-2 text-xs text-slate-400">
            <span>排序方式:</span>
            <select id="sortSelect"
              class="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500">
              <option value="relevance">搜尋相關度 (Relevance)</option>
              <option value="newer">最新優先 (Newer First)</option>
              <option value="older">最舊優先 (Older First)</option>
              <option value="title_asc">標題 A-Z</option>
              <option value="title_desc">標題 Z-A</option>
            </select>
          </div>

          <!-- Batch Action Toggle Bar -->
          <div id="batchActionBar"
            class="hidden items-center space-x-2 bg-indigo-900/40 border border-indigo-500/40 px-3 py-1 rounded-lg text-xs text-indigo-200">
            <span>已選擇 <strong id="selectedCount">0</strong> 項</span>
            <button id="batchDeleteBtn"
              class="bg-rose-600 hover:bg-rose-500 px-2 py-0.5 rounded text-white font-medium">批量刪除</button>
            <button id="batchCancelBtn" class="text-slate-400 hover:text-slate-200 underline">取消</button>
          </div>
        </div>
      </div>
`;
}
