/** @fileoverview Header search bar — input, magnifier icon, and quick-reset button markup.

 * Extracted verbatim from src/components/header.js when the header markup
 * split into src/components/header/*. Pure string builder: no imports, no
 * state, no user data interpolated.

 * The quick-reset button ships `hidden`; registerHeaderListeners() (in
 * src/views/header/) toggles it once the input has text.
 */

/** Search input + magnifier icon + hidden-by-default clear-reset button. */
export function headerSearchBarHtml() {
  return `
    <div class="relative w-full">
      <input type="text" id="searchInput" title="輸入後自動搜尋；按 Enter 立即搜尋；支援 link: 網址篩選、is:fav / is:♥ 收藏篩選" placeholder="搜尋標題、網址、預覽內容或標籤...（多關鍵字以空格分隔；&quot;...&quot; 精確比對；link:網址 篩選 URL；is:fav 或 is:♥ 僅顯示收藏書籤）"
        class="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 text-sm text-slate-100 rounded-xl pl-10 pr-10 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition">
      <svg class="size-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor"
        viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
      </svg>
      <!-- Quick reset: clears the search input (shown only when non-empty) -->
      <button id="clearSearchBtn" type="button" title="清除搜尋條件"
        class="hidden absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-200 transition-colors">
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `.trim();
}
