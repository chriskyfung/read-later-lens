import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mountHeader } from '../src/components/header.js';

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
    expect(html()).toContain('Instapaper 書籤管理器');
    expect(html()).toContain('跨格式書籤聚合、智慧搜尋與動態文字分析系統');
    expect(html()).toContain('d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"'); // brand svg
  });

  it('keeps the search input with its placeholder and icon', () => {
    expect(html()).toContain('id="searchInput"');
    expect(html()).toContain(
      '搜尋標題、網址、預覽內容或標籤...（多關鍵字以空格分隔；&quot;...&quot; 精確比對；link:網址 篩選 URL）',
    );
    expect(html()).toContain('d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"'); // search svg
  });

  it('adds the quick-reset button with room reserved in the input', () => {
    expect(html()).toContain('id="clearSearchBtn"');
    expect(html()).toContain('清除搜尋條件');
    expect(html()).toContain('d="M6 18L18 6M6 6l12 12"'); // reset svg
    expect(html()).toContain('pr-10'); // input padding leaves room for the button
  });

  it('keeps the import label with the hidden file input', () => {
    expect(html()).toContain('id="fileInput"');
    expect(html()).toContain('multiple accept=".csv,.json,.db"');
    expect(html()).toContain('匯入 CSV, JSON, 或 SQLite (.db) 檔案'); // title tooltip
    expect(html()).toContain('<span>匯入</span>');
    expect(html()).toContain('d="M12 4v16m8-8H4"'); // import svg
  });

  it('keeps the save/back (export) button', () => {
    expect(html()).toContain('id="saveBackBtn"');
    expect(html()).toContain('儲存變更或匯出檔案');
    expect(html()).toContain('<span>匯出</span>');
    expect(html()).toContain(
      'd="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"',
    );
  });

  it('keeps the clear-cache button and its spinnerable icon', () => {
    expect(html()).toContain('id="clearCacheBtn"');
    expect(html()).toContain('id="clearCacheIcon"');
    expect(html()).toContain('清除本地快取');
    expect(html()).toContain(
      'd="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"',
    );
  });

  it('uses the monolith header chrome classes', () => {
    expect(html()).toContain('bg-slate-800/90 backdrop-blur border-b border-slate-700');
    expect(html()).toContain('flex items-center justify-between z-20 shrink-0');
  });
});
