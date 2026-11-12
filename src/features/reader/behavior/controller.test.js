import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { resetLayers } from '@/utils/dom';
import { setBookmarks } from '@/core/state';
import { openReaderModal, closeReaderModal, getReaderBookmarkId } from '.';

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

beforeAll(() => {
  globalThis.document = globalThis.document || {};
  globalThis.document.getElementById = (id) => els[id] || null;
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
