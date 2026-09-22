import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { registerModalListeners } from '../src/views/modalListeners.js';
import { openReaderModal, getReaderBookmarkId } from '../src/views/readerModal.js';
import { openSimilarityModal } from '../src/views/similarityModal.js';
import { openSaveModal } from '../src/io/exporter.js';
import { resetLayers, stackDepth } from '../src/utils/dom.js';
import { setBookmarks, bookmarks } from '../src/core/state.js';

// ---- DOM stubs -----------------------------------------------------------
const els = {};
const created = [];
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    href: '',
    style: {},
    inert: false,
    parentElement: null,
    _attrs: {},
    _l: {},
    addEventListener(type, fn) {
      (this._l[type] = this._l[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      this._l[type] = (this._l[type] || []).filter((f) => f !== fn);
    },
    dispatch(type, ev) {
      (this._l[type] || []).forEach((fn) => fn(ev || { stopPropagation() {} }));
    },
    setAttribute(name, value) {
      this._attrs[name] = String(value);
    },
    getAttribute(name) {
      return this._attrs[name];
    },
    removeAttribute(name) {
      delete this._attrs[name];
    },
    classList: {
      // Real overlays mount with the Tailwind `hidden` class already applied.
      _s: new Set(['hidden']),
      add(c) {
        this._s.add(c);
      },
      remove(c) {
        this._s.delete(c);
      },
      contains(c) {
        return this._s.has(c);
      },
      toggle(c, force) {
        const on = force === undefined ? !this._s.has(c) : Boolean(force);
        if (on) this._s.add(c);
        else this._s.delete(c);
        return on;
      },
    },
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    onclick: null,
    focused: 0,
    focus() {
      this.focused += 1;
    },
    querySelectorAll: () => [],
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
    createElement: () => {
      const e = makeEl();
      created.push(e);
      return e;
    },
    activeElement: null,
    _doc: {},
    addEventListener(type, fn) {
      (this._doc[type] = this._doc[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      this._doc[type] = (this._doc[type] || []).filter((f) => f !== fn);
    },
    dispatch(type, ev) {
      (this._doc[type] || []).forEach((fn) => fn(ev));
    },
  };
});

const b1 = {
  id: '1',
  title: 'apple pie recipe',
  url: 'https://a.com/x',
  content: 'full article body',
  article_preview: 'pie text',
  instapaper_url: 'https://www.instapaper.com/read/1',
  detected_language: 'en',
  tags: [],
};
const b2 = { ...b1, id: '2', title: 'apple tart recipe' };

/** Rows rendered by the most recent similarity render (they carry the onclick). */
const simRows = () => created.filter((e) => typeof e.onclick === 'function');

/** Press Escape through the document-level handler. */
const esc = () =>
  globalThis.document.dispatch('keydown', { key: 'Escape', preventDefault: vi.fn() });

beforeEach(() => {
  resetLayers();
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  for (const k of Object.keys(els)) delete els[k];
  created.length = 0;
  globalThis.document._doc = {};
  globalThis.document.activeElement = null;
  setBookmarks([b1, b2]);
});

describe('registerModalListeners', () => {
  it('wires the reader close button to closeReaderModal', () => {
    registerModalListeners();

    openReaderModal('1'); // opens the modal
    expect(el('readerModal').classList.contains('hidden')).toBe(false);

    el('closeReaderBtn').dispatch('click');
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

  it('deletes the open bookmark from the reader after confirm', () => {
    registerModalListeners();
    openReaderModal('1');
    expect(getReaderBookmarkId()).toBe('1');
    expect(el('readerModal').classList.contains('hidden')).toBe(false);

    el('readerDeleteBtn').dispatch('click');

    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].id).toBe('2');
    expect(getReaderBookmarkId()).toBeNull();
    expect(el('readerModal').classList.contains('hidden')).toBe(true);
  });

  it('cancels the reader delete and keeps the modal open', () => {
    globalThis.confirm = vi.fn(() => false);
    registerModalListeners();
    openReaderModal('1');
    el('readerDeleteBtn').dispatch('click');

    expect(bookmarks).toHaveLength(2);
    expect(bookmarks[0].id).toBe('1');
    expect(getReaderBookmarkId()).toBe('1');
    expect(el('readerModal').classList.contains('hidden')).toBe(false);
  });

  it('stacks the similarity drawer on top of the reader for the same bookmark', () => {
    registerModalListeners();
    openReaderModal('1');
    el('readerSimilarityBtn').dispatch('click');

    // The reader stays open beneath the drawer...
    expect(el('readerModal').classList.contains('hidden')).toBe(false);
    expect(el('similarityModal').classList.contains('hidden')).toBe(false);
    expect(el('simTargetTitle').innerText).toBe('apple pie recipe');
    // ...and wins the paint order because z-index follows stack order.
    expect(Number(el('similarityModal').style.zIndex)).toBeGreaterThan(
      Number(el('readerModal').style.zIndex),
    );
  });

  it('closes the reader modal when Escape is pressed', () => {
    registerModalListeners();
    openReaderModal('1');
    expect(el('readerModal').classList.contains('hidden')).toBe(false);

    const event = { key: 'Escape', preventDefault: vi.fn() };
    globalThis.document.dispatch('keydown', event);

    expect(el('readerModal').classList.contains('hidden')).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('closes the similarity modal when Escape is pressed', () => {
    registerModalListeners();
    openSimilarityModal('1');
    expect(el('similarityModal').classList.contains('hidden')).toBe(false);

    esc();

    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
  });

  it('closes the save modal when Escape is pressed', () => {
    registerModalListeners();
    openSaveModal();
    expect(el('saveModal').classList.contains('hidden')).toBe(false);

    esc();

    expect(el('saveModal').classList.contains('hidden')).toBe(true);
  });

  it('does not consume Escape when no modal is open', () => {
    registerModalListeners();
    const event = { key: 'Escape', preventDefault: vi.fn() };

    globalThis.document.dispatch('keydown', event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('closes only the topmost modal so stacked overlays unwind one per press', () => {
    registerModalListeners();
    openReaderModal('1');
    openSimilarityModal('1');

    esc();
    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
    expect(el('readerModal').classList.contains('hidden')).toBe(false);

    esc();
    expect(el('readerModal').classList.contains('hidden')).toBe(true);
  });

  it('folds Tab focus back inside the open modal', () => {
    registerModalListeners();
    openReaderModal('1');
    const only = makeEl();
    only.classList.remove('hidden');
    el('readerModal').querySelectorAll = () => [only];
    globalThis.document.activeElement = only;

    const event = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() };
    globalThis.document.dispatch('keydown', event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(only.focused).toBe(1);
  });
});

describe('nested modal layers', () => {
  it('keeps the layer below inert while a modal is stacked above it', () => {
    registerModalListeners();
    openReaderModal('1');
    expect(el('readerModal').inert).toBe(false);

    openSimilarityModal('1');
    expect(el('readerModal').inert).toBe(true);
    expect(el('readerModal').getAttribute('aria-hidden')).toBe('true');
    expect(el('similarityModal').inert).toBe(false);

    esc();
    expect(el('readerModal').inert).toBe(false);
    expect(el('readerModal').getAttribute('aria-hidden')).toBe('false');
  });

  it('card -> similarity -> row -> reader: Escape reveals the drawer, then the grid', () => {
    registerModalListeners();
    created.length = 0;
    openSimilarityModal('1'); // [sim(A)] - as opened from a card
    const rows = simRows();
    expect(rows.length).toBeGreaterThan(0);

    rows[0].onclick(); // [sim(A), reader(B)]
    expect(stackDepth()).toBe(2);
    expect(el('readerTitle').innerText).toBe('apple tart recipe');

    esc(); // close reader(B) -> reveal sim(A)
    expect(el('readerModal').classList.contains('hidden')).toBe(true);
    expect(el('similarityModal').classList.contains('hidden')).toBe(false);
    expect(el('simTargetTitle').innerText).toBe('apple pie recipe');

    esc(); // close sim(A) -> grid
    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
    expect(stackDepth()).toBe(0);
  });

  it('card -> reader A -> similarity -> reader B: Escape unwinds to the drawer, then reader A, then the grid', () => {
    registerModalListeners();
    openReaderModal('1'); // [reader(A)]
    created.length = 0;
    el('readerSimilarityBtn').dispatch('click'); // [reader(A), sim(A)]
    const rows = simRows();
    expect(rows.length).toBeGreaterThan(0);

    rows[0].onclick(); // [reader(A), sim(A), reader(B)]
    expect(stackDepth()).toBe(3);
    expect(el('readerTitle').innerText).toBe('apple tart recipe');

    esc(); // close reader(B) -> reveal sim(A)
    expect(el('similarityModal').classList.contains('hidden')).toBe(false);
    expect(el('simTargetTitle').innerText).toBe('apple pie recipe');
    // reader(A) stays mounted beneath, but only the top layer is live.
    expect(el('readerModal').classList.contains('hidden')).toBe(false);
    expect(el('readerModal').inert).toBe(true);
    expect(el('similarityModal').inert).toBe(false);
    expect(stackDepth()).toBe(2);

    esc(); // close sim(A) -> reveal reader(A), re-rendered from its payload
    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
    expect(el('readerModal').classList.contains('hidden')).toBe(false);
    expect(el('readerTitle').innerText).toBe('apple pie recipe');
    expect(getReaderBookmarkId()).toBe('1');
    expect(stackDepth()).toBe(1);

    esc(); // close reader(A) -> grid
    expect(el('readerModal').classList.contains('hidden')).toBe(true);
    expect(stackDepth()).toBe(0);
    expect(getReaderBookmarkId()).toBeNull();
  });

  it('unwinds a 4-deep reader/similarity loop in reverse order with the right content per layer', () => {
    registerModalListeners();
    openReaderModal('1'); // [reader(A)]
    created.length = 0;
    el('readerSimilarityBtn').dispatch('click'); // [reader(A), sim(A)]
    simRows()[0].onclick(); // [reader(A), sim(A), reader(B)]
    created.length = 0;
    el('readerSimilarityBtn').dispatch('click'); // [reader(A), sim(A), reader(B), sim(B)]

    expect(stackDepth()).toBe(4);
    expect(el('simTargetTitle').innerText).toBe('apple tart recipe');

    esc(); // close sim(B) -> reader B
    expect(el('readerTitle').innerText).toBe('apple tart recipe');
    expect(getReaderBookmarkId()).toBe('2');

    esc(); // close reader(B) -> sim A
    expect(el('similarityModal').classList.contains('hidden')).toBe(false);
    expect(el('simTargetTitle').innerText).toBe('apple pie recipe');

    esc(); // close sim(A) -> reader A
    expect(el('readerModal').classList.contains('hidden')).toBe(false);
    expect(el('readerTitle').innerText).toBe('apple pie recipe');
    expect(getReaderBookmarkId()).toBe('1');

    esc(); // close reader(A) -> grid
    expect(el('readerModal').classList.contains('hidden')).toBe(true);
    expect(stackDepth()).toBe(0);
    expect(getReaderBookmarkId()).toBeNull();
  });

  it('evicts the oldest layer when the runaway guard is hit', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerModalListeners();

    openReaderModal('1'); // bottom-most layer
    for (let i = 0; i < 10; i += 1) openSimilarityModal('1');

    expect(stackDepth()).toBe(10); // capped, oldest evicted
    expect(warn).toHaveBeenCalled();
    // The evicted reader retired its own state, so the id cannot go stale.
    expect(getReaderBookmarkId()).toBeNull();
    warn.mockRestore();
  });
});
