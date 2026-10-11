// @vitest-environment jsdom

/** @fileoverview Regression tests for node dragging in the linkage graph view.

 * fa6439a ("perf(linkage): defer graph topology build") introduced the per-render
 * `simRef` and rewrote `dragstarted` to bail on `!event.active` — but d3-drag
 * reports `active` as the gesture count BEFORE incrementing, so it is 0 at the
 * start of every primary drag. The guard therefore always returned early:
 * alphaTarget was never raised and fx/fy never seeded, so once a simulation
 * settled (alpha below alphaMin) no tick ever fired again and dragged nodes
 * froze. Dragging appeared to work only in the first ~5s after a render, while
 * the simulation was still hot on its own.
 *
 * The pure sizing/camera rules are pinned in tests/views-linkage-helpers.test.js;
 * these cover the drag contract against a real d3 simulation in jsdom.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as d3 from 'd3';
import { renderConceptLinkageGraph, openLinkageForBookmark } from '../src/views/linkage.js';
import { graphState } from '../src/views/linkage/state.js';
import { setBookmarks } from '../src/core/state.js';
import {
  BM,
  createCanvas,
  createTabShell,
  resetModuleState,
  waitForTopology,
} from './helpers/linkage.js';

/** How long a re-heated simulation may take to fire its first tick. */
const TICK_TIMEOUT_MS = 500;
/** How long a stopped simulation is observed to stay silent. */
const SILENT_WINDOW_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Build a synthetic mouse event. d3-drag's mousedowned()/mouseupped() call
 * `select(event.view)` and nodrag()/yesdrag() dereference `view.document`, so
 * the gesture only proceeds with a real Window on the event. This jsdom build
 * (jsdom@30) rejects the `view` init member outright — "member view is not of
 * type Window", even for `document.defaultView`, which === the global window
 * yet fails the realm check — so the view is attached after construction, the
 * one path that passes.
 *
 * @param {Window} view
 * @param {string} type
 * @param {number} clientX
 * @param {number} clientY
 * @returns {MouseEvent}
 */
function mouseEvent(view, type, clientX, clientY) {
  const event = new view.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(event, 'view', { value: view, configurable: true });
  return event;
}

/**
 * The window of the live document. `document.defaultView` is used rather than
 * the global `window` so the event is bound to the document under test.
 */
const liveView = (node) => node.ownerDocument.defaultView;

/** Press a drag gesture on a node group, starting at (x, y). */
function mouseDown(nodeG, x = 10, y = 20) {
  nodeG.dispatchEvent(mouseEvent(liveView(nodeG), 'mousedown', x, y));
}

/** Move the drag gesture — d3-drag ignores motion within the click distance. */
function mouseMove(nodeG, x, y) {
  liveView(nodeG).dispatchEvent(mouseEvent(liveView(nodeG), 'mousemove', x, y));
}

/** Release the drag gesture. */
function mouseUp(nodeG, x, y) {
  liveView(nodeG).dispatchEvent(mouseEvent(liveView(nodeG), 'mouseup', x, y));
}

/** Reject unless the simulation fires a tick within `timeout`. */
function tickWithin(sim, timeout = TICK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    // A namespaced listener: `on('tick', null)` would strip the view's own tick
    // handler, which would quietly change what later ticks do to the DOM.
    const timer = setTimeout(() => {
      sim.on('tick.test', null);
      reject(new Error(`no tick within ${timeout}ms`));
    }, timeout);
    sim.on('tick.test', () => {
      clearTimeout(timer);
      sim.on('tick.test', null);
      resolve();
    });
  });
}

/** Settle the graph's simulation: stop it, as it stops itself once alpha decays. */
function settle(sim) {
  sim.stop();
}

afterEach(() => {
  resetModuleState();
});

describe('node dragging', () => {
  it('re-heats a settled simulation when a drag starts', async () => {
    const canvas = createCanvas();
    setBookmarks([BM(1, 'alpha zeta'), BM(2, 'gamma beta')]);
    renderConceptLinkageGraph();

    const sim = graphState.simulation;
    expect(sim).not.toBeNull();
    settle(sim);

    // Negative control: a stopped simulation stays silent on its own, so the
    // tick below can only come from the drag re-heating it.
    let ticked = false;
    sim.on('tick.control', () => {
      ticked = true;
    });
    await sleep(SILENT_WINDOW_MS);
    expect(ticked).toBe(false);
    sim.on('tick.control', null);

    mouseDown(canvas.querySelector('g.nodes > g'));

    await tickWithin(sim);
  });

  it('pins the node at the grab point on drag start', () => {
    const canvas = createCanvas();
    setBookmarks([BM(1, 'alpha zeta'), BM(2, 'gamma beta')]);
    renderConceptLinkageGraph();

    const sim = graphState.simulation;
    settle(sim);
    const nodeG = canvas.querySelector('g.nodes > g');
    const datum = d3.select(nodeG).datum();

    mouseDown(nodeG);

    // The pin is seeded from the node's CURRENT position, so it does not jump
    // to the pointer on the drag's first frame.
    expect(datum.fx).not.toBeNull();
    expect(datum.fx).toBeCloseTo(datum.x, 10);
    expect(datum.fy).toBeCloseTo(datum.y, 10);
  });

  it('clears the pin and restores alphaTarget on drag end', () => {
    const canvas = createCanvas();
    setBookmarks([BM(1, 'alpha zeta'), BM(2, 'gamma beta')]);
    renderConceptLinkageGraph();

    const sim = graphState.simulation;
    settle(sim);
    const nodeG = canvas.querySelector('g.nodes > g');
    const datum = d3.select(nodeG).datum();

    mouseDown(nodeG);
    expect(sim.alphaTarget()).toBe(0.3);

    // A real move (any motion clears d3-drag's click-distance gate), then release.
    mouseMove(nodeG, 60, 70);
    mouseUp(nodeG, 60, 70);

    expect(datum.fx).toBeNull();
    expect(datum.fy).toBeNull();
    expect(sim.alphaTarget()).toBe(0);
  });

  it('re-heats after a deferred focused render', async () => {
    createTabShell();
    createCanvas();
    setBookmarks([BM(1, 'alpha zeta'), BM(2, 'gamma beta')]);

    expect(openLinkageForBookmark('1')).toBe(true);
    // Frame B builds the rest of the graph in a later macrotask; wait for it so
    // graphState.simulation is the Frame B simulation the drag must re-heat.
    await waitForTopology(document.getElementById('d3GraphCanvas'), 2);

    const sim = graphState.simulation;
    expect(sim).not.toBeNull();
    settle(sim);

    mouseDown(document.getElementById('d3GraphCanvas').querySelector('g.nodes > g'));

    await tickWithin(sim);
  });
});
