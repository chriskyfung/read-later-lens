/**
 * @fileoverview Encapsulated linkage graph view — owns its state and lifecycle.
 *
 * The `LinkageGraph` class is the single owner of the graph's mutable state
 * (D3 selections, simulation, focus, camera, generation, topology timer).
 * Instead of every behavior module reaching into a module-global `graphState`,
 * each instance holds its own `#state`, and helpers receive it explicitly.
 *
 * This makes the view composable, re-entrancy-safe, and disposable: call
 * `dispose()` when leaving the linkage tab to stop the simulation and clear
 * pending deferred work.
 *
 * External consumers should import the default instance from the barrel
 * (`./linkage`) rather than constructing their own, unless they need an
 * isolated graph (e.g. tests).
 */

import * as d3 from 'd3';
import { getFilteredBookmarksTop } from '@/core/filters.js';
import { buildLinkageGraph, buildGraphNodes } from '@/analytics';
import { linkageEmptyStateHtml } from '../components';
import { activateTab } from '@/behavior/tabs.js';
import { showToast } from '@/utils/dom';
import {
  createForceSimulation,
  createLinkSelection,
  refreshNodeRadii,
  wireSimulationHandlers,
} from './simulation.js';
import { prepareFocusedTopology, resolveFocusTarget, unpinNode, pinNodeAt } from './topology.js';
import {
  createGraphState,
  cancelPendingTopology,
  clearRenderState,
  isCurrentGeneration,
  nextRenderGeneration,
  resolveCanvasSize,
} from './state.js';
import {
  applyFocusStyles,
  centerFocusedNode,
  clearFocusStyles,
  focusSimulationHooks,
  resetFocus,
  setFocusCamera,
} from './focus.js';
import { afterPaint, createNodeLayer, createScene, gatherTooltipRefs } from './scene.js';

/** Cap for the graph (top 50 filtered bookmarks), mirrored from analytics. */
export const LINKAGE_LIMIT = 50;

/**
 * The concept-linkage graph view. Owns its mutable state; all helpers receive
 * that state explicitly so no module-global singleton is required.
 */
export class LinkageGraph {
  #state = createGraphState();

  /** Read-only view of the internal state (tests and debugging). */
  get state() {
    return this.#state;
  }

  /** The currently focused bookmark id, or null. */
  get focusedNodeId() {
    return this.#state.focusedNodeId;
  }

  /** The current node records, or null. */
  get nodes() {
    return this.#state.nodes;
  }

  /** The running D3 simulation, or null. */
  get simulation() {
    return this.#state.simulation;
  }

  /** Current link scoring mode ('tf' | 'tfidf'). */
  get weighting() {
    return this.#state.weighting;
  }

