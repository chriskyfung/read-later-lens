import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { initHeader, registerHeaderListeners } from '../src/views/header.js';
import { setSearchQuery, setBookmarks, setSourceFiles, searchQuery, sourceFiles } from '../src/core/state.js';

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    value: '',
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
    // Auto-create elements like a real DOM after mountHeader() has run.
    getElementById: (id) => el(id),
    createElement: () => makeEl(),
  };
});

beforeEach(() => {
  for (const k of Object.keys(els)) delete els[k];
  vi.stubGlobal('confirm', vi.fn(() => true));
  setSearchQuery('');
  setBookmarks([]);
  setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));
  initHeader({
    render: vi.fn(),
    persistAndRender: vi.fn(),
  });
});

describe('registerHeaderListeners — search', () => {
  it('sets searchQuery and re-renders WITHOUT persisting (monolith parity)', () => {
    const renderFn = vi.fn();
    const persistFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: persistFn });
    registerHeaderListeners();

    el('searchInput').dispatch('input', { target: { value: 'apple' } });

    expect(searchQuery).toBe('apple');
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(persistFn).not.toHaveBeenCalled(); // search never writes IndexedDB
  });
});

describe('registerHeaderListeners — search quick-reset', () => {
  it('shows the reset button while typing and hides it when the input is emptied', () => {
    registerHeaderListeners();

    el('searchInput').dispatch('input', { target: { value: 'apple' } });
    expect(el('clearSearchBtn').classList.contains('hidden')).toBe(false);

    el('searchInput').dispatch('input', { target: { value: '' } });
    expect(el('clearSearchBtn').classList.contains('hidden')).toBe(true);
  });

  it('clicking reset clears the query and input, hides the button, re-renders without persisting', () => {
    const renderFn = vi.fn();
    const persistFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: persistFn });
    registerHeaderListeners();

    el('searchInput').dispatch('input', { target: { value: 'apple' } });
    el('clearSearchBtn').dispatch('click');

    expect(searchQuery).toBe('');
    expect(el('searchInput').value).toBe('');
    expect(el('clearSearchBtn').classList.contains('hidden')).toBe(true);
    expect(renderFn).toHaveBeenCalledTimes(2); // typing + reset
    expect(persistFn).not.toHaveBeenCalled(); // reset never writes IndexedDB
  });
});

describe('registerHeaderListeners — clear cache', () => {
  const seed = () => setBookmarks([{ id: '1', title: 'x', source_file_id: 'F1' }]);

  it('confirm path: spins the icon, resets state in place, persists, re-renders, toasts', async () => {
    seed();
    const renderFn = vi.fn();
    const persistFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: persistFn });
    registerHeaderListeners();

    const mapRef = sourceFiles; // capture to verify in-place clear

    const clickPromise = (async () => {
      el('clearCacheBtn').dispatch('click');
    })();

    // Inside the 400ms window: spinner is on, state not yet cleared.
    expect(el('clearCacheIcon').classList.contains('animate-spin')).toBe(true);
    expect(mapRef.size).toBe(1);

    await vi.waitFor(
      () => {
        if (mapRef.size !== 0) throw new Error('cache not cleared yet');
      },
      { timeout: 2000, interval: 50 }
    );
    await clickPromise;

    expect(mapRef.size).toBe(0); // same Map instance, cleared in place
    expect(persistFn).toHaveBeenCalledTimes(1);
    expect(el('toastMsg').innerText).toBe('已成功清空本地快取');
    expect(el('clearCacheIcon').classList.contains('animate-spin')).toBe(false);
  });

  it('cancel path: no state change, no persist, no spinner left behind', () => {
    globalThis.confirm = vi.fn(() => false);
    seed();
    const renderFn = vi.fn();
    const persistFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: persistFn });
    registerHeaderListeners();

    el('clearCacheBtn').dispatch('click');

    expect(sourceFiles.size).toBe(1);
    expect(persistFn).not.toHaveBeenCalled();
    expect(renderFn).not.toHaveBeenCalled();
    expect(el('clearCacheIcon').classList.contains('animate-spin')).toBe(false);
  });
});
