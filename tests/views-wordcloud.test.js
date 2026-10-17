import { describe, it, expect, beforeAll, vi } from 'vitest';
import { renderWordCloud, initWordCloud } from '../src/views/wordcloud.js';
import { setBookmarks, setSearchQuery, searchQuery, activeTab } from '../src/core/state.js';
import { loadKeywordsEngine } from '../src/analytics/keywords.js';

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

beforeAll(async () => {
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
  // The English keyword engine loads lazily; these synchronous render tests
  // must run with it already available (the unloaded path has its own tests).
  await loadKeywordsEngine();
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
    const renderCb = () => {
      renderCount += 1;
    };
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

// The engine-loading path needs a fresh module registry, so it lives in its
// own describe with dynamically imported modules. The view is two-stage:
// stage 1 paints the plain path instantly (never a placeholder), stage 2
// upgrades to lemma grouping when the chunk arrives — or settles back on the
// plain path when it fails.
describe('renderWordCloud — two-stage engine load', () => {
  it('paints plain terms immediately, then upgrades to lemmas once the engine arrives', async () => {
    vi.resetModules();
    const keywords = await import('../src/analytics/keywords.js');
    const view = await import('../src/views/wordcloud.js');
    const state = await import('../src/core/state.js');

    state.setSearchQuery('');
    state.setBookmarks([
      { id: '1', title: 'apple pie recipe', article_preview: 'pie text', detected_language: 'en' },
    ]);

    let renders = 0;
    // The real renderAll() re-invokes renderWordCloud when the tab is open;
    // the injected dep does the same so the post-load upgrade is observable.
    view.initWordCloud({
      render: () => {
        renders += 1;
        view.renderWordCloud();
      },
    });

    created.length = 0;
    view.renderWordCloud();
    // Stage 1: real spans NOW — the plain path never waits for the chunk,
    // and the old blocking placeholder must never come back.
    expect(created.length).toBeGreaterThan(0);
    expect(created[0].innerText).toMatch(/\(\d+\)$/);
    expect(els.wordCloudContainer.innerHTML).not.toContain('正在載入關鍵字分析引擎');
    // The pending lemma upgrade is hinted natively, not as a blocking state.
    expect(els.wordCloudContainer.title).toContain('優化');

    await keywords.loadKeywordsEngine();
    // The load resolved and the view re-rendered itself via the injected dep —
    // exactly once, no matter how many stage-1 passes saw the pending load.
    await vi.waitFor(() => expect(renders).toBe(1));
    expect(created.length).toBeGreaterThan(0);
    // Settled on the grouped path: the pending hint is gone.
    expect(els.wordCloudContainer.title).toBe('');
  });

  it('settles on the plain path when the engine chunk fails to load', async () => {
    vi.resetModules();
    // Force the dynamic import to reject: the view must still render terms.
    vi.doMock('compromise', () => {
      throw new Error('chunk load failed');
    });
    const keywords = await import('../src/analytics/keywords.js');
    const view = await import('../src/views/wordcloud.js');
    const state = await import('../src/core/state.js');

    state.setSearchQuery('');
    state.setBookmarks([
      { id: '1', title: 'apple pie recipe', article_preview: 'pie text', detected_language: 'en' },
    ]);

    created.length = 0;
    view.renderWordCloud();
    // Stage 1 paints plain terms even though the chunk is doomed — never a
    // dead loading state, never an empty container.
    expect(created.length).toBeGreaterThan(0);
    expect(created[0].innerText).toMatch(/\(\d+\)$/);
    expect(els.wordCloudContainer.title).toContain('優化');

    const engine = await keywords.loadKeywordsEngine();
    expect(engine).toBeNull();
    expect(keywords.keywordsReady()).toBe(false);

    // After the failure, needsKeywordEngine() reports false — the view keeps
    // painting the plain path instead of looping on a pending upgrade.
    created.length = 0;
    view.renderWordCloud();
    expect(created.length).toBeGreaterThan(0);
    expect(created[0].innerText).toMatch(/\(\d+\)$/);
    expect(els.wordCloudContainer.title).toBe('');

    vi.doUnmock('compromise');
    vi.resetModules();
  });
});