  /**
   * Stop the simulation, cancel any deferred topology work, and drop all D3
   * references. Call when the linkage tab is unmounted or the graph is torn
   * down, so no stray timers or selections outlive the view.
   */
  dispose() {
    if (this.#state.simulation) {
      this.#state.simulation.stop();
    }
    cancelPendingTopology(this.#state);
    clearRenderState(this.#state);
    this.#state.focusedNodeId = null;
    this.#state.pendingFocusCenter = false;
  }

  /**
   * Render the concept-linkage graph tab.
   *
   * @param {string|null} [focusId] Bookmark id to pin and centre on. When
   *   given, the node is positioned at the canvas centre BEFORE the force
   *   simulation is built (via `fx`/`fy`), so the camera can be placed on it
   *   in this same call with no transition and no wait for the first tick.
   *   Omit it for a plain, unfocused render.
   * @returns {boolean} Whether the graph rendered (false when there is no
   *   container, or when nothing matches the active filters).
   */
  render(focusId = null) {
    if (this.#state.simulation) this.#state.simulation.stop();

    const previousFocusId = this.#state.focusedNodeId;
    const positionSnapshot = this.#state.nodes
      ? new Map(this.#state.nodes.map((d) => [d.id, { x: d.x, y: d.y }]))
      : null;
    let cameraTransform = null;
    if (this.#state.svg && this.#state.zoom) {
      const node = this.#state.svg.node();
      cameraTransform = Object.prototype.hasOwnProperty.call(node, '__zoom')
        ? d3.zoomTransform(node)
        : null;
    }

    clearRenderState(this.#state);
    resetFocus(this.#state);
    cancelPendingTopology(this.#state);
    const generation = nextRenderGeneration(this.#state);

    const container = document.getElementById('d3GraphCanvas');
    if (!container) return false;
    container.innerHTML = '';

    const tooltipRefs = gatherTooltipRefs();

    const filtered = getFilteredBookmarksTop(LINKAGE_LIMIT);
    if (filtered.length === 0) {
      container.innerHTML = linkageEmptyStateHtml();
      return false;
    }

    const { width, height } = resolveCanvasSize(container);
    this.#state.width = width;
    this.#state.height = height;

    let { nodes: nodesList, domains } = buildGraphNodes(filtered);

    let effectiveFocusId = focusId;
    if (effectiveFocusId == null && previousFocusId != null) {
      effectiveFocusId = nodesList.some((n) => n.id === previousFocusId) ? previousFocusId : null;
    }

    let focusNode = null;
    if (effectiveFocusId != null) {
      focusNode = resolveFocusTarget(nodesList, effectiveFocusId, width, height);
      if (focusNode) this.#state.focusedNodeId = focusNode.id;
    }

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(domains);

    const linkRef = { current: null };
    const simRef = { current: null };

    const { linkWrapper, nodeWrapper } = createScene(width, height, this.#state);

    if (cameraTransform) {
      this.#state.svg.call(this.#state.zoom.transform, cameraTransform);
    }

    const { appendNodeGroups, decorateNodes } = createNodeLayer({
      nodeWrapper,
      colorScale,
      linkRef,
      simRef,
      tooltipRefs,
    });

    // ---- Frame B: the expensive half, deferred until after the first paint --
    const buildRestOfGraph = () => {
      const { nodes: freshNodes, links } = buildLinkageGraph(filtered, {
        weighting: this.#state.weighting,
      });

      prepareFocusedTopology(freshNodes, focusNode, width, height);

      const simulation = createForceSimulation(freshNodes, links, width, height);

      if (positionSnapshot) {
        freshNodes.forEach((d) => {
          if (d === focusNode) return;
          const saved = positionSnapshot.get(d.id);
          if (saved) {
            d.x = saved.x;
            d.y = saved.y;
          }
        });
      }

      this.#state.simulation = simulation;
      simRef.current = simulation;

      linkRef.current = createLinkSelection(linkWrapper, links);

      const rest = appendNodeGroups(freshNodes.filter((n) => n !== focusNode));
      decorateNodes(rest);
      rest.attr('transform', (d) => `translate(${d.x},${d.y})`);

      this.#state.nodes = freshNodes;
      this.#state.nodeSelection = nodeWrapper.selectAll('g');
      applyFocusStyles(this.#state);
      refreshNodeRadii(this.#state.nodeSelection);

      wireSimulationHandlers(simulation, {
        getNodes: () => this.#state.nodeSelection,
        getLinks: () => linkRef.current,
        ...focusSimulationHooks(!!cameraTransform, this.#state),
      });
    };

    // ---- Frame A: the focused bookmark, in this very call -------------------
    if (focusNode) {
      const node = appendNodeGroups([focusNode]);
      this.#state.nodes = nodesList;
      this.#state.nodeSelection = node;
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
      decorateNodes(node);
      if (cameraTransform) {
        const k = cameraTransform.k;
        const dx = width / 2 - focusNode.x * k;
        const dy = height / 2 - focusNode.y * k;
        this.#state.svg.call(
          this.#state.zoom.transform,
          d3.zoomIdentity.translate(dx, dy).scale(k),
        );
      } else {
        setFocusCamera(this.#state);
      }
      applyFocusStyles(this.#state);

      this.#state.pendingTopologyTimer = afterPaint(() => {
        if (!isCurrentGeneration(generation, this.#state)) return;
        this.#state.pendingTopologyTimer = null;
        buildRestOfGraph();
      });

      return true;
    }

    // ---- Unfocused render: one pass, as before ------------------------------
    const built = buildLinkageGraph(filtered, { weighting: this.#state.weighting });
    nodesList = built.nodes;
    const links = built.links;
    domains = built.domains;
    colorScale.domain(domains);

    const simulation = createForceSimulation(nodesList, links, width, height);

    if (positionSnapshot) {
      nodesList.forEach((d) => {
        const saved = positionSnapshot.get(d.id);
        if (saved) {
          d.x = saved.x;
          d.y = saved.y;
        }
      });
    }

    this.#state.simulation = simulation;
    simRef.current = simulation;

    linkRef.current = createLinkSelection(linkWrapper, links);

    const node = appendNodeGroups(nodesList);
    this.#state.nodes = nodesList;
    this.#state.nodeSelection = node;

    decorateNodes(node);

    node.attr('transform', (d) => `translate(${d.x},${d.y})`);

    wireSimulationHandlers(simulation, {
      getNodes: () => this.#state.nodeSelection,
      getLinks: () => linkRef.current,
      ...focusSimulationHooks(),
    });

    return false;
  }

  /**
   * Switch the graph's link scoring mode ('tf' | 'tfidf') and re-render.
   * Panel checkbox. Preserves the focused bookmark across the toggle.
   */
  setWeighting(mode) {
    const focusId = this.#state.focusedNodeId;
    this.#state.weighting = mode;
    this.render(focusId);
  }

  /**
   * Zoom the graph by a multiplicative factor (toolbar buttons).
   */
  zoomBy(factor) {
    const { svg, zoom } = this.#state;
    if (svg && zoom) svg.transition().call(zoom.scaleBy, factor);
  }

  /**
   * Reset the graph view to the identity transform and re-render.
   */
  resetZoom() {
    clearRenderState(this.#state);
    resetFocus(this.#state);
    this.render();
    const { svg, zoom } = this.#state;
    if (svg && zoom) svg.call(zoom.transform, d3.zoomIdentity);
  }

  /**
   * Highlight and center a rendered node by bookmark id. Returns false — and
   * drops any stale highlight — when the id has no node in the current graph.
   *
   * Pins the node IN PLACE (fx/fy = current x/y).
   *
   * @param {string} id
   * @returns {boolean} whether a node was found and focused
   */
  focusNode(id) {
    const node = this.#state.nodes ? this.#state.nodes.find((d) => d.id === id) : null;
    if (!node) {
      clearFocusStyles(this.#state);
      resetFocus(this.#state);
      return false;
    }
    if (this.#state.focusedNodeId != null && this.#state.focusedNodeId !== id) {
      unpinNode(this.#state.nodes.find((d) => d.id === this.#state.focusedNodeId));
    }
    pinNodeAt(node, node.x, node.y);
    this.#state.focusedNodeId = id;
    applyFocusStyles(this.#state);
    this.#state.pendingFocusCenter = true;
    const simulation = this.#state.simulation;
    if (!simulation || simulation.alpha() <= simulation.alphaMin()) {
      centerFocusedNode(this.#state);
    }
    return true;
  }

  /**
   * Re-measure the canvas container and update the SVG `viewBox` plus the
   * state dimensions. Call when the container's size changes — for example
   * when the linkage tab becomes visible, or the window is resized — so the
   * force layout's centre and the SVG coordinate system stay correct.
   *
   * If a simulation is running, its centring force is re-targeted to the new
   * centre and the simulation is reheated so nodes settle into the new bounds.
   */
  resize() {
    const container = document.getElementById('d3GraphCanvas');
    if (!container) return;
    const { width, height } = resolveCanvasSize(container);
    this.#state.width = width;
    this.#state.height = height;
    const { svg } = this.#state;
    if (svg) {
      svg.attr('viewBox', `0 0 ${width} ${height}`);
    }
    const { simulation } = this.#state;
    if (simulation) {
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
      simulation.alpha(0.3).restart();
    }
  }
}

/** Default app-wide instance. External consumers import this from the barrel. */
export const linkageGraph = new LinkageGraph();

/**
 * Switch to the linkage tab, render the graph, and focus the given bookmark's
 * node. The single entry point the bookmark-card and reader-modal buttons use.
 * @param {string} id
 * @returns {boolean} whether a node was found and focused
 */
export function openLinkageForBookmark(id) {
  activateTab('linkage');
  const container = document.getElementById('d3GraphCanvas');
  // The linkage panel (and its canvas) is always mounted together with the
  // other panels; if it is absent, the real problem is a missing panel, not a
  // missing bookmark — say so instead of blaming the bookmark.
  if (!container) {
    showToast('關聯圖面板未載入，請先切換至關聯圖標籤頁');
    return false;
  }
  const focused = linkageGraph.render(id);
  if (!focused) {
    showToast('該書籤不在目前的關聯圖中（超出前 50 筆或已被篩除）');
  }
  return focused;
}

/**
 * Re-measure the linkage canvas and update the SVG viewBox / state dimensions.
 * Delegates to the default instance's resize().
 */
export function resize() {
  linkageGraph.resize();
}

/** Re-export FOCUS_ZOOM for callers that imported it from ./linkage/focus.js. */
export { FOCUS_ZOOM } from './focus.js';
