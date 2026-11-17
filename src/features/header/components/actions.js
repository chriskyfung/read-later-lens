/**
 * @fileoverview Header action buttons — import, file input, export, and clear-cache markup.
 *
 * Pure string builder: no imports, no state, no user data interpolated.
 *
 * Listener ownership (unchanged by the split):
 *  - #importBtn / #fileInput  → src/io/import/  (source picker modal)
 *  - #saveBackBtn             → src/io/export/  (save-back / export)
 *  - #clearCacheBtn           → ../behavior/listeners.js  (clear-cache flow)
 */

/** Import / export / clear-cache button row (#fileInput stays hidden). */
export function headerActionsHtml() {
  return `
    <button type="button" id="importBtn" title="選擇匯入來源並載入 CSV, JSON, 或 SQLite (.db) 檔案"
      class="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-md transition">
      <i class="size-4" data-lucide="file-input"></i>
      <span>匯入</span>
    </button>
    <input type="file" id="fileInput" multiple accept=".csv,.json,.db,.sqlite" class="hidden">

    <button id="saveBackBtn" title="儲存變更或匯出檔案"
      class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-md transition">
      <i class="size-4" data-lucide="file-output"></i>
      <span>匯出</span>
    </button>

    <button id="clearCacheBtn" title="清除本地快取"
      class="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-2.5 py-2 rounded-lg transition active:scale-95">
      <i class="size-4" data-lucide="trash" id="clearCacheIcon"></i>
    </button>
  `.trim();
}
