/**
 * @fileoverview Tests for the sidebar folders rendering, including the
 * persist-error badge indicator.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSidebarFolders, updateQueueBadge } from './folders.js';
import * as state from '@/core/state';
import { SIDEBAR_IDS, FOLDER_ALL } from './constants.js';
import * as readingQueue from '@/features/readingQueue';

function makeEl() {
  const el = {
    querySelector(selector) {
      this.elements ||= {};
      return (this.elements[selector] ||= makeEl());
    },
    innerText: '',
    dataset: {},
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    closest() {
      return this;
    },
    className: '',
    children: [],
    parent: null,
    _html: '',
    get innerHTML() {
      return this._html;
    },
    set innerHTML(value) {
      this._html = value;
      this.children = [];
    },
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
    },
    querySelectorAll(selector) {
      return this.children.filter((child) =>
        child.className.split(' ').includes(selector.slice(1)),
      );
    },
    remove() {
      this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    },
  };
  const parts = () => el.className.split(/\s+/).filter(Boolean);
  el.classList = {
    add(...names) {
      el.className = [...new Set([...parts(), ...names])].join(' ');
    },
    remove(...names) {
      const hide = new Set(names);
      el.className = parts()
        .filter((c) => !hide.has(c))
        .join(' ');
    },
    toggle(name, force) {
      const target = force === undefined ? !parts().includes(name) : force;
      if (target) el.classList.add(name);
      else el.classList.remove(name);
      return target;
    },
    contains(name) {
      return parts().includes(name);
    },
  };
  return el;
}

let els;

beforeEach(() => {
  state.setBookmarks([]);
  state.setSourceFiles(new Map());
  state.setActiveFolder(FOLDER_ALL);
  state.setActiveTag(null);
  state.setPersistError(false);
  els = Object.fromEntries(Object.values(SIDEBAR_IDS).map((id) => [id, makeEl()]));
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    getElementById: (id) => els[id] || null,
    createElement: () => makeEl(),
  });
});

afterEach(() => {
  state.setBookmarks([]);
  state.setSourceFiles(new Map());
  state.setActiveFolder(FOLDER_ALL);
  state.setActiveTag(null);
  state.setPersistError(false);
  vi.unstubAllGlobals();
});

describe('updateQueueBadge', () => {
  it('renders amber badge when persistError is false', () => {
    state.setPersistError(false);
    updateQueueBadge();
    expect(els.queueCountBadge.innerText).toBe('0');
    expect(els.queueCountBadge.classList.contains('bg-amber-900/50')).toBe(true);
    expect(els.queueCountBadge.classList.contains('text-amber-200')).toBe(true);
    expect(els.queueCountBadge.classList.contains('bg-red-900/50')).toBe(false);
    expect(els.queueCountBadge.classList.contains('text-red-200')).toBe(false);
  });

  it('renders red badge when persistError is true', () => {
    state.setPersistError(true);
    updateQueueBadge();
    expect(els.queueCountBadge.innerText).toBe('0');
    expect(els.queueCountBadge.classList.contains('bg-red-900/50')).toBe(true);
    expect(els.queueCountBadge.classList.contains('text-red-200')).toBe(true);
    expect(els.queueCountBadge.classList.contains('bg-amber-900/50')).toBe(false);
    expect(els.queueCountBadge.classList.contains('text-amber-200')).toBe(false);
  });

  it('reflects queue length in badge text', () => {
    vi.spyOn(readingQueue, 'getQueueLength').mockReturnValue(5);
    updateQueueBadge();
    expect(els.queueCountBadge.innerText).toBe('5');
  });
});

describe('renderSidebarFolders persistError badge', () => {
  it('renders amber badge when persistError is false', () => {
    state.setPersistError(false);
    renderSidebarFolders();
    expect(els.queueCountBadge.classList.contains('bg-amber-900/50')).toBe(true);
    expect(els.queueCountBadge.classList.contains('text-amber-200')).toBe(true);
    expect(els.queueCountBadge.classList.contains('bg-red-900/50')).toBe(false);
    expect(els.queueCountBadge.classList.contains('text-red-200')).toBe(false);
  });

  it('renders red badge when persistError is true', () => {
    state.setPersistError(true);
    renderSidebarFolders();
    expect(els.queueCountBadge.classList.contains('bg-red-900/50')).toBe(true);
    expect(els.queueCountBadge.classList.contains('text-red-200')).toBe(true);
    expect(els.queueCountBadge.classList.contains('bg-amber-900/50')).toBe(false);
    expect(els.queueCountBadge.classList.contains('text-amber-200')).toBe(false);
  });
});
