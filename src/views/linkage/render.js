/**
 * @fileoverview Linkage graph view orchestration — Frame A / Frame B render paths.
 *
 * Pure render logic moved out of linkage.js so it can be consumed through
 * the barrel (./linkage) without circular-import risk. All submodule imports
 * use direct relative paths (./focus.js, ./state.js, etc.) rather than
 * the barrel, keeping the dependency graph acyclic.
 *
 * External consumers import from ./linkage (the barrel) rather than this
 * file directly.
 */

import * as d3 from 'd3';
import { getFilteredBookmarksTop } from '../../core/filters.js';
import { buildLinkageGraph, buildGraphNodes } from '../../analytics';
import { linkageEmptyStateHtml } from '../../components/linkage/graph.js';
import { activateTab } from '../tabs.js';
import { showToast } from '../../utils/dom';
import {
  createForceSimulation,
  createLinkSelection,
  refreshNodeRadii,
  wireSimulationHandlers,
} from './simulation.js';
import { prepareFocusedTopology, resolveFocusTarget, unpinNode, pinNodeAt } from './topology.js';
import {
  graphState,
  cancelPendingTopology,
  clearRenderState,
  isCurrentGeneration,
  nextRenderGeneration,
  resolveCanvasSize,
} from './state.js';
import {
  FOCUS_ZOOM,
  applyFocusStyles,
  centerFocusedNode,
  clearFocusStyles,
  focusSimulationHooks,
  resetFocus,
  setFocusCamera,
} from './focus.js';
import { afterPaint, createNodeLayer, createScene, gatherTooltipRefs } from './scene.js';

// FOCUS_ZOOM is re-exported so the module's public surface is unchanged for
// callers that imported it from here rather than from ./linkage/focus.js.
export { FOCUS_ZOOM };

/**
 * Render the concept-linkage graph tab.
 *
 * @param {string|null} [focusId] Bookmark id to pin and centre on. When given,
 *   the node is positioned at the canvas centre BEFORE the force simulation is
 *   built (via `fx`/`fy`), so the camera can be placed on it in this same call
 *   with no transition and no wait for the first simulation tick. Omit it for
 *   a plain, unfocused render.
 * @returns {boolean} Whether the graph rendered (false when there is no
 *   container, or when nothing matches the active filters).
 */
