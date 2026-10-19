/** @fileoverview Header brand block — logo, title, and tagline markup.
 *
 * Extracted verbatim from src/components/header.js when the header markup
 * split into src/components/header/*. Pure string builder: no imports, no
 * state, no user data interpolated — nothing here is an XSS surface.
 */

/** Brand block: app icon, page title, and zh-TW tagline. */
export function headerBrandingHtml() {
  return `
    <div class="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/30">
      <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
      </svg>
    </div>
    <div>
      <h1 class="font-bold text-lg text-white tracking-wide">稍後閱讀透鏡 Read Later Lens</h1>
      <p class="text-xs text-slate-400">跨格式書籤聚合、智慧搜尋與動態文字分析系統</p>
    </div>
  `.trim();
}
