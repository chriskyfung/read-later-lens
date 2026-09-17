import { describe, it, expect, beforeAll } from 'vitest';
import { renderWordCloud, initWordCloud } from '../src/views/wordcloud.js';
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
  setBookmarks([
    {
      id: '1',
      title: 'apple pie recipe apple pie recipe',
      url: 'https://a.com/x',
      article_preview: 'pie text',
      content: '',
      instapaper_url: 'https://www.instapaper.com/read/1',
      detected_language: 'en',
      tags: [],
      source_file_id: 'f1',
      source_file_name: 'a.csv',
    },
  ]);
});

describe('renderWordCloud', () => {
  it('renders monolith-parity spans with visible counts', () => {
    created.length = 0;
    renderWordCloud();

    expect(created.length).toBeGreaterThan(0);
    for (const span of created) {
      // Class parity guards W4.
      expect(span.className).toContain('font-bold');
      expect(span.className).toContain('text-indigo-300');
      expect(span.className).toContain('hover:text-white');
      expect(span.className).toContain('word-cloud-item');
      // Label format guards W3 (count visible, not hover-only).
      expect(span.innerText).toMatch(/\(\d+\)$/);
      expect(span.style.fontSize).toMatch(/rem$/);
    }
  });

  it('click flow sets search, activates the bookmarks tab, renders', () => {
    let renderCount = 0;
    const renderCb = () => { renderCount += 1; };
    setSearchQuery('');

    initWordCloud({ render: renderCb });
    created.length = 0;
    renderWordCloud();
    created[0].onclick();

    expect(els.searchInput.value).not.toBe('');
    // Extracted tab-switch mechanics: activateTab runs directly (no switchTab
    // spy) — state and tab-bar styling both update.
    expect(activeTab).toBe('bookmarks');
    expect(tabStubs[0].className).toContain('main-tab active');
    // The bookmarks panel is unhidden by activateTab.
    expect(panelStubs.panelBookmarks.classList.contains('hidden')).toBe(false);
    expect(renderCount).toBe(1);
  });

  it('searchQuery state is set from the clicked word', () => {
    setSearchQuery('');
    renderWordCloud();
    created[0].onclick();
    // The label is `word (count)`; the query must be the bare word.
    const word = created[0].innerText.replace(/ \(\d+\)$/, '');
    expect(searchQuery).toBe(word);
  });

  it('shows the exact monolith empty-state span (guards W5)', () => {
    setBookmarks([]);
    renderWordCloud();
    expect(els.wordCloudContainer.innerHTML).toBe(
      '<span class="text-slate-500 text-xs">尚無文字資料可分析</span>',
    );
  });
});
