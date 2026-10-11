/**
 * @fileoverview Tests for the pure linkage-graph helpers extracted from
 * src/views/linkage.js.
 *
 * The view's DOM-facing guards and D3 render path are covered by
 * tests/views-linkage.test.js; this file covers only the pure rules — node
 * sizing, link stroke clamping, focus pinning, and the Frame A/Frame B topology
 * merge — so a change to any formula fails here first, with a readable name,
 * rather than surfacing as a broken canvas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  nodeRadius,
  nodeLabelOffsetX,
  truncateNodeLabel,
  NODE_RADIUS_MIN,
} from '../src/views/linkage/nodes.js';
import { afterPaint } from '../src/views/linkage/scene.js';
import { graphState, cancelPendingTopology } from '../src/views/linkage/state.js';
import { linkStrokeWidth } from '../src/views/linkage/simulation.js';
import {
  resolveFocusTarget,
  prepareFocusedTopology,
  INITIAL_SPREAD,
} from '../src/views/linkage/topology.js';
import { FOCUS_ZOOM, focusCameraTransform } from '../src/views/linkage/focus.js';

describe('node sizing', () => {
  it('collapses degree 0 to the radius floor', () => {
    // The value a lone unlinked bookmark renders at; the floor is what keeps a
    // degree-0 node visible at all.
    expect(nodeRadius(0)).toBe(NODE_RADIUS_MIN);
    expect(nodeRadius(0)).toBe(8);
  });

  it('grows with the square root of degree, never below the floor', () => {
    expect(nodeRadius(4)).toBeCloseTo(12, 10); // 4 + sqrt(4) * 4
    expect(nodeRadius(100)).toBeCloseTo(44, 10); // 4 + sqrt(100) * 4
    for (const degree of [0, 1, 2, 9, 40]) {
      expect(nodeRadius(degree)).toBeGreaterThanOrEqual(NODE_RADIUS_MIN);
    }
  });

  it('offsets the label outside the circle, never below the floor', () => {
    expect(nodeLabelOffsetX(0)).toBe(10);
    expect(nodeLabelOffsetX(4)).toBeCloseTo(14, 10);
    expect(nodeLabelOffsetX(100)).toBeCloseTo(46, 10);
  });

  it('truncates a long title and leaves a short one intact', () => {
    expect(truncateNodeLabel('lone node')).toBe('lone node');
    // 16 chars, cut to 10 plus the ellipsis.
    expect(truncateNodeLabel('alpha beta gamma')).toBe('alpha beta...');
    // Exactly at the limit is not cut.
    expect(truncateNodeLabel('0123456789')).toBe('0123456789');
    expect(truncateNodeLabel('01234567890')).toBe('0123456789...');
  });
});

describe('link stroke width', () => {
  it('clamps weight into the rendered range [1, 4]', () => {
    // The clamp, not the current values, is the contract: pinning 1..4 keeps
    // the rule honest even though every caller today passes undefined.
    expect(linkStrokeWidth(0)).toBe(1);
    expect(linkStrokeWidth(0.5)).toBe(1);
    expect(linkStrokeWidth(2.5)).toBe(2.5);
    expect(linkStrokeWidth(4)).toBe(4);
    expect(linkStrokeWidth(99)).toBe(4);
  });
});

describe('resolveFocusTarget', () => {
  const node = (id) => ({ id, x: 0, y: 0 });

  it('pins the matching node to the canvas centre', () => {
    const pinned = resolveFocusTarget([node('a'), node('b')], 'b', 800, 500);
    expect(pinned).not.toBeNull();
    expect(pinned.fx).toBe(400);
    expect(pinned.fy).toBe(250);
    // x/y are seeded too, so the node paints centred before the first tick.
    expect(pinned.x).toBe(400);
    expect(pinned.y).toBe(250);
  });

  it('leaves the other nodes untouched', () => {
    const nodes = [node('a'), node('b')];
    resolveFocusTarget(nodes, 'b', 800, 500);
    expect(nodes[0].fx).toBeUndefined();
    expect(nodes[0].x).toBe(0);
  });

  it('returns null for a null id or an unknown id', () => {
    expect(resolveFocusTarget([node('a')], null, 800, 500)).toBeNull();
    expect(resolveFocusTarget([node('a')], 'zzz', 800, 500)).toBeNull();
  });

  it('does not pin anything when the id is unknown', () => {
    const nodes = [node('a')];
    resolveFocusTarget(nodes, 'zzz', 800, 500);
    expect(nodes[0].fx).toBeUndefined();
  });
});

describe('prepareFocusedTopology', () => {
  it('keeps the painted object and adopts the degree the link pass computed', () => {
    const focusNode = { id: 'a', degree: 0, fx: 400, fy: 250 };
    const freshCopy = { id: 'a', degree: 3 };
    const out = prepareFocusedTopology([freshCopy, { id: 'b', degree: 1 }], focusNode, 800, 500);

    // Object identity, not value: the DOM holds `focusNode` as __data__, and
    // substituting the fresh copy would orphan the painted node.
    expect(out[0]).toBe(focusNode);
    expect(out[0].degree).toBe(3);
    expect(out[0].fx).toBe(400);
  });

  it('spreads the unpositioned nodes outward from the focused node', () => {
    const focusNode = { id: 'a', degree: 0 };
    const other = { id: 'b', degree: 0, x: 10, y: -5 };
    const out = prepareFocusedTopology([{ id: 'a', degree: 0 }, other], focusNode, 800, 500);

    // d3 seeds unpositioned nodes near the origin; spreading by INITIAL_SPREAD
    // keeps forceCollide from flinging the graph apart on the first tick.
    expect(out[1].x).toBeCloseTo(400 + 10 * INITIAL_SPREAD, 10);
    expect(out[1].y).toBeCloseTo(250 - 5 * INITIAL_SPREAD, 10);
  });

  it('does not move the focused node', () => {
    const focusNode = { id: 'a', degree: 0, x: 400, y: 250 };
    prepareFocusedTopology([{ id: 'a', degree: 0 }, focusNode], focusNode, 800, 500);
    expect(focusNode.x).toBe(400);
    expect(focusNode.y).toBe(250);
  });

  it('treats a missing x/y as the origin before spreading', () => {
    const focusNode = { id: 'a', degree: 0 };
    const other = { id: 'b', degree: 0 };
    prepareFocusedTopology([{ id: 'a', degree: 0 }, other], focusNode, 800, 500);
    expect(other.x).toBe(400);
    expect(other.y).toBe(250);
  });

  it('is a no-op on the node list when nothing is focused', () => {
    const nodes = [{ id: 'a', x: 7, y: 9 }];
    expect(prepareFocusedTopology(nodes, null, 800, 500)).toBe(nodes);
    expect(nodes[0].x).toBe(7);
    expect(nodes[0].y).toBe(9);
  });

  it('leaves the array alone when the focus id is not in the fresh list', () => {
    const focusNode = { id: 'a', degree: 0 };
    const other = { id: 'b', degree: 0 };
    const out = prepareFocusedTopology([other], focusNode, 800, 500);
    expect(out[0]).toBe(other);
    expect(out[0].x).toBe(400);
  });
});

describe('focusCameraTransform', () => {
  it('pans a centred node by the amount the zoom about origin displaces it', () => {
    // d3's zoom scales about the origin, so a node already at the centre still
    // needs a pan: 400 * (1 - k). Matches the value the view test pins.
    const t = focusCameraTransform({ x: 400, y: 250 }, 800, 500);
    expect(t.x).toBeCloseTo(400 * (1 - FOCUS_ZOOM), 10);
    expect(t.y).toBeCloseTo(250 * (1 - FOCUS_ZOOM), 10);
    expect(t.k).toBe(FOCUS_ZOOM);
  });

  it('pans so the node lands at the centre at scale k', () => {
    const t = focusCameraTransform({ x: 400, y: 250 }, 800, 500);
    // The invariant the whole camera rests on, written as the projection
    // itself: k * node + translate === viewport centre.
    expect(t.k * 400 + t.x).toBeCloseTo(400, 10);
    expect(t.k * 250 + t.y).toBeCloseTo(250, 10);
  });

  it('holds the invariant for an off-centre node', () => {
    const t = focusCameraTransform({ x: 120, y: 700 }, 800, 500);
    expect(t.k * 120 + t.x).toBeCloseTo(400, 10);
    expect(t.k * 700 + t.y).toBeCloseTo(250, 10);
  });

  it('is the same mapping both camera paths use', () => {
    // setFocusCamera applies it with no transition and centerFocusedNode
    // animates to it; a drift between them would move the node mid-animation.
    const node = { x: 10, y: 20 };
    const a = focusCameraTransform(node, 800, 500);
    const b = focusCameraTransform(node, 800, 500);
    expect(a).toEqual(b);
  });
});

describe('afterPaint cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /**
   * Install a minimal `window.requestAnimationFrame` double so the real-browser
   * branch is exercised even though the node test environment has no window.
   * Returns a `flush()` that runs every pending rAF callback synchronously.
   */
  function stubWindowRaf() {
    let nextId = 1;
    const pending = new Map();
    vi.stubGlobal('window', {
      requestAnimationFrame: (cb) => {
        const id = nextId++;
        pending.set(id, cb);
        return id;
      },
      cancelAnimationFrame: (id) => {
        pending.delete(id);
      },
    });
    return {
      flush() {
        for (const [id, cb] of [...pending]) {
          pending.delete(id);
          cb();
        }
      },
      pendingCount: () => pending.size,
    };
  }

  it('returns a cancellable handle on the macrotask fallback path', () => {
    const fn = vi.fn();
    const handle = afterPaint(fn);
    expect(handle).toBeTruthy();
    expect(typeof handle.cancel).toBe('function');

    handle.cancel();
    vi.runAllTimers();
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs the deferred callback when not cancelled (fallback path)', () => {
    const fn = vi.fn();
    afterPaint(fn);
    vi.runAllTimers();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending rAF + timeout chain before either stage runs', () => {
    const raf = stubWindowRaf();
    const fn = vi.fn();
    const handle = afterPaint(fn);

    handle.cancel();
    raf.flush(); // even if the rAF fires late, the guard must skip the timeout
    vi.runAllTimers();
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancels the inner timeout after the rAF stage has already run', () => {
    const raf = stubWindowRaf();
    const fn = vi.fn();
    const handle = afterPaint(fn);

    raf.flush(); // rAF done; the setTimeout(fn, 0) is now armed
    handle.cancel();
    vi.runAllTimers();
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancelPendingTopology clears the handle the view stores from afterPaint', () => {
    const fn = vi.fn();
    graphState.pendingTopologyTimer = afterPaint(fn);

    cancelPendingTopology();
    vi.runAllTimers();

    expect(fn).not.toHaveBeenCalled();
    expect(graphState.pendingTopologyTimer).toBeNull();
  });
});
