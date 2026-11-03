/**
 * @fileoverview Sidebar language-filter pills section markup.
 *
 * The language-filter pills section markup is preserved from the monolith;
 * Tailwind classes and DOM hooks match the original byte-for-byte. The click
 * handling lives in ../behavior/listeners.js.
 */

/** @returns {string} The language filters section markup. */
export function sidebarLanguageFiltersSectionHtml() {
  return `      <!-- Language Filters -->
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
      </div>`;
}
