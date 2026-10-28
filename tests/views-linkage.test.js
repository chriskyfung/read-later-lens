// @vitest-environment jsdom

/** @fileoverview Tests for the linkage graph view's guards and D3 render path.

 * The graph topology rules are covered by tests/linkage.test.js, and the pure
 * sizing/focus rules extracted from the view by
 * tests/views-linkage-helpers.test.js. This file exercises the view's
 * DOM-facing guards and the D3 render path against a REAL DOM (jsdom) so that
 * "renders a single node" is a meaningful claim - the old file deliberately
 * stubbed the document.
 *
 * The focus & camera API has its own suite in
 * tests/views-linkage-focus.test.js. Shared DOM fixtures and wait helpers live
 * in tests/helpers/linkage.js.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { renderConceptLinkageGraph, zoomGraphBy, resetGraphZoom } from '../src/views/linkage.js';
import { setBookmarks } from '../src/core/state';
import { BM, createCanvas, resetModuleState } from './helpers/linkage.js';

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

  it('paints the link layer under the node layer', async () => {
    const canvas = createCanvas();
    // Identical token sets guarantee a link above the threshold, so there is
    // at least one <line> whose stacking against the circles matters.
    setBookmarks([BM(1, 'alpha beta gamma'), BM(2, 'alpha beta gamma')]);
    renderConceptLinkageGraph();

    expect(canvas.querySelectorAll('line').length).toBeGreaterThan(0);
    // SVG stacks siblings in document order (no z-index): whichever layer is
    // appended FIRST paints underneath. Nodes must be on top — the pre-fa6439a
    // visual contract (node circles cover link strokes at intersections).
    const root = canvas.querySelector('svg > g'); // the zoom transform root
    const linkLayer = [...root.children].find((k) => k.querySelector('line'));
    const nodeLayer = canvas.querySelector('g.nodes');
    expect(linkLayer).toBeTruthy();
    expect(nodeLayer).toBeTruthy();
    // nodeLayer must FOLLOW linkLayer, i.e. paint after (on top of) it.
    expect(
      linkLayer.compareDocumentPosition(nodeLayer) & window.Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
