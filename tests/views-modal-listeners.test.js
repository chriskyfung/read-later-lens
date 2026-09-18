import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { registerModalListeners } from '../src/views/modalListeners.js';
import { openReaderModal, getReaderBookmarkId } from '../src/views/readerModal.js';
import { openSimilarityModal } from '../src/views/similarityModal.js';
import { setBookmarks, bookmarks } from '../src/core/state.js';

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    href: '',
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
    createElement: () => makeEl(),
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

beforeEach(() => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  for (const k of Object.keys(els)) delete els[k];
  globalThis.document._doc = {};
  globalThis.document.activeElement = null;
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

  it('deletes the open bookmark from the reader after confirm', () => {
    registerModalListeners();
    setBookmarks([b1, { ...b1, id: '2', title: 'apple tart recipe' }]);
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
    setBookmarks([b1]);
    openReaderModal('1');
    el('readerDeleteBtn').dispatch('click');

    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].id).toBe('1');
    expect(getReaderBookmarkId()).toBe('1');
    expect(el('readerModal').classList.contains('hidden')).toBe(false);
  });

  it('opens the similarity drawer from the reader for the same bookmark', () => {
    registerModalListeners();
    setBookmarks([b1]);
    openReaderModal('1');
    el('readerSimilarityBtn').dispatch('click');

    expect(el('readerModal').classList.contains('hidden')).toBe(true);
    expect(el('similarityModal').classList.contains('hidden')).toBe(false);
    expect(el('simTargetTitle').innerText).toBe('apple pie recipe');
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

    globalThis.document.dispatch('keydown', { key: 'Escape', preventDefault: vi.fn() });

    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
  });

  it('closes the save modal when Escape is pressed', () => {
    registerModalListeners();
    el('saveModal').classList.remove('hidden');

    globalThis.document.dispatch('keydown', { key: 'Escape', preventDefault: vi.fn() });

    expect(el('saveModal').classList.contains('hidden')).toBe(true);
  });

  it('does not consume Escape when no modal is open', () => {
    registerModalListeners();
    for (const id of ['readerModal', 'similarityModal', 'saveModal']) {
      el(id).classList.add('hidden');
    }
    const event = { key: 'Escape', preventDefault: vi.fn() };

    globalThis.document.dispatch('keydown', event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('closes only the topmost modal so stacked overlays unwind one per press', () => {
    registerModalListeners();
    openReaderModal('1');
    openSimilarityModal('1');

    const event = { key: 'Escape', preventDefault: vi.fn() };
    globalThis.document.dispatch('keydown', event);
    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
    expect(el('readerModal').classList.contains('hidden')).toBe(false);

    globalThis.document.dispatch('keydown', event);
    expect(el('readerModal').classList.contains('hidden')).toBe(true);
  });

  it('folds Tab focus back inside the open modal', () => {
    registerModalListeners();
    openReaderModal('1');
    const only = makeEl();
    el('readerModal').querySelectorAll = () => [only];
    globalThis.document.activeElement = only;

    const event = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() };
    globalThis.document.dispatch('keydown', event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(only.focused).toBe(1);
  });
});
