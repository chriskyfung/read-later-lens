/**
 * @fileoverview Camera and node emphasis for the concept-linkage graph.
 *
 * Owns everything about "which bookmark is highlighted": the zoom transform
 * that centres it, the indigo ring and dimming on the rendered circles, and
 * the flag that decides whether the next simulation tick should re-centre.
 *
 * The two camera paths differ only in animation, so they share one transform
 * helper: `setFocusCamera` applies it with no transition (the render that
 * requested the focus must already be centred on its first paint), while
 * `centerFocusedNode` animates to it.
 */

import * as d3 from 'd3';
import { graphState } from './state.js';
import { unpinNode } from './topology.js';

/** Zoom factor applied when focusing a node. Shared by both camera paths. */
export const FOCUS_ZOOM = 1.6;

/** Stroke colour of the focused node's ring. */
const FOCUS_RING_STROKE = '#6366f1';
/** Stroke colour every other node keeps. */
const REST_STROKE = '#0f172a';
/** Stroke width of the focused node's ring. */
const FOCUS_RING_WIDTH = 4;
/** Stroke width of every other node. */
const REST_STROKE_WIDTH = 2;
/** Opacity of the dimmed, unfocused nodes. */
const DIMMED_OPACITY = 0.4;
/** Duration of the centring transition. */
const CENTER_DURATION_MS = 450;

/**
 * The zoom transform that maps `node` onto the viewport centre at FOCUS_ZOOM.
 *
 * Exposed so both camera paths agree on the mapping, and so the transform can
 * be asserted without driving a d3 transition.
 *
 * @param {{ x: number, y: number }} node
 * @param {number} width
 * @param {number} height
 * @returns {import('d3').ZoomTransform}
 */
export function focusCameraTransform(node, width, height) {
  const dx = width / 2 - node.x * FOCUS_ZOOM;
  const dy = height / 2 - node.y * FOCUS_ZOOM;
  return d3.zoomIdentity.translate(dx, dy).scale(FOCUS_ZOOM);
}

/** Look up the node currently being focused, or null when nothing is rendered. */
function focusedNode() {
  return graphState.nodes ? graphState.nodes.find((d) => d.id === graphState.focusedNodeId) : null;
}

/** True when a camera can be moved at all. */
function cameraReady() {
  return graphState.svg != null && graphState.zoom != null;
}

/**
 * Place the camera on the focused node with NO transition — used when the
 * node is already pinned (i.e. by the render that requested the focus), where
 * a first paint that is already centred is the whole point.
 */
export function setFocusCamera() {
  const node = focusedNode();
  if (!node || !cameraReady()) return;
  graphState.svg.call(
    graphState.zoom.transform,
    focusCameraTransform(node, graphState.width, graphState.height),
  );
}

/**
 * Center the viewport on the focused bookmark (animated, zoom k=FOCUS_ZOOM) so
 * the user always sees exactly which node is highlighted. Idempotent — repeated
 * calls mid-animation are ignored; the centering is re-applied when the
 * simulation settles (the 'end' event).
 */
export function centerFocusedNode() {
  if (graphState.focusedNodeId == null || graphState.pendingFocusCenter === false) return;
  const node = focusedNode();
  if (!node || !cameraReady()) {
    graphState.pendingFocusCenter = false;
    return;
  }
  graphState.svg
    .transition()
    .duration(CENTER_DURATION_MS)
    .call(
      graphState.zoom.transform,
      focusCameraTransform(node, graphState.width, graphState.height),
    );
  graphState.pendingFocusCenter = false;
}

/**
 * Apply the current node emphasis to the rendered selection: the focused
 * bookmark's circle gains an indigo ring (stroke-width 4) and every other node
 * dims to 40% opacity. No-op when nothing is focused.
 */
export function applyFocusStyles() {
  if (graphState.nodeSelection == null || graphState.focusedNodeId == null) return;
  graphState.nodeSelection.attr('opacity', (d) =>
    d.id === graphState.focusedNodeId ? 1 : DIMMED_OPACITY,
  );
  graphState.nodeSelection
    .select('circle')
    .attr('stroke', (d) => (d.id === graphState.focusedNodeId ? FOCUS_RING_STROKE : REST_STROKE))
    .attr('stroke-width', (d) =>
      d.id === graphState.focusedNodeId ? FOCUS_RING_WIDTH : REST_STROKE_WIDTH,
    );
}

/** Remove any emphasis, restoring every node to its default appearance. */
export function clearFocusStyles() {
  if (graphState.nodeSelection == null) return;
  graphState.nodeSelection.attr('opacity', 1);
  graphState.nodeSelection
    .select('circle')
    .attr('stroke', REST_STROKE)
    .attr('stroke-width', REST_STROKE_WIDTH);
}

/**
 * Clear the node emphasis (graph re-rendered or view reset), restoring the
 * default view with no highlighted bookmark.
 *
 * Also releases the focused node's pin (see ./linkage/topology.js), so a
 * reset cannot leave a node frozen in place with nothing highlighted. A
 * no-op when nothing is rendered — which is the render-start case, where
 * clearRenderState has already dropped `nodes`.
 */
export function resetFocus() {
  clearFocusStyles();
  if (graphState.focusedNodeId != null && graphState.nodes) {
    unpinNode(graphState.nodes.find((d) => d.id === graphState.focusedNodeId));
  }
  graphState.focusedNodeId = null;
  graphState.pendingFocusCenter = false;
}

/**
 * The focus-camera hooks both render paths pass to `wireSimulationHandlers`.
 *
 * The tick hook re-centres every frame while a re-centre is armed; the settle
 * hook arms one final re-centre on the finished layout (the target is pinned,
 * so the others settle around it). Arming on every tick would re-centre
 * mid-animation, so only `onSettled` sets the flag.
 *
 * @returns {{ onTick: () => void, onSettled: () => void }}
 */
export function focusSimulationHooks() {
  return {
    onTick: () => centerFocusedNode(),
    onSettled: () => {
      if (graphState.focusedNodeId != null) {
        graphState.pendingFocusCenter = true;
        centerFocusedNode();
      }
    },
  };
}
