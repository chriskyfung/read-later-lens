import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { renderDomainChart, initDomains } from '../src/views/domains.js';
import { setBookmarks, setSearchQuery, searchQuery, activeTab } from '../src/core/state.js';

function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    style: {},
    value: '',
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
  };
}

function makePanel(id) {
  return {
    id,
    classList: {
      _s: new Set(['tab-panel', 'hidden']),
      add(c) {
        this._s.add(c);
      },
      remove(c) {
        this._s.delete(c);
      },
      contains(c) {
        return this._s.has(c);
      },
    },
  };
}

const els = {};
const created = [];
const tabStubs = [
  { dataset: { tab: 'bookmarks' }, className: '' },
  { dataset: { tab: 'wordcloud' }, className: '' },
  { dataset: { tab: 'domains' }, className: '' },
  { dataset: { tab: 'linkage' }, className: '' },
];
const panelStubs = {};

const bm = (id, url) => ({
  id: String(id),
  title: `t${id}`,
  url,
  article_preview: '',
  content: '',
  instapaper_url: `https://www.instapaper.com/read/${id}`,
  detected_language: 'en',
  tags: [],
  source_file_id: 'f1',
  source_file_name: 'a.csv',
});

beforeAll(() => {
  globalThis.document = globalThis.document || {};
  globalThis.document.getElementById = (id) => {
    if (!els[id]) els[id] = makeEl();
    return els[id];
  };
  globalThis.document.createElement = () => {
    const e = makeEl();
    created.push(e);
    return e;
  };
  const panels = ['panelBookmarks', 'panelWordcloud', 'panelDomains', 'panelLinkage'].map((id) => {
    const p = makePanel(id);
    panelStubs[id] = p;
    els[id] = p; // getElementById must resolve to the panel stub
    return p;
  });
  globalThis.document.querySelectorAll = (sel) => (sel === '.main-tab' ? tabStubs : panels);
  globalThis.window = globalThis.window || {};

  setSearchQuery('');
});

const baseBookmarks = () => [
  bm(1, 'https://www.example.com/a'),
  bm(2, 'https://example.com/b'),
  bm(3, 'https://other.org/c'),
];

beforeEach(() => {
  // Isolation: a leftover search query would filter records out.
  setSearchQuery('');
  setBookmarks(baseBookmarks());
});

describe('renderDomainChart', () => {
  it('renders monolith-parity cards with rounded percentages', () => {
    created.length = 0;
    renderDomainChart();

    expect(created.length).toBe(2); // example.com (2) + other.org (1)
    const [top, second] = created;
    expect(top.className).toContain('p-3 bg-slate-800/60');
    expect(top.className).toContain('hover:border-indigo-500/50');
    expect(top.innerHTML).toContain('example.com');
    // 2/2 -> 100%, 1/2 -> 50% (rounded, and both displayed in the caption)
    expect(top.innerHTML).toContain('2 篇文章 (100%)');
    expect(second.innerHTML).toContain('1 篇文章 (50%)');
    expect(second.innerHTML).toContain('bg-indigo-500');
    expect(top.innerHTML).toContain('style="width: 100%"');
    expect(second.innerHTML).toContain('style="width: 50%"');
  });

  it('shows the exact monolith empty-state span when nothing matches', () => {
    setBookmarks([]);
    renderDomainChart();
    expect(els.domainChartContainer.innerHTML).toBe(
      '<span class="text-slate-500 text-xs flex justify-center py-10">尚無域名資料</span>',
    );
  });

  it('caps the list at 15 domains', () => {
    setBookmarks(Array.from({ length: 20 }, (_, i) => bm(i + 1, `https://site${i}.com/x`)));
    created.length = 0;
    renderDomainChart();
    expect(created.length).toBe(15);
  });

  it('click flow sets search, activates the bookmarks tab, renders', () => {
    let renderCount = 0;
    const renderCb = () => { renderCount += 1; };
    setSearchQuery('');
    setBookmarks([bm(1, 'https://example.com/a'), bm(2, 'https://other.org/b')]);
    created.length = 0;
    initDomains({ render: renderCb });
    renderDomainChart();

    created[0].onclick();

    expect(searchQuery).toBe('example.com');
    expect(els.searchInput.value).toBe('example.com');
    // Extracted tab-switch mechanics (not just setActiveTab): the panel is
    // unhidden and the tab bar restyled.
    expect(activeTab).toBe('bookmarks');
    expect(tabStubs[0].className).toContain('main-tab active');
    expect(panelStubs.panelBookmarks.classList.contains('hidden')).toBe(false);
    expect(renderCount).toBe(1);
  });

  it('renders the domain label text (escapeHtml is applied defensively)', () => {
    setBookmarks([bm(1, 'https://x.com/a')]);
    created.length = 0;
    renderDomainChart();
    expect(created).toHaveLength(1);
    expect(created[0].innerHTML).toContain('>x.com<');
  });
});
