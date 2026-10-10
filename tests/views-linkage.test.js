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
  FOCUS_ZOOM,
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

/**
 * Parse the three components out of an SVG
 * `transform="translate(x,y) scale(k)"`.
 *
 * @param {string|null} transform
 * @returns {{x: number, y: number, k: number}|null}
 */
function parseTransform(transform) {
  const m = /translate\(([-\d.]+),([-\d.]+)\)\s+scale\(([\d.]+)\)/.exec(transform || '');
  return m ? { x: +m[1], y: +m[2], k: +m[3] } : null;
}

/**
 * Wait for the deferred topology (Frame B) to land.
 *
 * A focused render paints the bookmark in one call and appends the rest of the
 * graph in a later macrotask, so anything that asserts on the *whole* graph
 * has to wait for it. Polling on a count rather than a fixed sleep keeps this
 * robust when the fallback timer fires sooner or later than expected.
 *
 * @param {HTMLElement} canvas
 * @param {number} expectedCircles
 * @param {number} timeout
 */
async function waitForTopology(canvas, expectedCircles, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (canvas.querySelectorAll('circle').length >= expectedCircles) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `topology did not arrive: expected ${expectedCircles} circles, ` +
      `found ${canvas.querySelectorAll('circle').length}`,
  );
}

/**
 * Map each rendered node to its emphasis state, keyed by label text.
 *
 * Keying by label rather than index matters: a focused render appends the
 * TARGET first and the rest afterwards, so DOM order is target-first and does
 * NOT follow filtered order.
 *
 * @param {HTMLElement} canvas
 * @returns {Map<string, {stroke: string|null, opacity: string|null}>}
 */
