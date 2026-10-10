// @vitest-environment jsdom

/** @fileoverview Tests for the linkage graph view's guards and D3 render path.

 * The graph topology rules are covered by tests/linkage.test.js. This file
 * exercises the view's DOM-facing guards and the D3 render path against a REAL
 * DOM (jsdom) so that "renders a single node" is a meaningful claim - the old
 * file deliberately stubbed the document.
 *
 * Render tests run before the reset-graph tests below, because those drive the
 * module-private zoom state (`currentSvg`/`currentZoom`); its presence turns
 * `zoomGraphBy` from a no-op into a real transition.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderConceptLinkageGraph,
  zoomGraphBy,
  resetGraphZoom,
  openLinkageForBookmark,
  focusLinkageNode,
} from '../src/views/linkage.js';
import { setBookmarks } from '../src/core/state.js';

const BM = (id, title = `t${id}`, url = `https://example.com/${id}`) => ({
  id: String(id),
  title,
  url,
  article_preview: '',
  content: '',
  instapaper_url: `https://www.instapaper.com/read/${id}`,
  detected_language: 'en',
  tags: [],
  source_file_id: 'f1',
  source_file_name: 'a.csv',
});

/** Appends a real canvas to the document and returns it. */
function createCanvas() {
  const canvas = document.createElement('div');
  canvas.id = 'd3GraphCanvas';
  canvas.className = 'flex-1';
  document.body.appendChild(canvas);
  return canvas;
}

