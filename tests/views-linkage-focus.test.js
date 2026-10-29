// @vitest-environment jsdom

/** @fileoverview Focus & camera API tests for the linkage graph view.
 *
 * These run against the real jsdom document with a real tab bar, panels and
 * toast, so `activateTab` and the panel-show path are exercised rather than
 * stubbed away. A previous attempt replaced `document` with a hand-rolled
 * stub, which made `activateTab` operate on detached fake nodes and left the
 * assertions re-reading nodes that a re-render had already detached.
 *
 * The pure camera rule (`focusCameraTransform`) is pinned in
 * tests/views-linkage-helpers.test.js; this file covers the DOM-visible
 * consequences of it. Shared fixtures and wait helpers live in
 * tests/helpers/linkage.js.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openLinkageForBookmark,
  focusLinkageNode,
  resetGraphZoom,
  renderConceptLinkageGraph,
  setLinkageWeighting,
  FOCUS_ZOOM,
} from '../src/views/linkage';
import { setBookmarks } from '../src/core/state';
import { graphState } from '../src/views/linkage/state.js';
import {
  BM,
  createCanvas,
  createTabShell,
  nodesByLabel,
  parseTransform,
  resetModuleState,
  waitForTopology,
  waitForTransform,
} from './helpers/linkage.js';

afterEach(() => {
  resetModuleState();
});

describe('focus & camera API', () => {
  beforeEach(() => {
    createTabShell();
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

  it('paints the link layer under the node layer after Frame B lands', async () => {
    setBookmarks([BM(10, 'alpha beta gamma'), BM(20, 'alpha beta gamma')]);
    openLinkageForBookmark('10');

    // Frame A paints only the focused node (no links yet); the link layer is
    // created with the rest of the graph in Frame B.
    const canvas = document.getElementById('d3GraphCanvas');
    await waitForTopology(canvas, 2);
    expect(canvas.querySelectorAll('line').length).toBeGreaterThan(0);

    // The regression this pins: fa6439a appended Frame B's link <g> as a
    // sibling AFTER the eager node wrapper, so links crossed over circles.
    const root = canvas.querySelector('svg > g');
    const linkLayer = [...root.children].find((k) => k.querySelector('line'));
    const nodeLayer = canvas.querySelector('g.nodes');
    expect(linkLayer).toBeTruthy();
    expect(nodeLayer).toBeTruthy();
    expect(
      linkLayer.compareDocumentPosition(nodeLayer) & window.Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('pins the focused node in place, like the focused-render path does', () => {
    setBookmarks([BM(10, 'alpha zeta'), BM(20, 'gamma beta')]);
    renderConceptLinkageGraph();
    createCanvas();

    // focusLinkageNode must establish the SAME invariant a focused render
    // does: the highlighted node carries fx/fy, so a still-running simulation
    // cannot invalidate the camera by moving it after the pan lands.
    expect(focusLinkageNode('10')).toBe(true);

    const nodes = graphState.nodes;
    const focused = nodes.find((d) => d.id === '10');
    expect(focused.fx).toBe(focused.x);
    expect(focused.fy).toBe(focused.y);
    // Pinned in place — no teleport to the canvas centre, no layout jump.
    // (The unfocused render's layout is free, so the node is wherever the
    // simulation put it; all that matters is that it is now stuck there.)
    expect(focused.fx).not.toBe(400);

    // Only the focused node is pinned; the other stays free to settle.
    const other = nodes.find((d) => d.id === '20');
    expect(other.fx).toBeUndefined();
    expect(other.fy).toBeUndefined();
  });

  it('unpins the previously focused node when refocusing another', () => {
    setBookmarks([BM(10, 'alpha zeta'), BM(20, 'gamma beta')]);
    renderConceptLinkageGraph();

    focusLinkageNode('10');
    focusLinkageNode('20');

    const nodes = graphState.nodes;
    expect(nodes.find((d) => d.id === '10').fx).toBeUndefined();
    expect(nodes.find((d) => d.id === '10').fy).toBeUndefined();
    const focused = nodes.find((d) => d.id === '20');
    expect(focused.fx).toBe(focused.x);
    expect(focused.fy).toBe(focused.y);
  });

  it('unpins the previously focused node when the new id has no node', () => {
    setBookmarks([BM(10, 'alpha zeta'), BM(20, 'gamma beta')]);
    renderConceptLinkageGraph();

    focusLinkageNode('10');
    expect(focusLinkageNode('zzz')).toBe(false);

    // The stale pin must not outlive the stale highlight it belonged to.
    const previous = graphState.nodes.find((d) => d.id === '10');
    expect(previous.fx).toBeUndefined();
    expect(previous.fy).toBeUndefined();
  });

  it('keeps the pin across a settled simulation without re-pinning', () => {
    // Parity claim the PR description makes, asserted directly: after EITHER
    // entry point succeeds, the focused node is pinned at its current spot.
    setBookmarks([BM(1, 'lone node')]);
    openLinkageForBookmark('1');
    expect(graphState.nodes.find((d) => d.id === '1').fx).not.toBeUndefined();

    renderConceptLinkageGraph();
    focusLinkageNode('1');
    const node = graphState.nodes.find((d) => d.id === '1');
    expect(node.fx).toBe(node.x);
    expect(node.fy).toBe(node.y);
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

  describe('TF-IDF weighting toggle keeps focus', () => {
    beforeEach(() => {
      createTabShell();
      createCanvas();
    });

    it('preserves the pinned node and camera across a toggle to tfidf', async () => {
      setBookmarks([BM(10, 'alpha zeta'), BM(20, 'gamma beta')]);

      openLinkageForBookmark('10');
      const canvas = document.getElementById('d3GraphCanvas');
      await waitForTopology(canvas, 2);

      // Confirm focus is established before the toggle.
      const before = nodesByLabel(canvas);
      expect(before.get('alpha zeta')).toEqual({ stroke: '#6366f1', opacity: '1' });
      expect(graphState.focusedNodeId).toBe('10');
      expect(graphState.nodes.find((d) => d.id === '10').fx).not.toBeUndefined();

      // Toggle TF ⇄ TF-IDF (the panel checkbox path).
      setLinkageWeighting('tfidf');
      const canvas2 = document.getElementById('d3GraphCanvas');
      await waitForTopology(canvas2, 2);

      const after = nodesByLabel(canvas2);
      expect(after.get('alpha zeta')).toEqual({ stroke: '#6366f1', opacity: '1' });
      expect(after.get('gamma beta')).toEqual({ stroke: '#0f172a', opacity: '0.4' });
      expect(graphState.focusedNodeId).toBe('10');
      const focused = graphState.nodes.find((d) => d.id === '10');
      expect(focused.fx).toBe(focused.x);
      expect(focused.fy).toBe(focused.y);

      await waitForTransform(canvas2);
      const t = parseTransform(canvas2.querySelector('svg > g').getAttribute('transform'));
      expect(t).not.toBeNull();
      expect(t.k).toBeCloseTo(FOCUS_ZOOM, 5);
    });

    it('preserves the pinned node and camera across a toggle back to tf', async () => {
      setBookmarks([BM(10, 'alpha zeta'), BM(20, 'gamma beta')]);

      openLinkageForBookmark('10');
      const canvas = document.getElementById('d3GraphCanvas');
      await waitForTopology(canvas, 2);

      setLinkageWeighting('tfidf');
      await waitForTopology(document.getElementById('d3GraphCanvas'), 2);

      setLinkageWeighting('tf');
      const canvas2 = document.getElementById('d3GraphCanvas');
      await waitForTopology(canvas2, 2);

      const after = nodesByLabel(canvas2);
      expect(after.get('alpha zeta')).toEqual({ stroke: '#6366f1', opacity: '1' });
      expect(graphState.focusedNodeId).toBe('10');
    });
  });
});