function nodesByLabel(canvas) {
  const out = new Map();
  for (const g of canvas.querySelectorAll('g.nodes > g')) {
    const label = g.querySelector('text');
    if (!label) continue;
    out.set(label.textContent, {
      stroke: g.querySelector('circle').getAttribute('stroke'),
      opacity: g.getAttribute('opacity'),
    });
  }
  return out;
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

  it('centres the focused node in the SAME call, before any simulation tick', () => {
    setBookmarks([BM(10, 'alpha zeta'), BM(20, 'gamma beta')]);
    createCanvas();

    // Deliberately NOT awaiting: the whole point of pinning + a synchronous
    // camera is that the first paint is already centred. Any assertion here
    // that needs `await` would be proving the opposite.
    const ok = openLinkageForBookmark('10');

    expect(ok).toBe(true);
    const canvas = document.getElementById('d3GraphCanvas');
    const t = parseTransform(canvas.querySelector('svg > g').getAttribute('transform'));
    expect(t).not.toBeNull();
    expect(t.k).toBeCloseTo(FOCUS_ZOOM, 5);

    // The node is pinned at the canvas centre (jsdom reports clientWidth 0, so
    // the view falls back to 800x500), and the camera maps it onto the middle
    // of the viewport at scale k: 400 * 1.6 + tx === 400.
    expect(t.x).toBeCloseTo(400 * (1 - FOCUS_ZOOM), 5);
    expect(t.y).toBeCloseTo(250 * (1 - FOCUS_ZOOM), 5);

    // ...and that position is already painted, so the node is visible at the
    // centre on the very first frame rather than flashing at the origin.
    const ringed = [...canvas.querySelectorAll('circle')].filter(
      (c) => c.getAttribute('stroke') === '#6366f1',
    );
    expect(ringed).toHaveLength(1);
    expect(ringed[0].parentElement.getAttribute('transform')).toBe('translate(400,250)');
  });

  it('paints only the bookmark in the first frame, then the rest of the graph', async () => {
    setBookmarks([BM(10, 'alpha zeta'), BM(20, 'gamma beta')]);
    createCanvas();

    openLinkageForBookmark('20');

    // Frame A: exactly one circle, and it is the bookmark we asked for.
    const canvas = document.getElementById('d3GraphCanvas');
    expect(canvas.querySelectorAll('circle')).toHaveLength(1);
    const first = canvas.querySelector('circle');
    expect(first.getAttribute('stroke')).toBe('#6366f1');
    expect(first.parentElement.getAttribute('opacity')).toBe('1');
    expect(canvas.querySelector('text').textContent).toBe('gamma beta');

    // Frame B: the rest of the topology arrives afterwards.
    await waitForTopology(canvas, 2);
    expect(canvas.querySelectorAll('circle')).toHaveLength(2);
    const nodes = nodesByLabel(canvas);
    expect(nodes.get('gamma beta')).toEqual({ stroke: '#6366f1', opacity: '1' });
    expect(nodes.get('alpha zeta')).toEqual({ stroke: '#0f172a', opacity: '0.4' });
  });

  it('moves the highlight between nodes on repeated calls', async () => {
    setBookmarks([BM(10, 'alpha beta gamma'), BM(20, 'delta epsilon zeta')]);

    openLinkageForBookmark('10');
    await waitForTopology(document.getElementById('d3GraphCanvas'), 2);
    let nodes = nodesByLabel(document.getElementById('d3GraphCanvas'));
    expect(nodes.get('alpha beta...')).toEqual({ stroke: '#6366f1', opacity: '1' });
    expect(nodes.get('delta epsi...')).toEqual({ stroke: '#0f172a', opacity: '0.4' });

    openLinkageForBookmark('20');
    // Re-query: the second call re-rendered and replaced the SVG.
    await waitForTopology(document.getElementById('d3GraphCanvas'), 2);
    nodes = nodesByLabel(document.getElementById('d3GraphCanvas'));
    expect(nodes.get('alpha beta...')).toEqual({ stroke: '#0f172a', opacity: '0.4' });
    expect(nodes.get('delta epsi...')).toEqual({ stroke: '#6366f1', opacity: '1' });

    await waitForTransform(document.getElementById('d3GraphCanvas'));
  });

  it('discards a superseded frame instead of appending twice', async () => {
    setBookmarks([BM(10, 'alpha zeta'), BM(20, 'gamma beta')]);
    createCanvas();

    // Two clicks inside one macrotask: only the second render's Frame B may run.
    openLinkageForBookmark('10');
    openLinkageForBookmark('20');

    const canvas = document.getElementById('d3GraphCanvas');
    await waitForTopology(canvas, 2);

    // Exactly one node per bookmark — not 3 or 4 from a stale frame.
    expect(canvas.querySelectorAll('circle')).toHaveLength(2);
    const nodes = nodesByLabel(canvas);
    expect([...nodes.keys()].sort()).toEqual(['alpha zeta', 'gamma beta']);
    // ...and the highlight matches the SECOND request.
    expect(nodes.get('gamma beta')).toEqual({ stroke: '#6366f1', opacity: '1' });
  });

  it('leaves no pin behind for an unfocused render', async () => {
    setBookmarks([BM(10, 'alpha zeta'), BM(20, 'gamma beta')]);
    createCanvas();

    // Focused first (which pins), then a plain render of the same data.
    openLinkageForBookmark('10');
    await waitForTopology(document.getElementById('d3GraphCanvas'), 2);
    renderConceptLinkageGraph();
    await waitForTopology(document.getElementById('d3GraphCanvas'), 2);

    // A leaked fx would freeze every node at the centre. Wait for the
    // simulation to move at least one node away from its seed position.
    const canvas = document.getElementById('d3GraphCanvas');
    const seedPositions = [...canvas.querySelectorAll('g.nodes > g')].map((g) =>
      g.getAttribute('transform'),
    );
    const deadline = Date.now() + 3000;
    let moved = false;
    while (Date.now() < deadline && !moved) {
      await new Promise((r) => setTimeout(r, 50));
      moved = [...canvas.querySelectorAll('g.nodes > g')].some(
        (g, i) => g.getAttribute('transform') !== seedPositions[i],
      );
    }
    expect(moved).toBe(true);
  });

  it('grows the focused node once the link pass gives it a degree', async () => {
    // Three near-identical docs so the target's degree reaches 2. Degree 1
    // would not prove anything: the radius floor is
    // max(8, 4 + sqrt(1) * 4) === 8, i.e. the Frame A placeholder value.
    const text = 'apple pie recipe tart pastry cherry';
    setBookmarks([BM(10, text), BM(20, text), BM(30, text)]);
    createCanvas();

    openLinkageForBookmark('10');
    const canvas = document.getElementById('d3GraphCanvas');
    expect(canvas.querySelector('circle').getAttribute('r')).toBe('8');

    await waitForTopology(canvas, 3);
    const ringed = [...canvas.querySelectorAll('circle')].find(
      (c) => c.getAttribute('stroke') === '#6366f1',
    );
    expect(Number(ringed.getAttribute('r'))).toBeGreaterThan(8);
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
