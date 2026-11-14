/** @fileoverview Header search bar — input, magnifier icon, help button, and quick-reset button markup.
 *
 * Pure string builder: no imports, no state, no user data interpolated.
 *
 * The quick-reset button ships `hidden`; registerHeaderListeners() (in
 * ../behavior/listeners.js) toggles it once the input has text.
 *
 * A help (❔) button with accessible tooltip shows search operators and syntax tips.
 */
/** Search input + magnifier icon + help button + hidden-by-default clear-reset button. */
export function headerSearchBarHtml() {
  return `
    <div class="relative w-full">
      <input type="text" id="searchInput" aria-describedby="searchHelpTooltip" title="輸入搜尋；Enter 立即搜尋；點擊 ❔ 看完整語法" placeholder="搜尋標題、網址、預覽或標籤..."
        class="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 text-sm text-slate-100 rounded-xl pl-10 pr-14 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition">
      <svg class="size-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor"
        viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
      </svg>
      <!-- Search help button: shows operators + tips on hover/focus/click -->
      <button id="searchHelpBtn" type="button" aria-haspopup="tooltip" aria-label="搜尋語法說明"
        class="absolute right-10 top-2.5 text-slate-500 hover:text-slate-200 transition-colors">
        <span class="text-sm font-medium">❔</span>
      </button>
      <!-- Quick reset: clears the search input (shown only when non-empty) -->
      <button id="clearSearchBtn" type="button" title="清除搜尋條件"
        class="hidden absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-200 transition-colors">
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
      <!-- Tooltip: search operators + syntax tips (shown on hover/focus/click) -->
      <div id="searchHelpTooltip" role="tooltip" class="hidden fixed z-50 max-w-xs bg-slate-800 border border-indigo-500/50 p-3 rounded-lg shadow-2xl pointer-events-none text-xs">
        <div class="font-bold text-white mb-2">搜尋語法說明</div>
        <dl class="space-y-1.5 text-slate-300">
          <dt class="font-medium text-indigo-300">關鍵字</dt><dd>空格分隔，預設 AND 邏輯</dd>
          <dt class="font-medium text-indigo-300">"精確詞組"\dt><dd>雙引號包裹</dd>
          <dt class="font-medium text-indigo-300">link:網址</dt><dd>篩選 URL（支援部份比對）</dd>
          <dt class="font-medium text-indigo-300">is:fav / is:♥</dt><dd>僅顯示收藏書籤</dd>
        </dl>
        <div class="mt-2 pt-2 border-t border-slate-700 text-slate-500 text-xs">
          Enter 立即搜尋  •  Esc 關閉提示
        </div>
      </div>
    </div>
  `.trim();
}
