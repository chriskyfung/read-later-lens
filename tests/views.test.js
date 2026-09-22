import { describe, it, expect, beforeAll } from 'vitest';
import { openReaderModal, closeReaderModal } from '../src/views/readerModal.js';
import { openSimilarityModal, closeSimilarityModal } from '../src/views/similarityModal.js';
import { setBookmarks } from '../src/core/state.js';

// ---- DOM stubs ----------------------------------------------------------
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    style: {},
    href: '',
    classList: {
      _s: new Set(),
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
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    onclick: null,
  };
}

const els = {};
function el(id) {
  if (!els[id]) els[id] = makeEl();
  return els[id];
}

const created = [];

const readerIds = [
  'readerModal',
  'readerTitle',
  'readerLangBadge',
  'readerOriginalUrl',
  'readerPreviewContent',
  'readerInstapaperBtn',
];
const simIds = ['similarityModal', 'simTargetTitle', 'simResultsList'];

beforeAll(() => {
  globalThis.document = globalThis.document || {};
  globalThis.document.getElementById = (id) => (els[id] ? el(id) : null);
  globalThis.document.createElement = () => {
    const e = makeEl();
    created.push(e);
    return e;
  };

  setBookmarks([
    {
      id: '1',
      title: 'apple pie recipe',
      url: 'https://a.com/x',
      article_preview: 'pie text',
      content: 'full article body',
      instapaper_url: 'https://www.instapaper.com/read/1',
      detected_language: 'en',
      tags: [],
    },
    {
      id: '2',
      title: 'apple tart recipe',
      url: 'https://a.com/y',
      article_preview: 'tart text',
      content: '',
      instapaper_url: 'https://www.instapaper.com/read/2',
      detected_language: 'zh',
      tags: [],
    },
  ]);
});

// ---- Reader modal -------------------------------------------------------
describe('openReaderModal', () => {
  it('fills fields and shows the modal (Tailwind hidden toggle)', () => {
    for (const id of readerIds) el(id); // pre-create so getElementById finds them
    openReaderModal('1');
    expect(el('readerTitle').innerText).toBe('apple pie recipe');
    expect(el('readerLangBadge').innerText).toBe('EN'); // uppercased default
    expect(el('readerOriginalUrl').href).toBe('https://a.com/x');
    expect(el('readerOriginalUrl').innerText).toBe('https://a.com/x');
    // content-first fallback (monolith parity)
    expect(el('readerPreviewContent').innerText).toBe('full article body');
    // instapaper_url contract (guards the reader_url regression)
    expect(el('readerInstapaperBtn').href).toBe('https://www.instapaper.com/read/1');
    expect(el('readerModal').classList.contains('hidden')).toBe(false);
  });

  it('falls back to article_preview when content is empty', () => {
    openReaderModal('2');
    expect(el('readerLangBadge').innerText).toBe('ZH');
    expect(el('readerPreviewContent').innerText).toBe('tart text');
  });

  it('closeReaderModal re-adds hidden', () => {
    closeReaderModal();
    expect(el('readerModal').classList.contains('hidden')).toBe(true);
  });

  it('no-ops for unknown ids', () => {
    expect(() => openReaderModal('missing')).not.toThrow();
  });
});

// ---- Similarity modal ---------------------------------------------------
describe('openSimilarityModal', () => {
  it('renders monolith-parity rows and shows the modal', () => {
    for (const id of simIds) el(id);
    created.length = 0;
    openSimilarityModal('1');
    expect(el('simTargetTitle').innerText).toBe('apple pie recipe');
    // Rows are appended as child elements (monolith parity), not innerHTML.
    const rows = created.filter((e) => e.onclick);
    expect(rows.length).toBeGreaterThan(0);
    const html = rows.map((r) => r.innerHTML).join('');
    expect(html).toContain('% 相似');
    expect(html).toContain('bg-emerald-950'); // monolith badge colours
    expect(html).toContain('line-clamp-1'); // monolith preview clamp
    expect(rows[0].className).toContain('p-3 bg-slate-900/80'); // monolith row class
    expect(el('similarityModal').classList.contains('hidden')).toBe(false);
  });

  it('row click closes similarity and opens the reader for that doc', () => {
    created.length = 0;
    openSimilarityModal('1');
    const rows = created.filter((e) => e.onclick);
    expect(rows.length).toBeGreaterThan(0);
    // Reset reader state, then click the first row.
    el('readerModal').classList.add('hidden');
    rows[0].onclick();
    // Similarity modal hidden again...
    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
    // ...and the reader modal opened for the most similar doc (id '2').
    expect(el('readerModal').classList.contains('hidden')).toBe(false);
    expect(el('readerTitle').innerText).toBe('apple tart recipe');
  });

  it('closeSimilarityModal re-adds hidden', () => {
    closeSimilarityModal();
    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
  });

  it('no-ops for unknown ids', () => {
    expect(() => openSimilarityModal('missing')).not.toThrow();
  });
});
