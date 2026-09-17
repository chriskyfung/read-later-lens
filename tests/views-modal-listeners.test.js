import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { registerModalListeners } from '../src/views/modalListeners.js';
import { openReaderModal } from '../src/views/readerModal.js';
import { openSimilarityModal } from '../src/views/similarityModal.js';
import { setBookmarks } from '../src/core/state.js';

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    href: '',
    _l: {},
    addEventListener(type, fn) { (this._l[type] = this._l[type] || []).push(fn); },
    removeEventListener(type, fn) {
      this._l[type] = (this._l[type] || []).filter((f) => f !== fn);
    },
    dispatch(type, ev) {
      (this._l[type] || []).forEach((fn) => fn(ev || { stopPropagation() {} }));
    },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    children: [],
    appendChild(c) { this.children.push(c); },
    onclick: null,
  };
}
function el(id) {
  if (!els[id]) els[id] = makeEl();
  return els[id];
}

beforeAll(() => {
  globalThis.window = globalThis.window || {};
  globalThis.document = {
    // Auto-create elements like a real DOM after mountModals() has run.
    getElementById: (id) => el(id),
    createElement: () => makeEl(),
  };
});

beforeEach(() => {
  for (const k of Object.keys(els)) delete els[k];
  // Reset every stubbed element so classList state does not leak between tests.
  setBookmarks([
    {
      id: '1',
      title: 'apple pie recipe',
      url: 'https://a.com/x',
      article_preview: 'pie text',
      content: '',
      instapaper_url: 'https://www.instapaper.com/read/1',
      detected_language: 'en',
      tags: [],
    },
  ]);
});

describe('registerModalListeners', () => {
  it('wires both reader close buttons to closeReaderModal', () => {
    registerModalListeners();

    openReaderModal('1'); // opens the modal
    expect(el('readerModal').classList.contains('hidden')).toBe(false);

    el('closeReaderBtn').dispatch('click');
    expect(el('readerModal').classList.contains('hidden')).toBe(true);

    openReaderModal('1');
    el('closeReaderFooterBtn').dispatch('click');
    expect(el('readerModal').classList.contains('hidden')).toBe(true);
  });

  it('wires the similarity close button to closeSimilarityModal', () => {
    registerModalListeners();

    openSimilarityModal('1');
    expect(el('similarityModal').classList.contains('hidden')).toBe(false);

    el('closeSimilarityBtn').dispatch('click');
    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
  });

  it('tolerates missing buttons (null-safe registration)', () => {
    expect(() => registerModalListeners()).not.toThrow();
  });
});