/** Stop any running simulation and clear the document between tests. */
function resetModuleState() {
  // The view stops the simulation only when a canvas is present, so add a
  // throwaway one to drive the stop, then remove it with everything else.
  const canvas = document.createElement('div');
  canvas.id = 'd3GraphCanvas';
  document.body.appendChild(canvas);
  setBookmarks([]);
  renderConceptLinkageGraph();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

/**
 * Poll until the zoom group carries the centering transform. It must not
 * return on the first transform it sees: `svg.call(zoom)` writes an identity
 * transform at render time, and centering is a 450ms d3 transition that starts
 * from that identity, so the mid-transition scale is still near 1. Matching on
 * the final scale is what makes this a claim about completed centering.
 *
 * @param {HTMLElement} canvas
 * @param {RegExp} expected
 * @param {number} timeout
 * @returns {Promise<string|null>} the transform, or null if it never settled
 */
async function waitForTransform(canvas, expected = /scale\(1\.6\)/, timeout = 2000) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    const g = canvas.querySelector('svg > g');
    last = g ? g.getAttribute('transform') : null;
    if (last && expected.test(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return last;
}

afterEach(() => {
  resetModuleState();
});

describe('zoom helpers', () => {
  it('are safe no-ops before any render', () => {
    expect(() => zoomGraphBy(1.3)).not.toThrow();
    expect(() => zoomGraphBy(1 / 1.3)).not.toThrow();
  });

  it('resetGraphZoom without a container does not throw', () => {
    expect(() => resetGraphZoom()).not.toThrow();
  });
});

describe('renderConceptLinkageGraph guards and render path', () => {
  it('renders a single node graph when exactly one bookmark matches', () => {
    const canvas = createCanvas();
    setBookmarks([BM(1, 'lone node')]);
    renderConceptLinkageGraph();

    expect(canvas.querySelector('svg')).not.toBeNull();
    expect(canvas.querySelectorAll('circle')).toHaveLength(1);
    // The old "needs at least 2 bookmarks" empty-state markup must not show.
    expect(canvas.querySelector('.text-slate-500')).toBeNull();
    const label = canvas.querySelector('text');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('lone node');
  });

  it('renders an empty state when no bookmark matches', () => {
    const canvas = createCanvas();
    setBookmarks([]);
    renderConceptLinkageGraph();

    expect(canvas.querySelector('svg')).toBeNull();
    expect(canvas.textContent).toContain('尚無書籤可構建關聯網絡拓撲圖');
  });

  it('renders with degree zero when no pair exceeds the threshold', () => {
    const canvas = createCanvas();
    // Deliberately picked so no pair exceeds the threshold: the same topology
    // the builder already pins for a one-node graph.
    setBookmarks([BM(1, 'alpha beta gamma delta'), BM(2, 'deep fur fast hat')]);
    renderConceptLinkageGraph();

    expect(canvas.querySelectorAll('circle')).toHaveLength(2);
    expect(canvas.querySelectorAll('line')).toHaveLength(0);
  });

  it('positions the single node via the simulation tick', async () => {
    const canvas = createCanvas();
    setBookmarks([BM(1, 'ticking node')]);
    renderConceptLinkageGraph();

    // d3 timers start immediately and tick at 60 fps in the jsdom env, so the
    // first tick (and the node's translate) lands within ~16ms.
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The node group is the `g` that directly contains the circle.
    const circle = canvas.querySelector('circle');
    expect(circle).not.toBeNull();
    const group = circle ? circle.parentElement : null;
    expect(group).not.toBeNull();
    expect(group?.getAttribute('transform')).toMatch(/^translate\(-?[0-9.]+,-?[0-9.]+\)$/);
  });
});

describe('resetGraphZoom', () => {
  it('re-renders and re-wires the graph', () => {
    const canvas = createCanvas();
    setBookmarks([BM(1)]);
    renderConceptLinkageGraph();

    resetGraphZoom();

    expect(canvas.querySelector('svg')).not.toBeNull();
  });

  it('resets to an empty state for an empty library', () => {
    const canvas = createCanvas();
    setBookmarks([BM(1)]);
    renderConceptLinkageGraph();

    setBookmarks([]);
    resetGraphZoom();

    expect(canvas.querySelector('svg')).toBeNull();
    expect(canvas.textContent).toContain('尚無書籤可構建關聯網絡拓撲圖');
  });
});

/**
 * Focus & camera API tests.
 *
 * These run against the real jsdom document with a real tab bar, panels and
 * toast, so `activateTab` and the panel-show path are exercised rather than
 * stubbed away. A previous attempt replaced `document` with a hand-rolled
 * stub, which made `activateTab` operate on detached fake nodes and left the
 * assertions re-reading nodes that a re-render had already detached.
 */
describe('focus & camera API', () => {
  beforeEach(() => {
    ['bookmarks', 'wordcloud', 'domains', 'linkage'].forEach((tab) => {
      const btn = document.createElement('button');
      btn.className = 'main-tab';
      btn.dataset.tab = tab;
      document.body.appendChild(btn);

      const panel = document.createElement('div');
      panel.id = `panel${tab[0].toUpperCase()}${tab.slice(1)}`;
      panel.className = 'tab-panel hidden';
      document.body.appendChild(panel);
    });

    const toast = document.createElement('div');
    toast.id = 'toastNotification';
    const msg = document.createElement('div');
    msg.id = 'toastMsg';
    toast.appendChild(msg);
    document.body.appendChild(toast);

    createCanvas();
  });

  it('switches to the linkage tab, renders, and highlights the node', async () => {
    setBookmarks([BM(1, 'lone node')]);

    const ok = openLinkageForBookmark('1');

    expect(ok).toBe(true);
    // Query AFTER the call: openLinkageForBookmark re-renders, so any node
    // reference taken beforehand belongs to a discarded SVG.
    const canvas = document.getElementById('d3GraphCanvas');
    const circles = canvas.querySelectorAll('circle');
    expect(circles).toHaveLength(1);
    expect(circles[0].getAttribute('stroke')).toBe('#6366f1');
    expect(circles[0].getAttribute('stroke-width')).toBe('4');
    expect(circles[0].parentElement.getAttribute('opacity')).toBe('1');

    // activateTab has run: the linkage panel is shown, the others hidden.
    const panel = document.getElementById('panelLinkage');
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('panelBookmarks').classList.contains('hidden')).toBe(true);

    // Centering is a 450ms transition on the zoom group, started by the first
    // simulation tick, so poll instead of assuming one frame is enough.
    await waitForTransform(canvas);
    expect(canvas.querySelector('svg > g').getAttribute('transform')).toMatch(
      /translate\(-?[0-9.]+,-?[0-9.]+\) scale\(1\.6\)/,
    );
  });

  it('moves the highlight between nodes on repeated calls', async () => {
    setBookmarks([BM(10, 'alpha beta gamma'), BM(20, 'delta epsilon zeta')]);

    openLinkageForBookmark('10');
    const circles = document.getElementById('d3GraphCanvas').querySelectorAll('circle');
    expect(circles).toHaveLength(2);
    expect(circles[0].getAttribute('stroke')).toBe('#6366f1');
    expect(circles[0].getAttribute('stroke-width')).toBe('4');
    expect(circles[0].parentElement.getAttribute('opacity')).toBe('1');
    expect(circles[1].getAttribute('stroke')).toBe('#0f172a');
    expect(circles[1].getAttribute('stroke-width')).toBe('2');
    expect(circles[1].parentElement.getAttribute('opacity')).toBe('0.4');

    openLinkageForBookmark('20');
    // Re-query: the second call re-rendered and replaced the SVG.
    const next = document.getElementById('d3GraphCanvas').querySelectorAll('circle');
    expect(next).toHaveLength(2);
    expect(next[0].getAttribute('stroke')).toBe('#0f172a');
    expect(next[0].parentElement.getAttribute('opacity')).toBe('0.4');
    expect(next[1].getAttribute('stroke')).toBe('#6366f1');
    expect(next[1].parentElement.getAttribute('opacity')).toBe('1');

    await waitForTransform(document.getElementById('d3GraphCanvas'));
  });

  it('returns false, drops the highlight and toasts when the id has no node', async () => {
    setBookmarks([BM(1, 'only one')]);
    renderConceptLinkageGraph();
    focusLinkageNode('1');
    expect(
      document.getElementById('d3GraphCanvas').querySelectorAll('circle')[0].getAttribute('stroke'),
    ).toBe('#6366f1');

    // openLinkageForBookmark is the toasting path; focusLinkageNode is silent.
    const ok = openLinkageForBookmark('99');

    expect(ok).toBe(false);
    // The stale ring is gone rather than left on the old node. Whether the
    // clearing leaves an explicit opacity of 1 or no attribute at all is a
    // representation detail; what matters is that the node is NOT dimmed.
    const circles = document.getElementById('d3GraphCanvas').querySelectorAll('circle');
    expect(circles).toHaveLength(1);
    expect(circles[0].getAttribute('stroke')).toBe('#0f172a');
    expect(circles[0].getAttribute('stroke-width')).toBe('2');
    expect(circles[0].parentElement.getAttribute('opacity')).not.toBe('0.4');
    expect(document.getElementById('toastMsg').innerText).toContain('不在目前的關聯圖中');
  });

  it('clears the highlight when the view is reset', async () => {
    setBookmarks([BM(1, 'lone node')]);
    renderConceptLinkageGraph();
    focusLinkageNode('1');
    expect(
      document.getElementById('d3GraphCanvas').querySelectorAll('circle')[0].getAttribute('stroke'),
    ).toBe('#6366f1');

    resetGraphZoom();

    // resetGraphZoom re-renders, so the nodes are fresh: the render-time
    // defaults are back and nothing is dimmed.
    const circles = document.getElementById('d3GraphCanvas').querySelectorAll('circle');
    expect(circles).toHaveLength(1);
    expect(circles[0].getAttribute('stroke')).toBe('#0f172a');
    expect(circles[0].getAttribute('stroke-width')).toBe('2');
    expect(circles[0].parentElement.getAttribute('opacity')).not.toBe('0.4');
  });

  it('is a no-op when nothing is rendered', () => {
    // No container and no bookmarks: both focus helpers must stay safe.
    setBookmarks([]);
    renderConceptLinkageGraph();
    expect(focusLinkageNode('1')).toBe(false);
    expect(openLinkageForBookmark('1')).toBe(false);
  });
});
