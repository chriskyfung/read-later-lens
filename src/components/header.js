/**
 * @fileoverview Top navigation header — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html
 * "Top Navigation Header"). Behavior mapping:
 *  - searchInput  → src/views/header.js (registerHeaderListeners)
 *  - clearCacheBtn → src/views/header.js (registerHeaderListeners)
 *  - fileInput    → src/io/importer.js
 *  - saveBackBtn  → src/io/exporter.js
 *
 * mountHeader() inserts the header as the FIRST child of <body>
 * (insertAdjacentHTML 'afterbegin'), preserving the monolith's DOM order.
 */

/** @returns {string} The header markup. */
export function headerHtml() {
  return `
  <!-- Top Navigation Header -->
  <header id="appHeader"
    class="bg-slate-800/90 backdrop-blur border-b border-slate-700 px-6 py-3 flex items-center justify-between z-20 shrink-0">
    <div class="flex items-center space-x-3">
      <div class="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/30">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
        </svg>
      </div>
      <div>
        <h1 class="font-bold text-lg text-white tracking-wide">Instapaper 書籤管理器</h1>
        <p class="text-xs text-slate-400">跨格式書籤聚合、智慧搜尋與動態文字分析系統</p>
      </div>
    </div>

    <!-- Search & Quick Actions -->
    <div class="flex items-center space-x-2 flex-1 max-w-xl mx-8">
      <div class="relative w-full">
        <input type="text" id="searchInput" placeholder="搜尋標題、網址、預覽內容或標籤...（多關鍵字以空格分隔，&quot;...&quot; 為精確比對）"
          class="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 text-sm text-slate-100 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
        <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor"
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center space-x-2">
      <label title="匯入 CSV, JSON, 或 SQLite (.db) 檔案"
        class="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-md transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        <span>匯入</span>
        <input type="file" id="fileInput" multiple accept=".csv,.json,.db" class="hidden">
      </label>

      <button id="saveBackBtn" title="儲存變更或匯出檔案"
        class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-md transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
        </svg>
        <span>匯出</span>
      </button>

      <button id="clearCacheBtn" title="清除本地快取"
        class="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-2.5 py-2 rounded-lg transition active:scale-95">
        <svg id="clearCacheIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
          </path>
        </svg>
      </button>
    </div>
  </header>
`;
}

/**
 * Insert the header as the first child of <body> (monolith DOM order).
 */
export function mountHeader() {
  document.body.insertAdjacentHTML('afterbegin', headerHtml());
}
