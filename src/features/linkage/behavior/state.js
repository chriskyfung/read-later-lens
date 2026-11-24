/**
 * @fileoverview Module-private state for the concept-linkage graph view.
 *
 * The zoomable SVG, the running simulation and the current focus are all
 * view-scoped, so they cannot live in src/core/state — but they are read
 * from every module in this directory, so they live here instead of in
 * ../views/linkage.js.
 *
 * `focusedNodeId` and `pendingFocusCenter` belong with the camera that uses
 * them (./focus.js), but they must survive a re-render that replaces the
 * selections, so they are stored here too.
 *
 * `weighting` is the graph's scoring mode ('tf' | 'tfidf'), set by the panel
 * checkbox. Session-scoped like everything else in this file: this app has
 * no UI-preference persistence layer (IndexedDB holds bookmarks only), so
 * the toggle resets to 'tf' on reload.
 *
 * State is created by `createGraphState()` so the `LinkageGraph` class can
 * own its own instance instead of reaching into a module-global singleton.
 * The `graphState` export below is the default module instance used by the
 * legacy render path; new code should use the class instance's state.
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
 * @property {{ cancel: () => void }|null} pendingTopologyTimer Deferred Frame
 *   B handle returned by `afterPaint` (see ./linkage/scene.js); `cancel()`
 *   stops both the rAF and the inner macrotask stage.
 * @property {'tf'|'tfidf'} weighting Link scoring mode (panel checkbox).
 */

/**
 * Create a fresh GraphState instance. Each LinkageGraph instance owns its own
 * state so multiple graphs (or tests) cannot leak into each other.
 * @returns {GraphState}
 */
export function createGraphState() {
  return {
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
    weighting: 'tf',
  };
}

/** Default module instance used by the legacy render path. */
export const graphState = createGraphState();

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
 * @param {GraphState} [state] defaults to the module `graphState`
 */
export function clearRenderState(state = graphState) {
  state.simulation = null;
  state.svg = null;
  state.zoom = null;
  state.nodes = null;
  state.nodeSelection = null;
}

/** Cancel a deferred topology build, if one is outstanding.
 * @param {GraphState} [state] defaults to the module `graphState`
 */
export function cancelPendingTopology(state = graphState) {
  if (state.pendingTopologyTimer == null) return;
  state.pendingTopologyTimer.cancel();
  state.pendingTopologyTimer = null;
}

/** True when this render is still the latest one, so its deferred work is wanted.
 * @param {number} generation
 * @param {GraphState} [state] defaults to the module `graphState`
 */
export function isCurrentGeneration(generation, state = graphState) {
  return generation === state.renderGeneration;
}

/** Bump and return the generation for a new render, superseding any earlier one.
 * @param {GraphState} [state] defaults to the module `graphState`
 * @returns {number}
 */
export function nextRenderGeneration(state = graphState) {
  state.renderGeneration += 1;
  return state.renderGeneration;
}
