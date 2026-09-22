import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mountWorkspace, workspaceHtml } from '../src/components/workspace.js';

// ---- DOM stubs -----------------------------------------------------------
// mountWorkspace appends the composed <main> to #appBody via
// insertAdjacentHTML with position 'beforeend' (main must follow the sidebar).
const captured = [];

beforeAll(() => {
  globalThis.window = globalThis.window || {};
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'appBody') {
        return {
          insertAdjacentHTML: (position, html) => {
            captured.push({ position, html });
          },
        };
      }
      return null;
    },
    createElement: () => ({ innerHTML: '', className: '' }),
  };
});

beforeEach(() => {
  captured.length = 0;
  mountWorkspace();
});

const html = () => workspaceHtml();

describe('mountWorkspace — composition', () => {
  it('mounts once into #appBody with beforeend (after the sidebar)', () => {
    expect(captured).toHaveLength(1);
    expect(captured[0].position).toBe('beforeend');
  });

  it('composes control bar → viewport → panels 1-4 inside <main>', () => {
    const order = [
      'Control Bar: Sort, View Tabs & Batch Actions',
      'Main Display Panels Container',
      'id="panelBookmarks"',
      'id="panelWordcloud"',
      'id="panelDomains"',
      'id="panelLinkage"',
    ];
    const positions = order.map((m) => html().indexOf(m));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html()).toMatch(
      /^[\s\S]*<main class="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden">/,
    );
    expect(html()).toMatch(/<\/main>\s*$/);
  });
});

describe('controlBar — markup parity', () => {
  it('keeps the four view tabs with data-tab values, labels and active start', () => {
    expect(html()).toContain('data-tab="bookmarks"');
    expect(html()).toContain('data-tab="wordcloud"');
    expect(html()).toContain('data-tab="domains"');
    expect(html()).toContain('data-tab="linkage"');
    expect(html()).toContain('書籤列表 (<span id="filteredCount">0</span>)');
    expect(html()).toContain('☁️ 文字雲 (Word Cloud)');
    expect(html()).toContain('📊 域名統計');
    expect(html()).toContain('🕸️ 概念關聯網');
    expect(html()).toMatch(/data-tab="bookmarks"\s*\n?\s*class="main-tab active /);
    expect(html()).toContain('main-tab px-3 py-1 rounded-md text-xs font-medium text-slate-400');
  });

  it('keeps the sort dropdown with all five options', () => {
    expect(html()).toContain('id="sortSelect"');
    expect(html()).toContain('排序方式:');
    for (const v of ['relevance', 'newer', 'older', 'title_asc', 'title_desc']) {
      expect(html(), v).toContain(`value="${v}"`);
    }
    expect(html()).toContain('搜尋相關度 (Relevance)');
    expect(html()).toContain('標題 A-Z');
    expect(html()).toContain('標題 Z-A');
  });

  it('keeps the batch action bar (hidden at start)', () => {
    expect(html()).toContain('id="batchActionBar"');
    expect(html()).toContain('id="selectedCount"');
    expect(html()).toContain('id="batchDeleteBtn"');
    expect(html()).toContain('id="batchCancelBtn"');
    expect(html()).toContain('已選擇 <strong id="selectedCount">0</strong> 項');
    expect(html()).toContain('批量刪除');
    expect(html()).toMatch(/id="batchActionBar"\s*\n?\s*class="hidden /);
  });
});
// END-PART1

describe('panelBookmarks — markup parity', () => {
  it('keeps the select-all row, cards grid and empty state', () => {
    expect(html()).toContain('id="panelBookmarks"');
    expect(html()).toMatch(/id="panelBookmarks" class="tab-panel">/); // visible at start
    expect(html()).toContain('id="selectAllCheckbox"');
    expect(html()).toContain('全選本頁書籤');
    expect(html()).toContain('id="activeFilterSummary"');
    expect(html()).toContain('顯示全部資料');
    expect(html()).toContain('id="bookmarkCardsGrid"');
    expect(html()).toContain('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4');
    expect(html()).toContain('id="emptyState"');
    expect(html()).toContain('尚未載入書籤或未找到符合的資料');
    expect(html()).toContain(
      '點擊右上角的「匯入」載入 Instapaper 的 CSV, JSON 或 SQLite (.db) 檔案。',
    );
    expect(html()).toContain(
      'd="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"',
    );
  });
});

describe('panelWordcloud — markup parity', () => {
  it('keeps the hidden panel, intro card and container', () => {
    expect(html()).toMatch(/id="panelWordcloud" class="tab-panel hidden h-full flex flex-col">/);
    expect(html()).toContain('☁️ 關鍵字文字雲 (Word Cloud Analytics)');
    expect(html()).toContain('N-Gram 斷詞分析');
    expect(html()).toContain('id="wordCloudContainer"');
    expect(html()).toContain('flex flex-wrap items-center justify-center gap-3');
  });
});

describe('panelDomains — markup parity', () => {
  it('keeps the hidden panel, intro card and container', () => {
    expect(html()).toMatch(/id="panelDomains" class="tab-panel hidden">/);
    expect(html()).toContain('📊 來源域名與網站統計分析');
    expect(html()).toContain('前 15 大熱門網站來源與比例');
    expect(html()).toContain('id="domainChartContainer"');
    expect(html()).toContain('space-y-3 max-w-3xl mx-auto');
  });
});

describe('panelLinkage — markup parity', () => {
  it('keeps the hidden panel, zoom controls and canvas', () => {
    expect(html()).toMatch(
      /id="panelLinkage" class="tab-panel hidden h-full flex flex-col relative">/,
    );
    expect(html()).toContain('🕸️ 書籤概念關聯圖 (D3 Force Graph)');
    expect(html()).toContain('id="zoomInBtn"');
    expect(html()).toContain('id="zoomOutBtn"');
    expect(html()).toContain('id="resetGraphBtn"');
    expect(html()).toContain('title="放大"');
    expect(html()).toContain('title="縮小"');
    expect(html()).toContain('重置視圖');
    expect(html()).toContain(
      'd="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"',
    );
    expect(html()).toContain('d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"');
    expect(html()).toContain('id="d3GraphCanvas"');
    expect(html()).toContain('min-h-112.5');
  });

  it('keeps the fixed D3 tooltip with its field ids', () => {
    expect(html()).toContain('id="graphTooltip"');
    expect(html()).toContain('-translate-x-1/2 -translate-y-full');
    expect(html()).toContain('id="ttTitle"');
    expect(html()).toContain('id="ttDomain"');
    expect(html()).toContain('id="ttTags"');
    expect(html()).toContain('line-clamp-2');
  });
});
