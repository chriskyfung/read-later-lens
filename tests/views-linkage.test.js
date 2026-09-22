/**
 * @fileoverview Smoke tests for the linkage view's DOM-facing guards.
 *
 * The d3 rendering path is intentionally not exercised here (the topology
 * rules are covered by tests/linkage.test.js); these tests assert the
 * container/guard behaviour and that the zoom helpers are safe no-ops before
 * a render has happened.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderConceptLinkageGraph, zoomGraphBy, resetGraphZoom } from '../src/views/linkage.js';
import { setBookmarks } from '../src/core/state.js';

function makeEl() {
  return {
    innerHTML: '',
    clientWidth: 0,
    clientHeight: 0,
    classList: { add() {}, remove() {}, contains: () => false },
  };
}

const els = {};
const GRAPH_MSG = '需要至少 2 筆書籤以構建關聯網絡拓撲圖';

beforeEach(() => {
  els.d3GraphCanvas = undefined;
  globalThis.document = globalThis.document || {};
  globalThis.document.getElementById = (id) => (els[id] === undefined ? null : els[id]);
});

describe('renderConceptLinkageGraph guards', () => {
  it('returns silently when the container is missing', () => {
    globalThis.document.getElementById = () => null;
    expect(() => renderConceptLinkageGraph()).not.toThrow();
  });

  it('shows the monolith guard message when fewer than 2 bookmarks match', () => {
    const container = makeEl();
    els.d3GraphCanvas = container;
    setBookmarks([
      {
        id: '1',
        title: 'only one',
        url: 'https://a.com',
        article_preview: '',
        content: '',
        instapaper_url: 'https://www.instapaper.com/read/1',
        detected_language: 'en',
        tags: [],
        source_file_id: 'f1',
        source_file_name: 'a.csv',
      },
    ]);

    renderConceptLinkageGraph();

    // Cleared first, then the guard message is written.
    expect(container.innerHTML).toBe(
      `<div class="text-slate-500 text-xs flex items-center justify-center h-full">${GRAPH_MSG}</div>`,
    );
  });

  it('shows the guard message for an empty library', () => {
    const container = makeEl();
    els.d3GraphCanvas = container;
    setBookmarks([]);
    renderConceptLinkageGraph();
    expect(container.innerHTML).toContain(GRAPH_MSG);
  });
});

describe('zoom helpers', () => {
  it('are safe no-ops before any render', () => {
    globalThis.document.getElementById = () => null;
    expect(() => zoomGraphBy(1.3)).not.toThrow();
    expect(() => zoomGraphBy(1 / 1.3)).not.toThrow();
  });

  it('resetGraphZoom re-renders (and is safe without a container)', () => {
    globalThis.document.getElementById = () => null;
    expect(() => resetGraphZoom()).not.toThrow();
  });

  it('resetGraphZoom re-invokes the renderer', () => {
    const container = makeEl();
    els.d3GraphCanvas = container;
    setBookmarks([]);
    const spy = vi.spyOn(container, 'innerHTML', 'set');
    resetGraphZoom();
    expect(spy).toHaveBeenCalled();
  });
});
