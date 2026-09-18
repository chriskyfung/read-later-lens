import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  openReaderModal,
  closeReaderModal,
  getReaderBookmarkId,
} from '../src/views/readerModal.js';
import { openSimilarityModal, closeSimilarityModal } from '../src/views/similarityModal.js';
import { setBookmarks } from '../src/core/state.js';
import { resetLayers } from '../src/utils/dom.js';

// ---- DOM stubs ----------------------------------------------------------
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    style: {},
    href: '',
    inert: false,
    parentElement: null,
    _attrs: {},
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
  globalThis.document.activeElement = null;
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

beforeEach(() => {
  resetLayers();
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

  it('exposes the open bookmark id via getReaderBookmarkId', () => {
    openReaderModal('1');
    expect(getReaderBookmarkId()).toBe('1');
  });

  it('clears the bookmark id when the reader closes', () => {
    openReaderModal('2');
    expect(getReaderBookmarkId()).toBe('2');
    closeReaderModal();
    expect(getReaderBookmarkId()).toBeNull();
  });

  it('moves focus into the reader modal and restores it to the opener on close', () => {
    for (const id of readerIds) el(id);
    const modal = el('readerModal');
    const opener = makeEl();
    modal.focused = 0;
    globalThis.document.activeElement = opener;

    openReaderModal('1');
    expect(modal.focused).toBe(1);

    closeReaderModal();
    expect(opener.focused).toBe(1);
  });

  it('does not set an id for unknown bookmarks', () => {
    closeReaderModal(); // reset to a known-null baseline
    openReaderModal('missing'); // no-ops
    expect(getReaderBookmarkId()).toBeNull();
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

  it('row click stacks the reader on top and keeps the drawer open', () => {
    for (const id of [...readerIds, ...simIds]) el(id);
    created.length = 0;
    openSimilarityModal('1');
    const rows = created.filter((e) => e.onclick);
    expect(rows.length).toBeGreaterThan(0);

    rows[0].onclick(); // opens the reader for the most similar doc (id '2')

    // The drawer stays open beneath, so closing the reader returns to it...
    expect(el('similarityModal').classList.contains('hidden')).toBe(false);
    expect(el('similarityModal').inert).toBe(true);
    // ...and the reader is on top: paint order follows the stack, not DOM order.
    expect(el('readerModal').classList.contains('hidden')).toBe(false);
    expect(el('readerTitle').innerText).toBe('apple tart recipe');
    expect(Number(el('readerModal').style.zIndex)).toBeGreaterThan(
      Number(el('similarityModal').style.zIndex),
    );
  });

  it('closeSimilarityModal re-adds hidden', () => {
    closeSimilarityModal();
    expect(el('similarityModal').classList.contains('hidden')).toBe(true);
  });

  it('no-ops for unknown ids', () => {
    expect(() => openSimilarityModal('missing')).not.toThrow();
  });

  it('moves focus into the similarity modal and restores it to the opener on close', () => {
    for (const id of simIds) el(id);
    const modal = el('similarityModal');
    const opener = makeEl();
    modal.focused = 0;
    globalThis.document.activeElement = opener;

    openSimilarityModal('1');
    expect(modal.focused).toBe(1);

    closeSimilarityModal();
    expect(opener.focused).toBe(1);
  });
});
