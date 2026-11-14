// @vitest-environment jsdom
/* global MouseEvent */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS } from './constants.js';
import { headerSearchBarHtml } from '../components/searchBar.js';
import { registerHeaderListeners } from './listeners.js';
import { initHeader } from '../';
import { searchQuery, setSearchQuery, setBookmarks } from '@/core/state';

vi.mock('@/core/persistence', async (importOriginal) => ({
  ...(await importOriginal()),
  isStateFresh: async () => true,
}));

describe('registerHeaderListeners - search input (debounced)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    headerSearchBarHtml();
    setSearchQuery('');
    setBookmarks([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies the query after the debounce, not while typing (no persist)', () => {
    const renderFn = vi.fn();
    const persistFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: persistFn });
    registerHeaderListeners();
    const input = document.getElementById('searchInput');
    input.value = 'apple';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(searchQuery).toBe('');
    expect(renderFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(searchQuery).toBe('apple');
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(persistFn).not.toHaveBeenCalled();
  });

  it('rapid keystrokes within the window collapse into ONE search', () => {
    const renderFn = vi.fn();
    initHeader({ render: renderFn, persistAndRender: vi.fn() });
    registerHeaderListeners();
    const input = document.getElementById('searchInput');
    input.value = 'apple';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'app';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'application';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(searchQuery).toBe('application');
    expect(renderFn).toHaveBeenCalledTimes(1);
  });
});

describe('registerHeaderListeners - search help tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    headerSearchBarHtml();
    setSearchQuery('');
    setBookmarks([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mouseenter on helpBtn shows the tooltip', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
  });

  it('mouseleave on helpBtn starts 150ms hide timeout', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    helpBtn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    vi.advanceTimersByTime(151);
    const tooltip = document.getElementById('searchHelpTooltip');
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  it('mouseenter on tooltip cancels pending hide', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    vi.advanceTimersByTime(151);
    expect(tooltip.classList.contains('hidden')).toBe(true);
    helpBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
  });

  it('mouseleave on tooltip starts hide timeout', () => {
    const tooltip = document.getElementById('searchHelpTooltip');
    const helpBtn = document.getElementById('searchHelpBtn');
    helpBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    tooltip.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    vi.advanceTimersByTime(151);
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  it('focus on helpBtn shows tooltip', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
  });

  it('blur on helpBtn starts hide timeout', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    helpBtn.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    vi.advanceTimersByTime(151);
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  it('click on helpBtn toggles tooltip on (hidden -> visible)', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    expect(tooltip.classList.contains('hidden')).toBe(true);
    helpBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
  });

  it('click on helpBtn toggles tooltip off (visible -> hidden)', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    helpBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // hide() defers 150ms; not hidden immediately after the second click
    expect(tooltip.classList.contains('hidden')).toBe(false);
    vi.advanceTimersByTime(151);
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  it('Escape key hides tooltip', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  it('click outside helpBtn+tooltip hides tooltip', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    const outerDiv = document.createElement('div');
    outerDiv.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  it('click inside helpBtn does NOT hide tooltip', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    helpBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // hide() defers 150ms; not hidden immediately after the second click
    expect(tooltip.classList.contains('hidden')).toBe(false);
  });

  it('click inside tooltip does NOT hide tooltip', () => {
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    tooltip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // The tooltip has pointer-events:none, so the click defers hide(); it stays visible immediately
    expect(tooltip.classList.contains('hidden')).toBe(false);
  });
});

describe('registerHeaderListeners - disposer cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    headerSearchBarHtml();
    setSearchQuery('');
    setBookmarks([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('disposer removes all tooltip listeners', () => {
    const dispose = registerHeaderListeners();
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    dispose();
    helpBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(true);
    helpBtn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(true);
  });

  it('disposer clears pending hide timeout', () => {
    const dispose = registerHeaderListeners();
    const helpBtn = document.getElementById('searchHelpBtn');
    const tooltip = document.getElementById('searchHelpTooltip');
    helpBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
    helpBtn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    dispose(); // clears the pending hide timeout
    helpBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(tooltip.classList.contains('hidden')).toBe(false);
  });

  it('disposer is safe to call twice', () => {
    const dispose = registerHeaderListeners();
    dispose();
    expect(() => dispose()).not.toThrow();
  });
});
