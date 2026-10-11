/**
 * @fileoverview Module-private state for the concept-linkage graph view.
 *
 * The zoomable SVG, the running simulation and the current focus are all
 * view-scoped, so they cannot live in src/core/state.js — but they are read
 * from every module in this directory, so they live here instead of in
 * ../views/linkage.js. One exported object, mutated in place: the object is
 * private to the feature by convention, never imported outside the linkage
 * view and its submodules.
 *
 * `focusedNodeId` and `pendingFocusCenter` belong with the camera that uses
 * them (./focus.js), but they must survive a re-render that replaces the
 * selections, so they are stored here too.
 */

/**
 * @typedef {object} GraphState
 * @property {import('d3').Selection|null} svg The zoomable `<svg>`.
 * @property {import('d3').ZoomBehavior|null} zoom
 * @property {import('d3').Simulation|null} simulation
 * @property {object[]|null} nodes The current node records.
 * @property {import('d3').Selection|null} nodeSelection The rendered `<g>` per node.
 * @property {number} width Canvas width in CSS pixels.
 * @property {number} height Canvas height in CSS pixels.
 * @property {string|null} focusedNodeId Bookmark id being highlighted, or null.
 * @property {boolean} pendingFocusCenter Whether the next tick should re-centre.
 * @property {number} renderGeneration Monotonic id of the latest render.
 * @property {ReturnType<typeof setTimeout>|null} pendingTopologyTimer Deferred Frame B handle.
 */

/** @type {GraphState} */
export const graphState = {
  svg: null,
  zoom: null,
  simulation: null,
  nodes: null,
  nodeSelection: null,
  width: 0,
  height: 0,
  focusedNodeId: null,
  pendingFocusCenter: false,
  renderGeneration: 0,
  pendingTopologyTimer: null,
};

/** Resting width/height used when the canvas reports zero (jsdom, or a hidden panel). */
export const FALLBACK_WIDTH = 800;
/** Resting height, paired with FALLBACK_WIDTH. */
export const FALLBACK_HEIGHT = 500;

/** Resolve the canvas dimensions, falling back where the layout reports zero. */
export function resolveCanvasSize(container) {
  return {
    width: container.clientWidth || FALLBACK_WIDTH,
    height: container.clientHeight || FALLBACK_HEIGHT,
  };
}

/**
 * Drop every reference a render owned, so an early return (no container, or an
 * empty library) cannot leave a stale selection behind for the focus API.
 * The generation is NOT reset here — see nextRenderGeneration.
 */
export function clearRenderState() {
  graphState.simulation = null;
  graphState.svg = null;
  graphState.zoom = null;
  graphState.nodes = null;
  graphState.nodeSelection = null;
}

/** Cancel a deferred topology build, if one is outstanding. */
export function cancelPendingTopology() {
  if (graphState.pendingTopologyTimer == null) return;
  clearTimeout(graphState.pendingTopologyTimer);
  graphState.pendingTopologyTimer = null;
}

/** True when this render is still the latest one, so its deferred work is wanted. */
export function isCurrentGeneration(generation) {
  return generation === graphState.renderGeneration;
}

/** Bump and return the generation for a new render, superseding any earlier one. */
export function nextRenderGeneration() {
  graphState.renderGeneration += 1;
  return graphState.renderGeneration;
}
