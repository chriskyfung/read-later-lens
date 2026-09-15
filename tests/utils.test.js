import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { escapeHtml, showToast } from '../src/utils/dom.js';
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
  it('clicks a temporary anchor, revokes the URL and toasts', () => {
    const { anchors, body, msg } = setupDom();
    downloadBlob(new Blob(['x'], { type: 'text/plain' }), 'file.csv');
    expect(anchors).toHaveLength(1);
    expect(anchors[0].download).toBe('file.csv');
    expect(anchors[0].href).toBe('blob:mock');
    expect(anchors[0].click).toHaveBeenCalledOnce();
    expect(body.appendChild).toHaveBeenCalledOnce();
    expect(body.removeChild).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    expect(msg.innerText).toContain('file.csv');
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