export function renderConceptLinkageGraph(focusId = null) {
  if (graphState.simulation) graphState.simulation.stop();
  // Clear render + focus state first, so an early return (no container, or an
  // empty library) cannot leave stale references for the focus API below.
  clearRenderState();
  resetFocus();
  // Any topology still owed by a previous render belongs to a graph that is
  // about to be replaced, and running it would append nodes twice.
  cancelPendingTopology();
  const generation = nextRenderGeneration();

  const container = document.getElementById('d3GraphCanvas');
  if (!container) return false;
  container.innerHTML = '';

  const tooltipRefs = gatherTooltipRefs();

  const filtered = getFilteredBookmarksTop(50); // Limit to top 50 for graph clarity
  if (filtered.length === 0) {
    container.innerHTML = linkageEmptyStateHtml();
    return false;
  }

  const { width, height } = resolveCanvasSize(container);
  graphState.width = width;
  graphState.height = height;

  // ---- Frame A scaffolding ------------------------------------------------
  // Node records and the domain set are the cheap half of the graph build, so
  // they are available immediately. The link pass (tokenize + O(n^2) cosine)
  // is what costs tens to hundreds of ms; when focusing, it is deferred until
  // after this frame has painted, so the bookmark is on screen first.
  //
  // Both are `let` because an unfocused render replaces them with the full
  // build's output, which is the only place each node's degree becomes known.
  let { nodes: nodesList, domains } = buildGraphNodes(filtered);

  // Resolve the focus target. A null here means "nothing to focus": fall
  // through to a plain, single-pass render so the graph still appears, and
  // report it so the caller can toast.
  let focusNode = null;
  if (focusId != null) {
    // Pins the node to the canvas centre (see ./linkage/topology.js), which is
    // what lets the camera be placed on it in this same call.
    focusNode = resolveFocusTarget(nodesList, focusId, width, height);
    if (focusNode) graphState.focusedNodeId = focusNode.id;
  }

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(domains);

  // Mutable holders so DOM built in one frame can reach selections that only
  // exist in a later one: the hover handlers read the link selection and the
  // drag handlers read the simulation, neither of which exists while Frame A
  // is on screen.
  const linkRef = { current: null };
  const simRef = { current: null };

  // The zoomable svg scaffold and the per-node layer (drag, circle, label,
  // hover) both live in ./linkage/scene.js; Frame B appends into the same
  // wrapper this returns, so every node stays under one element. The returned
  // linkWrapper is the pre-ordered UNDER layer — links go there, never as a
  // fresh sibling of nodeWrapper, or they paint over the circles.
  const { linkWrapper, nodeWrapper } = createScene(width, height);
  const { appendNodeGroups, decorateNodes } = createNodeLayer({
    nodeWrapper,
    colorScale,
    linkRef,
    simRef,
    tooltipRefs,
  });

  // ---- Frame B: the expensive half, deferred until after the first paint --
  // Only reached by a focused render. Runs the link pass, then builds the rest
  // of the graph around the already-centred bookmark.
  const buildRestOfGraph = () => {
    const { nodes: freshNodes, links } = buildLinkageGraph(filtered, {
      weighting: graphState.weighting,
    });

    // Keep OUR object in the array — the DOM already holds it as __data__ —
    // adopting the degree the link pass computed, and spread the
    // as-yet-unpositioned nodes out from the centred bookmark so the graph
    // grows away from it instead of piling onto one spot. See
    // ./linkage/topology.js for why object identity matters here.
    prepareFocusedTopology(freshNodes, focusNode, width, height);

    const simulation = createForceSimulation(freshNodes, links, width, height);

    graphState.simulation = simulation;
    simRef.current = simulation;

    linkRef.current = createLinkSelection(linkWrapper, links);

    const rest = appendNodeGroups(freshNodes.filter((n) => n !== focusNode));
    decorateNodes(rest);
    rest.attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Every node is on screen now, so the emphasis covers all of them (the
    // newcomers are dimmed) and the tick handler can move them all.
    graphState.nodes = freshNodes;
    graphState.nodeSelection = nodeWrapper.selectAll('g');
    applyFocusStyles();
    // The target's radius only became knowable once the link pass gave it a
    // degree, so refresh it here rather than leaving the Frame A placeholder.
    refreshNodeRadii(graphState.nodeSelection);

    wireSimulationHandlers(simulation, {
      getNodes: () => graphState.nodeSelection,
      getLinks: () => linkRef.current,
      ...focusSimulationHooks(),
    });
  };

  // ---- Frame A: the focused bookmark, in this very call -------------------
  if (focusNode) {
    const node = appendNodeGroups([focusNode]);
    graphState.nodes = nodesList;
    graphState.nodeSelection = node;
    // The tick handler writes this same attribute; seed it now so the node is
    // visible at the centre on the first paint instead of flashing at (0,0).
    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    decorateNodes(node);
    setFocusCamera();
    applyFocusStyles();

    graphState.pendingTopologyTimer = afterPaint(() => {
      // A newer render (another click, resetGraphZoom, a tab switch) has
      // replaced this graph, so its topology is no longer wanted.
      if (!isCurrentGeneration(generation)) return;
      graphState.pendingTopologyTimer = null;
      buildRestOfGraph();
    });

    return true;
  }

  // ---- Unfocused render: one pass, as before ------------------------------
  // Replace the degree-less placeholders with the full build's nodes, and
  // widen the colour scale's domain to match.
  const built = buildLinkageGraph(filtered, { weighting: graphState.weighting });
  nodesList = built.nodes;
  const links = built.links;
  domains = built.domains;
  colorScale.domain(domains);

  const simulation = createForceSimulation(nodesList, links, width, height);

  graphState.simulation = simulation;
  simRef.current = simulation;

  linkRef.current = createLinkSelection(linkWrapper, links);

  const node = appendNodeGroups(nodesList);
  graphState.nodes = nodesList;
  graphState.nodeSelection = node;

  // Same decoration the focused path uses: circle, label, hover/click. The
  // guarded link handlers are a superset of this path's former inline copies —
  // linkRef.current was already set above, so the guard always passes here.
  decorateNodes(node);

  // Paint the nodes at their initial positions NOW rather than leaving them
  // unpositioned until the first tick. The tick handler writes this same
  // attribute; without it every node renders at the origin (top-left) for one
  // frame, which is most visible on a focused node the camera is already
  // centred on.
  node.attr('transform', (d) => `translate(${d.x},${d.y})`);

  wireSimulationHandlers(simulation, {
    getNodes: () => graphState.nodeSelection,
    getLinks: () => linkRef.current,
    ...focusSimulationHooks(),
  });

  return false;
}

/**
 * Switch the graph's link scoring mode ('tf' | 'tfidf') and re-render. Panel checkbox.
 */
export function setLinkageWeighting(mode) {
  // Remember the focused bookmark before resetFocus() clears it, so the
  // re-render can re-pin the same node at canvas centre and re-place the
  // camera on it — toggling TF ⇄ TF-IDF must not lose the focus.
  const focusId = graphState.focusedNodeId;
  graphState.weighting = mode;
  renderConceptLinkageGraph(focusId);
}

/**
 * Zoom the graph by a multiplicative factor (toolbar buttons).
 */
export function zoomGraphBy(factor) {
  const { svg, zoom } = graphState;
  if (svg && zoom) svg.transition().call(zoom.scaleBy, factor);
}

/**
 * Reset the graph view to the identity transform and re-render (monolith parity).
 */
export function resetGraphZoom() {
  const { svg, zoom } = graphState;
  if (svg && zoom) svg.transition().call(zoom.transform, d3.zoomIdentity);
  resetFocus();
  renderConceptLinkageGraph();
}

/**
 * Highlight and center a rendered node by bookmark id. Returns false — and
 * drops any stale highlight — when the id has no node in the current graph
 * (e.g. it fell outside the top-50 cap or was filtered out).
 *
 * Pins the node IN PLACE (fx/fy = current x/y), establishing the same
 * invariant a focused render does: a still-running simulation cannot move the
 * highlighted node and invalidate the camera aimed at it. The previous focus,
 * if any, is unpinned first so pins never accumulate. Dragging the node (which
 * nulls fx/fy on release) or re-rendering releases the pin.
 *
 * @param {string} id
 * @returns {boolean} whether a node was found and focused
 */
export function focusLinkageNode(id) {
  const node = graphState.nodes ? graphState.nodes.find((d) => d.id === id) : null;
  if (!node) {
    clearFocusStyles();
    resetFocus();
    return false;
  }
  // Free the old focus before arming the new one (same-node refocus is a
  // cheap re-pin at the same coordinates).
  if (graphState.focusedNodeId != null && graphState.focusedNodeId !== id) {
    unpinNode(graphState.nodes.find((d) => d.id === graphState.focusedNodeId));
  }
  pinNodeAt(node, node.x, node.y);
  graphState.focusedNodeId = id;
  applyFocusStyles();
  graphState.pendingFocusCenter = true;
  // A settled simulation will not tick again, so center immediately in that
  // case; otherwise the tick handler centers on the first repositioned frame.
  const simulation = graphState.simulation;
  if (!simulation || simulation.alpha() <= simulation.alphaMin()) {
    centerFocusedNode();
  }
  return true;
}

/**
 * Switch to the linkage tab, render the graph, and focus the given bookmark's
 * node. The single entry point the bookmark-card and reader-modal buttons use.
 *
 * The node is pinned and the camera centred inside the render call, so the
 * graph's FIRST paint already shows the bookmark highlighted and centred — no
 * waiting for the force simulation to start moving, and no zoom transition.
 *
 * @param {string} id
 * @returns {boolean} whether a node was found and focused
 */
export function openLinkageForBookmark(id) {
  activateTab('linkage');
  const focused = renderConceptLinkageGraph(id);
  if (!focused) {
    showToast('該書籤不在目前的關聯圖中（超出前 50 筆或已被篩除）');
  }
  return focused;
}
