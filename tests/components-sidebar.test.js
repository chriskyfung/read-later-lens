import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mountSidebar } from '../src/components/sidebar.js';

// ---- DOM stubs -----------------------------------------------------------
// mountSidebar appends sidebar markup into #appBody via insertAdjacentHTML
// with position 'afterbegin' (sidebar must be the FIRST child of the wrapper).
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
  mountSidebar();
});

const html = () => captured[0].html;

describe('mountSidebar — markup parity', () => {
  it('mounts once into #appBody as its first child (afterbegin)', () => {
    expect(captured).toHaveLength(1);
    expect(captured[0].position).toBe('afterbegin');
  });

  it('keeps the aside chrome and folders section', () => {
    expect(html()).toContain('<aside');
    expect(html()).toContain('w-72 bg-slate-800/50 border-r border-slate-700/80');
    expect(html()).toContain('資料夾 / 來源檔案');
    expect(html()).toContain('id="folderList"');
    expect(html()).toContain('id="totalSourceCount"');
    expect(html()).toContain('id="allFolderBtn"');
    expect(html()).toContain('data-folder="ALL"');
    expect(html()).toContain('id="allCountBadge"');
    expect(html()).toContain('全部書籤 (All Items)');
    expect(html()).toContain(
      'd="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"'
    ); // folder svg
  });

  it('keeps all five language pills with their data-lang values and labels', () => {
    expect(html()).toContain('id="languageFilters"');
    expect(html()).toContain('語系過濾');
    expect(html()).toContain('data-lang="ALL"');
    expect(html()).toContain('data-lang="en"');
    expect(html()).toContain('data-lang="zh"');
    expect(html()).toContain('data-lang="ja"');
    expect(html()).toContain('data-lang="other"');
    expect(html()).toContain('>全部</button>');
    expect(html()).toContain('英文');
    expect(html()).toContain('中文');
    expect(html()).toContain('日文');
    expect(html()).toContain('其他');
    // The ALL pill starts active, the rest inactive (monolith classes).
    expect(html()).toMatch(/data-lang="ALL"\s*\n?\s*class="lang-btn active /);
    expect(html()).toContain('lang-btn text-xs px-2.5 py-1 rounded-md bg-slate-700');
  });

  it('keeps the tag cloud section with its empty-state hint', () => {
    expect(html()).toContain('id="tagFilterCloud"');
    expect(html()).toContain('自訂標籤');
    expect(html()).toContain('尚無標籤');
  });

  it('keeps the storage usage indicator', () => {
    expect(html()).toContain('id="storageUsageText"');
    expect(html()).toContain('id="storageProgressBar"');
    expect(html()).toContain('快取儲存空間');
    expect(html()).toContain('0 KB / 50MB');
    expect(html()).toContain('bg-indigo-500 h-full w-0 transition-all duration-300');
  });
});
