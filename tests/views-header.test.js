import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import {
  initHeader,
  registerHeaderListeners,
  setSearchInputValue,
  SEARCH_DEBOUNCE_MS,
} from '../src/views/header.js';
import {
  setSearchQuery,
  setBookmarks,
  setSourceFiles,
  searchQuery,
  sourceFiles,
} from '../src/core/state.js';

// ---- DOM stubs -----------------------------------------------------------
const els = {};
function makeEl() {
  return {
    innerText: '',
    innerHTML: '',
    className: '',
    value: '',
    _l: {},
    addEventListener(type, fn) {
      (this._l[type] = this._l[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      this._l[type] = (this._l[type] || []).filter((f) => f !== fn);
    },
    dispatch(type, ev) {
      // Mimic real DOM: the event target's value IS the element's value.
      if (ev && ev.target && typeof ev.target.value === 'string') {
        this.value = ev.target.value;
      }
      (this._l[type] || []).forEach((fn) => fn(ev || { stopPropagation() {} }));
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
    },
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    focus() {
      this.focused = true;
    },
    focused: false,
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
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  setSearchQuery('');
  setBookmarks([]);
  setSourceFiles(new Map([['F1', { id: 'F1', name: 'a.csv', type: 'csv' }]]));
  initHeader({
    render: vi.fn(),
    persistAndRender: vi.fn(),
  });
});

describe('registerHeaderListeners — search (debounced)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies the query after the debounce, not while typing (no persist)', () => {
    const renderFn = vi.fn();
    const persistFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: persistFn });
    registerHeaderListeners();

    el('searchInput').dispatch('input', { target: { value: 'apple' } });

    // Debounced: NOT applied synchronously while typing.
    expect(searchQuery).toBe('');
    expect(renderFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

    expect(searchQuery).toBe('apple');
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(persistFn).not.toHaveBeenCalled(); // search never writes IndexedDB
  });

  it('rapid keystrokes within the window collapse into ONE search', () => {
    const renderFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: vi.fn() });
    registerHeaderListeners();

    el('searchInput').dispatch('input', { target: { value: 'a' } });
    vi.advanceTimersByTime(100);
    el('searchInput').dispatch('input', { target: { value: 'ap' } });
    vi.advanceTimersByTime(100);
    el('searchInput').dispatch('input', { target: { value: 'app' } });

    expect(renderFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

    expect(searchQuery).toBe('app'); // last value wins
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('Enter applies the search immediately without waiting for the debounce', () => {
    const renderFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: vi.fn() });
    registerHeaderListeners();

    el('searchInput').dispatch('input', { target: { value: 'apple' } });
    el('searchInput').dispatch('keydown', { key: 'Enter', isComposing: false });

    expect(searchQuery).toBe('apple');
    expect(renderFn).toHaveBeenCalledTimes(1);

    // The pending debounce was cancelled — advancing time changes nothing.
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('Enter during IME composition does NOT trigger a search', () => {
    const renderFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: vi.fn() });
    registerHeaderListeners();

    el('searchInput').dispatch('input', { target: { value: '蘋果' } });
    el('searchInput').dispatch('keydown', { key: 'Enter', isComposing: true });
    expect(renderFn).not.toHaveBeenCalled();

    el('searchInput').dispatch('keydown', { key: 'Enter', isComposing: false, keyCode: 229 });
    expect(renderFn).not.toHaveBeenCalled();
  });

  it('clearing the input applies immediately (no debounce wait)', () => {
    const renderFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: vi.fn() });
    registerHeaderListeners();

    el('searchInput').dispatch('input', { target: { value: 'apple' } });
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(renderFn).toHaveBeenCalledTimes(1);

    el('searchInput').dispatch('input', { target: { value: '' } });
    expect(searchQuery).toBe('');
    expect(renderFn).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(renderFn).toHaveBeenCalledTimes(2); // no extra debounced render
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
    expect(el('searchInput').focused).toBe(true); // refocused for the next query
    expect(renderFn).toHaveBeenCalledTimes(1); // reset renders once (typing is debounced)
    expect(persistFn).not.toHaveBeenCalled(); // reset never writes IndexedDB
  });

  it('reset cancels a pending debounced search (no ghost re-apply)', () => {
    vi.useFakeTimers();
    try {
      const renderFn = vi.fn();
      initHeader({ render: renderFn, persistAndRender: vi.fn() });
      registerHeaderListeners();

      el('searchInput').dispatch('input', { target: { value: 'apple' } });
      el('clearSearchBtn').dispatch('click');

      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      expect(searchQuery).toBe('');
      expect(renderFn).toHaveBeenCalledTimes(1); // only the reset render
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('setSearchInputValue — programmatic input sync', () => {
  it('sets the value, syncs the reset button, and drops pending keystrokes', () => {
    vi.useFakeTimers();
    try {
      const renderFn = vi.fn();
      initHeader({ render: renderFn, persistAndRender: vi.fn() });
      registerHeaderListeners();

      el('searchInput').dispatch('input', { target: { value: 'typing' } });
      setSearchInputValue('example.com');

      expect(el('searchInput').value).toBe('example.com');
      expect(el('clearSearchBtn').classList.contains('hidden')).toBe(false);

      // The debounced 'typing' application must never fire.
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      expect(searchQuery).toBe('');
      expect(renderFn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('empty value hides the reset button', () => {
    setSearchInputValue('x');
    expect(el('clearSearchBtn').classList.contains('hidden')).toBe(false);
    setSearchInputValue('');
    expect(el('clearSearchBtn').classList.contains('hidden')).toBe(true);
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
      { timeout: 2000, interval: 50 },
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
