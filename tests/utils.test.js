import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  escapeHtml,
  showToast,
  on,
  closeLayer,
  closeTopLayer,
  focusableWithin,
  popLayer,
  pushLayer,
  registerModalLayer,
  resetLayers,
  stackDepth,
  topLayer,
  topLayerId,
  trapFocus,
} from '../src/utils/dom.js';
import { downloadBlob, saveFileWithFallback } from '../src/utils/download.js';

function setupDom() {
  const classes = new Set(['translate-y-20', 'opacity-0']);
  const toast = {
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (c) => classes.has(c),
    },
  };
  const msg = { innerText: '' };
  const anchors = [];
  const body = { appendChild: vi.fn(), removeChild: vi.fn() };
  vi.stubGlobal('document', {
    getElementById: (id) => (id === 'toastNotification' ? toast : id === 'toastMsg' ? msg : null),
    createElement: (tag) => {
      if (tag !== 'a') return {};
      const a = { href: '', download: '', style: {}, click: vi.fn() };
      anchors.push(a);
      return a;
    },
    body,
  });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
  return { classes, msg, anchors, body };
}

const makeHandle = () => {
  const write = vi.fn();
  const close = vi.fn();
  return { createWritable: vi.fn(async () => ({ write, close })), write, close };
};

const abortError = () => Object.assign(new Error('cancelled'), { name: 'AbortError' });

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('window', {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('on', () => {
  const makeButton = () => {
    const listeners = {};
    return {
      addEventListener: (type, fn) => {
        (listeners[type] = listeners[type] || []).push(fn);
      },
      dispatch: (type) => (listeners[type] || []).forEach((fn) => fn()),
    };
  };

  it('binds the handler and reports success when the element exists', () => {
    const button = makeButton();
    vi.stubGlobal('document', { getElementById: (id) => (id === 'goBtn' ? button : null) });
    const handler = vi.fn();

    expect(on('goBtn', 'click', handler)).toBe(true);

    button.dispatch('click');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('no-ops with a warning (never throws) when the element is missing', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warn.mockClear();
    const handler = vi.fn();
    let result;

    expect(() => {
      result = on('missingBtn', 'click', handler);
    }).not.toThrow();

    expect(result).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('#missingBtn'));
    warn.mockRestore();
  });

  it('does not warn when the element exists', () => {
    vi.stubGlobal('document', { getElementById: () => makeButton() });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warn.mockClear();

    on('presentBtn', 'click', vi.fn());

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('escapeHtml', () => {
  it('escapes the dangerous characters', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('returns an empty string for falsy input (monolith parity)', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(0)).toBe('');
    expect(escapeHtml(false)).toBe('');
  });

  it('stringifies other values', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('showToast', () => {
  it('shows the message, then hides it after 2.5s', () => {
    const { classes, msg } = setupDom();
    showToast('hello');
    expect(msg.innerText).toBe('hello');
    expect(classes.has('translate-y-0')).toBe(true);
    vi.advanceTimersByTime(2500);
    expect(classes.has('translate-y-20')).toBe(true);
  });

  it('stays visible for 2.5s after the last call (timer is reset)', () => {
    const { classes } = setupDom();
    showToast('first');
    vi.advanceTimersByTime(100);
    showToast('second');
    vi.advanceTimersByTime(2400); // t = 2500: the first timer would have hidden here
    expect(classes.has('translate-y-0')).toBe(true);
    vi.advanceTimersByTime(100); // t = 2600
    expect(classes.has('translate-y-20')).toBe(true);
  });

  it('no-ops when the toast elements are missing', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    expect(() => showToast('x')).not.toThrow();
  });
});

describe('downloadBlob', () => {
  it('clicks a temporary anchor and toasts', () => {
    const { anchors, body, msg } = setupDom();
    downloadBlob(new Blob(['x'], { type: 'text/plain' }), 'file.csv');
    expect(anchors).toHaveLength(1);
    expect(anchors[0].download).toBe('file.csv');
    expect(anchors[0].href).toBe('blob:mock');
    expect(anchors[0].click).toHaveBeenCalledOnce();
    expect(body.appendChild).toHaveBeenCalledOnce();
    expect(body.removeChild).toHaveBeenCalledOnce();
    expect(msg.innerText).toContain('file.csv');
  });

  it('defers the object-URL release past the click', () => {
    const { anchors } = setupDom();
    downloadBlob(new Blob(['x'], { type: 'text/plain' }), 'file.csv');
    expect(anchors[0].click).toHaveBeenCalledOnce();
    // The old code revoked here, in the same task as the click: the pattern
    // Mozilla bug 1282407 showed can end a download before it starts.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});

describe('saveFileWithFallback', () => {
  it('writes directly when given a usable handle', async () => {
    const { anchors, msg } = setupDom();
    const handle = makeHandle();
    await saveFileWithFallback('data', 'out.csv', 'text/csv', handle);
    expect(handle.write).toHaveBeenCalledWith('data');
    expect(handle.close).toHaveBeenCalledOnce();
    expect(anchors).toHaveLength(0);
    expect(msg.innerText).toContain('out.csv');
  });

  it('prompts with showSaveFilePicker when no handle is given', async () => {
    const { anchors } = setupDom();
    const handle = makeHandle();
    const picker = vi.fn(async () => handle);
    vi.stubGlobal('window', { showSaveFilePicker: picker });
    await saveFileWithFallback('data', 'out.json', 'application/json');
    expect(picker).toHaveBeenCalledWith({ suggestedName: 'out.json' });
    expect(handle.write).toHaveBeenCalledWith('data');
    expect(anchors).toHaveLength(0);
  });

  it('aborts silently when the picker is cancelled (no download)', async () => {
    const { anchors } = setupDom();
    vi.stubGlobal('window', {
      showSaveFilePicker: vi.fn(async () => {
        throw abortError();
      }),
    });
    await saveFileWithFallback('data', 'out.json', 'application/json');
    expect(anchors).toHaveLength(0);
  });

  it('aborts silently when a supplied handle throws AbortError', async () => {
    const { anchors } = setupDom();
    const handle = {
      createWritable: vi.fn(async () => {
        throw abortError();
      }),
    };
    await saveFileWithFallback('data', 'out.csv', 'text/csv', handle);
    expect(anchors).toHaveLength(0);
  });

  it('falls back to a plain download when no handle and no picker', async () => {
    const { anchors } = setupDom();
    await saveFileWithFallback('data', 'out.txt', 'text/plain');
    expect(anchors).toHaveLength(1);
    expect(anchors[0].download).toBe('out.txt');
  });
});

// ---- Modal focus helpers -------------------------------------------------

const makeModal = (focusable = []) => {
  const classes = new Set(['hidden']);
  return {
    focused: 0,
    focus() {
      this.focused += 1;
    },
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
    querySelectorAll: () => focusable,
  };
};

const makeFocusable = () => ({
  focused: 0,
  focus() {
    this.focused += 1;
  },
});

// ---- Modal layer stack ---------------------------------------------------

/**
 * Overlay stub: starts with the Tailwind `hidden` class applied (like the real
 * mount) and records focus / attributes so the stack can be asserted on.
 */
const makeLayer = ({ id = 'testModal', focusable = [] } = {}) => {
  const classes = new Set(['hidden']);
  return {
    id,
    focused: 0,
    inert: false,
    parentElement: null,
    style: {},
    _attrs: {},
    focus() {
      this.focused += 1;
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
      contains: (c) => classes.has(c),
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle(c, force) {
        const on = force === undefined ? !classes.has(c) : Boolean(force);
        if (on) classes.add(c);
        else classes.delete(c);
        return on;
      },
    },
    querySelectorAll: () => focusable,
  };
};

/** Install a document stub backed by an element registry. */
const stubDocument = (elements) => {
  const registry = { ...elements };
  vi.stubGlobal('document', {
    activeElement: null,
    getElementById: (id) => registry[id] || null,
    createElement: () => makeLayer(),
  });
  return registry;
};

describe('modal layer stack', () => {
  beforeEach(() => {
    // Install a minimal document first: resetLayers() closes leftover layers
    // from a previous test and popLayer touches document.getElementById.
    vi.stubGlobal('document', {
      activeElement: null,
      getElementById: () => null,
      createElement: () => makeLayer(),
    });
    resetLayers();
  });

  it('pushes a layer, shows it and moves focus into it', () => {
    const modal = makeLayer({ id: 'aModal' });
    stubDocument({ aModal: modal });

    pushLayer('aModal');

    expect(modal.classList.contains('hidden')).toBe(false);
    expect(modal.focused).toBe(1);
    expect(stackDepth()).toBe(1);
    expect(topLayerId()).toBe('aModal');
    expect(topLayer()).toBe(modal);
  });

  it('gives each layer a higher z-index and inerts the one beneath', () => {
    const a = makeLayer({ id: 'aModal' });
    const b = makeLayer({ id: 'bModal' });
    stubDocument({ aModal: a, bModal: b });

    pushLayer('aModal');
    pushLayer('bModal');

    expect(stackDepth()).toBe(2);
    expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));
    expect(a.inert).toBe(true);
    expect(a.getAttribute('aria-hidden')).toBe('true');
    expect(b.inert).toBe(false);
    expect(b.getAttribute('aria-hidden')).toBe('false');
  });

  it('keeps the same overlay open at two depths (layer instances)', () => {
    const a = makeLayer({ id: 'aModal' });
    const mid = makeLayer({ id: 'midModal' });
    stubDocument({ aModal: a, midModal: mid });

    pushLayer('aModal');
    pushLayer('midModal');
    pushLayer('aModal'); // the same element again, higher up the stack

    expect(stackDepth()).toBe(3);
    expect(topLayerId()).toBe('aModal');
    expect(Number(a.style.zIndex)).toBeGreaterThan(Number(mid.style.zIndex));
    expect(mid.inert).toBe(true);

    popLayer('aModal'); // closes the top instance only
    expect(stackDepth()).toBe(2);
    expect(topLayerId()).toBe('midModal');
    expect(a.classList.contains('hidden')).toBe(false); // still mounted beneath
  });

  it('no-ops safely for unknown overlays', () => {
    stubDocument({});
    expect(() => pushLayer('missing')).not.toThrow();
    expect(() => popLayer('missing')).not.toThrow();
    expect(stackDepth()).toBe(0);
  });

  it('hides a popped overlay that was never tracked', () => {
    const modal = makeLayer({ id: 'aModal' });
    modal.classList.remove('hidden');
    stubDocument({ aModal: modal });

    popLayer('aModal');

    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('closes a layer through its registered closer', () => {
    const modal = makeLayer({ id: 'cModal' });
    stubDocument({ cModal: modal });
    const close = vi.fn(() => popLayer('cModal'));
    registerModalLayer('cModal', { close, backButton: 'cBackBtn' });

    pushLayer('cModal');
    closeTopLayer();

    expect(close).toHaveBeenCalledOnce();
    expect(modal.classList.contains('hidden')).toBe(true);
    expect(stackDepth()).toBe(0);
  });

  it('closes a layer directly when it has no registered closer', () => {
    const modal = makeLayer({ id: 'xModal' });
    stubDocument({ xModal: modal });

    pushLayer('xModal');
    closeLayer('xModal');

    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('restores the revealed layer content and focus after a pop', () => {
    const opener = makeFocusable();
    const r = makeLayer({ id: 'rModal' });
    const s = makeLayer({ id: 'sModal' });
    stubDocument({ rModal: r, sModal: s });
    vi.stubGlobal('document', {
      activeElement: opener,
      getElementById: (id) => ({ rModal: r, sModal: s })[id] || null,
      createElement: () => makeLayer(),
    });
    const restore = vi.fn();

    pushLayer('rModal', { payload: 'A', restore });
    pushLayer('sModal', { payload: null, restore: null });
    popLayer('sModal');

    expect(restore).toHaveBeenCalledWith('A');
    expect(r.classList.contains('hidden')).toBe(false);
    expect(s.classList.contains('hidden')).toBe(true);
    expect(r.focused).toBeGreaterThan(1); // focus back on the revealed layer
  });

  it('hands focus back to the opener when the bottom layer closes', () => {
    const opener = makeFocusable();
    stubDocument({ aModal: makeLayer({ id: 'aModal' }) });
    document.activeElement = opener; // after stubDocument, which resets it
    const modal = document.getElementById('aModal');

    pushLayer('aModal');
    popLayer('aModal');

    expect(opener.focused).toBe(1);
    expect(modal.inert).toBe(false); // background released
  });

  it('marks the background inert while any layer is open', () => {
    const header = makeLayer({ id: 'appHeader' });
    const body = makeLayer({ id: 'appBody' });
    const modal = makeLayer({ id: 'aModal' });
    stubDocument({ appHeader: header, appBody: body, aModal: modal });

    pushLayer('aModal');
    expect(header.inert).toBe(true);
    expect(body.inert).toBe(true);

    popLayer('aModal');
    expect(header.inert).toBe(false);
    expect(body.inert).toBe(false);
  });

  it('evicts and retires the oldest layer when the runaway guard is hit', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = makeLayer({ id: 'fModal' });
    const g = makeLayer({ id: 'gModal' });
    stubDocument({ fModal: f, gModal: g });
    const retire = vi.fn();

    pushLayer('fModal', { onRetire: retire });
    for (let i = 0; i < 10; i += 1) pushLayer('gModal');

    expect(stackDepth()).toBe(10);
    expect(retire).toHaveBeenCalledOnce();
    expect(f.classList.contains('hidden')).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('skips hidden elements when collecting focusable children', () => {
    const visible = makeLayer({ id: 'visible' });
    visible.classList.remove('hidden');
    const hidden = makeLayer({ id: 'hidden' });
    const container = makeLayer({ id: 'container' });
    container.querySelectorAll = () => [visible, hidden];

    expect(focusableWithin(container)).toEqual([visible]);
  });
});

describe('trapFocus', () => {
  const arrange = (count) => {
    const items = Array.from({ length: count }, makeFocusable);
    const modal = makeModal(items);
    vi.stubGlobal('document', { activeElement: items[0] });
    return { items, modal };
  };

  it('wraps Tab from the last element back to the first', () => {
    const { items, modal } = arrange(3);
    document.activeElement = items[2];
    const event = { shiftKey: false, preventDefault: vi.fn() };

    trapFocus(modal, event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(items[0].focused).toBe(1);
  });

  it('leaves Tab alone while focus sits between the ends', () => {
    const { items, modal } = arrange(3);
    document.activeElement = items[1];
    const event = { shiftKey: false, preventDefault: vi.fn() };

    trapFocus(modal, event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(items[0].focused).toBe(0);
    expect(items[2].focused).toBe(0);
  });

  it('wraps Shift+Tab from the first element back to the last', () => {
    const { items, modal } = arrange(3);
    const event = { shiftKey: true, preventDefault: vi.fn() };

    trapFocus(modal, event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(items[2].focused).toBe(1);
  });

  it('sends Shift+Tab to the last element when the container itself is focused', () => {
    const { items, modal } = arrange(3);
    document.activeElement = modal;
    const event = { shiftKey: true, preventDefault: vi.fn() };

    trapFocus(modal, event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(items[2].focused).toBe(1);
  });

  it('blocks Tab when the modal has no focusable elements', () => {
    vi.stubGlobal('document', { activeElement: null });
    const event = { shiftKey: false, preventDefault: vi.fn() };

    trapFocus(makeModal([]), event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('is null-safe for a missing modal', () => {
    vi.stubGlobal('document', { activeElement: null });
    expect(() => trapFocus(null, { shiftKey: false, preventDefault: vi.fn() })).not.toThrow();
    expect(focusableWithin(null)).toEqual([]);
  });
});
