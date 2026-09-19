/**
 * @fileoverview Word-cloud panel — presentational markup only.
 *
 * Extracted byte-for-byte from the original monolith (index.html
 * "Panel 2: Word Cloud View"). Rendering lives in src/views/wordcloud.js.
 */

/** @returns {string} The word-cloud panel markup. */
export function panelWordcloudHtml() {
  return `
        <!-- Panel 2: Word Cloud View -->
        <div id="panelWordcloud" class="tab-panel hidden h-full flex flex-col">
          <div class="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5 mb-4">
            <h3 class="text-sm font-semibold text-indigo-300 mb-1">☁️ 關鍵字文字雲 (Word Cloud Analytics)</h3>
            <p class="text-xs text-slate-400">系統自動整合擴充版英文 Stopwords 停用詞過濾與詞幹還原，並對中日文內文進行 N-Gram 斷詞分析。點擊任意關鍵字可立即進行全局搜尋。
            </p>
          </div>
          <div id="wordCloudContainer"
            class="flex-1 bg-slate-800/30 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-center gap-3 overflow-y-auto">
            <!-- Word Cloud dynamic elements -->
          </div>
        </div>
`;
}
