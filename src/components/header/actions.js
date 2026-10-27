/** @fileoverview Header action buttons — import, file input, export, and clear-cache markup.
 *
 * Extracted verbatim from src/components/header.js when the header markup
 * split into src/components/header/*. Pure string builder: no imports, no
 * state, no user data interpolated.
 *
 * Listener ownership (unchanged by the split):
 *  - #importBtn / #fileInput  → src/io/import/  (source picker modal)
 *  - #saveBackBtn             → src/io/exporter.js  (save-back / export)
 *  - #clearCacheBtn           → src/views/header.js  (clear-cache flow)
 */

/** Import / export / clear-cache button row (#fileInput stays hidden). */
export function headerActionsHtml() {
  return `
    <button type="button" id="importBtn" title="選擇匯入來源並載入 CSV, JSON, 或 SQLite (.db) 檔案"
      class="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-md transition">
      <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
      <span>匯入</span>
    </button>
    <input type="file" id="fileInput" multiple accept=".csv,.json,.db,.sqlite" class="hidden">

    <button id="saveBackBtn" title="儲存變更或匯出檔案"
      class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-md transition">
      <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
      </svg>
      <span>匯出</span>
    </button>

    <button id="clearCacheBtn" title="清除本地快取"
      class="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-2.5 py-2 rounded-lg transition active:scale-95">
      <svg id="clearCacheIcon" class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
        </path>
      </svg>
    </button>
  `.trim();
}
