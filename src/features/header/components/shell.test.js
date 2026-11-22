import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mountHeader } from './shell.js';

// ---- DOM stubs -----------------------------------------------------------
// mountHeader appends header markup to document.body via insertAdjacentHTML
// with position 'afterbegin' (header must be the FIRST child of body).
const captured = [];

beforeAll(() => {
  globalThis.window = globalThis.window || {};
  globalThis.document = {
    body: {
      insertAdjacentHTML: (position, html) => {
        captured.push({ position, html });
      },
    },
    getElementById: () => null,
    createElement: () => ({ innerHTML: '', className: '' }),
  };
});

beforeEach(() => {
  captured.length = 0;
  mountHeader();
});

const html = () => captured[0].html;

describe('mountHeader — markup parity', () => {
  it('mounts once, as the first child of body (afterbegin)', () => {
    expect(captured).toHaveLength(1);
    expect(captured[0].position).toBe('afterbegin');
  });

  it('keeps the brand block and zh-TW title', () => {
    expect(html()).toContain('稍後閱讀透鏡 Read Later Lens');
    expect(html()).toContain('跨格式書籤聚合、智慧搜尋與動態文字分析系統');
    expect(html()).toContain('d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"'); // brand svg
  });

  it('keeps the search input with shortened placeholder, help button and tooltip', () => {
    expect(html()).toContain('id="searchInput"');
    expect(html()).toContain('placeholder="搜尋標題、網址、預覽或標籤..."');
    expect(html()).toContain('title="輸入搜尋；Enter 立即搜尋；點擊 ❔ 看完整語法"');
    expect(html()).toContain('aria-describedby="searchHelpTooltip"');
    expect(html()).toContain('id="searchHelpBtn"');
    expect(html()).toContain('data-lucide="circle-question-mark"');
    expect(html()).toContain('id="searchHelpTooltip"');
    expect(html()).toContain('role="tooltip"');
    expect(html()).toContain('搜尋語法說明');
    expect(html()).toContain('關鍵字');
    expect(html()).toContain('"精確詞組"');
    expect(html()).toContain('link:網址');
    expect(html()).toContain('is:fav');
    expect(html()).toContain('is:♥');
    expect(html()).toContain('is:queue');
    expect(html()).toContain('僅顯示閱讀佇列書籤');
    expect(html()).toContain('data-lucide="search"'); // search svg
  });

  it('adds the quick-reset button with room reserved in the input', () => {
    expect(html()).toContain('id="clearSearchBtn"');
    expect(html()).toContain('清除搜尋條件');
    expect(html()).toContain('data-lucide="x"'); // reset svg
    expect(html()).toContain('pr-14'); // input padding leaves room for the button
  });

  it('keeps the import button with the hidden file input', () => {
    expect(html()).toContain('id="importBtn"');
    expect(html()).toContain('id="fileInput"');
    expect(html()).toContain('multiple accept=".csv,.json,.db,.sqlite"');
    expect(html()).toContain('選擇匯入來源並載入 CSV, JSON, 或 SQLite (.db) 檔案'); // title tooltip
    expect(html()).toContain('<span>匯入</span>');
    expect(html()).toContain('data-lucide="file-input"'); // import svg
    // The picker is opened by the button now — no label-wrapped input.
    expect(html()).not.toContain('<label');
  });

  it('keeps the save/back (export) button', () => {
    expect(html()).toContain('id="saveBackBtn"');
    expect(html()).toContain('儲存變更或匯出檔案');
    expect(html()).toContain('<span>匯出</span>');
    expect(html()).toContain('data-lucide="file-output"'); // export svg
  });

  it('keeps the clear-cache button and its spinnerable icon', () => {
    expect(html()).toContain('id="clearCacheBtn"');
    expect(html()).toContain('id="clearCacheIcon"');
    expect(html()).toContain('清除本地快取');
    expect(html()).toContain('data-lucide="trash"'); // clear-cache icon
  });

  it('uses the monolith header chrome classes', () => {
    expect(html()).toContain('bg-slate-800/90 backdrop-blur-sm border-b border-slate-700');
    expect(html()).toContain('flex items-center justify-between z-20 shrink-0');
  });
});
