/**
 * @fileoverview Tab navigation tests — activateTab mirrors the monolith's
 * `switchTab` mechanics: exact tab-bar class strings, panel show/hide via the
 * `hidden` class, and state propagation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { activateTab } from '../src/views/tabs.js';
import { activeTab } from '../src/core/state.js';

const ACTIVE_CLASS =
  'main-tab active px-3 py-1 rounded-md text-xs font-semibold text-white bg-indigo-600 shadow';
const INACTIVE_CLASS =
  'main-tab px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200';

function makeTabBtn(datasetTab) {
  return { dataset: { tab: datasetTab }, className: '', classList: { _s: new Set() } };
}

function makePanel(id, extra = '') {
  return {
    id,
    classList: {
      _s: new Set(['tab-panel', 'hidden', ...extra.split(' ').filter(Boolean)]),
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
  };
}

const tabs = [
  makeTabBtn('bookmarks'),
  makeTabBtn('wordcloud'),
  makeTabBtn('domains'),
  makeTabBtn('linkage'),
];
const panels = [
  makePanel('panelBookmarks', 'flex'),
  makePanel('panelWordcloud', 'h-full flex flex-col'),
  makePanel('panelDomains'),
  makePanel('panelLinkage', 'h-full flex flex-col relative'),
];

beforeEach(() => {
  globalThis.document = globalThis.document || {};
  globalThis.document.querySelectorAll = (sel) => (sel === '.main-tab' ? tabs : panels);
  globalThis.document.getElementById = (id) => panels.find((p) => p.id === id) || null;
});

describe('activateTab', () => {
  it('applies the exact active class to the matching tab and idle to the rest', () => {
    activateTab('wordcloud');
    expect(tabs[1].className).toBe(ACTIVE_CLASS);
    expect(tabs[0].className).toBe(INACTIVE_CLASS);
    expect(tabs[2].className).toBe(INACTIVE_CLASS);
    expect(tabs[3].className).toBe(INACTIVE_CLASS);
  });

  it('hides every tab panel, then shows only the target (preserving layout classes)', () => {
    activateTab('domains');
    expect(panels.every((p) => p.classList.contains('hidden'))).toBe(false);
    expect(panels[2].classList.contains('hidden')).toBe(false);
    expect(panels[0].classList.contains('hidden')).toBe(true);
    expect(panels[1].classList.contains('hidden')).toBe(true);
    expect(panels[3].classList.contains('hidden')).toBe(true);
    // Layout classes must survive the hidden toggle
    expect(panels[2].classList.contains('tab-panel')).toBe(true);
    expect(panels[1].classList.contains('flex')).toBe(true);
  });

  it('updates the activeTab state binding', () => {
    activateTab('linkage');
    expect(activeTab).toBe('linkage');
  });

  it('round-trips across tabs', () => {
    activateTab('bookmarks');
    expect(panels[0].classList.contains('hidden')).toBe(false);
    expect(tabs[0].className).toBe(ACTIVE_CLASS);
    activateTab('linkage');
    expect(panels[0].classList.contains('hidden')).toBe(true);
    expect(panels[3].classList.contains('hidden')).toBe(false);
    expect(tabs[3].className).toBe(ACTIVE_CLASS);
    expect(tabs[0].className).toBe(INACTIVE_CLASS);
    expect(activeTab).toBe('linkage');
  });

  it('hides all panels for an unknown tab id without throwing', () => {
    expect(() => activateTab('nope')).not.toThrow();
    expect(panels.every((p) => p.classList.contains('hidden'))).toBe(true);
    expect(tabs.every((t) => t.className === INACTIVE_CLASS)).toBe(true);
  });
});
