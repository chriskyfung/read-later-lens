/**
 * @fileoverview D3 concept-linkage graph view.
 *
 * NOTE: ported from the monolith with one deliberate deviation: the monolith
 * refused to render with fewer than 2 bookmarks (`filtered.length < 2`); a lone
 * bookmark now renders its single node. The rest of the port is otherwise
 * verbatim.
 *
 * domain-based colour scale, degree-based sizing, drag + zoom, the hover
 * tooltip (`#graphTooltip` / `#ttTitle` / `#ttDomain` / `#ttTags`), and node
 * click → reader modal. Zoom/pan state is module-private here and driven by
 * the toolbar buttons through `zoomGraphBy` / `resetGraphZoom`.
 *
 * One deliberate improvement over the monolith: the previous force simulation
 * is stopped before a re-render (the monolith leaked it).
 *
 * The string-built markup (the empty-state div and the tooltip tag pills) has
 * been moved to src/components/linkage/graph.js to keep components pure; this
 * file now handles only D3 rendering, DOM creation, and delegates those two
 * snippets via helpers from ../components/linkage/graph.js.
 */

import * as d3 from 'd3';
import { getFilteredBookmarksTop } from '../core/filters.js';
import { buildLinkageGraph } from '../analytics/linkage.js';
import { openReaderModal } from './readerModal.js';
import { linkageEmptyStateHtml, linkageTooltipTagsHtml } from '../components/linkage/graph.js';
import { activateTab } from './tabs.js';
import { showToast } from '../utils/dom.js';

let currentSvg = null;
let currentZoom = null;
let currentSimulation = null;
let currentNodes = null;
let currentNodeSelection = null;
let currentWidth = 0;
let currentHeight = 0;
let focusedNodeId = null;
let pendingFocusCenter = false;

/**
 * Render the concept-linkage graph tab.
 */
export function renderConceptLinkageGraph() {
  if (currentSimulation) currentSimulation.stop();
  // Clear render + focus state first, so an early return (no container, or an
  // empty library) cannot leave stale references for the focus API below.
  currentSimulation = null;
  currentSvg = null;
  currentZoom = null;
  currentNodes = null;
  currentNodeSelection = null;
  resetFocus();

  const container = document.getElementById('d3GraphCanvas');
  if (!container) return;
  container.innerHTML = '';

  const tooltip = document.getElementById('graphTooltip');
  const ttTitle = document.getElementById('ttTitle');
  const ttDomain = document.getElementById('ttDomain');
  const ttTags = document.getElementById('ttTags');

  const filtered = getFilteredBookmarksTop(50); // Limit to top 50 for graph clarity
  if (filtered.length === 0) {
    container.innerHTML = linkageEmptyStateHtml();
    return;
  }

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;
  currentWidth = width;
  currentHeight = height;

  const { nodes: nodesList, links, domains } = buildLinkageGraph(filtered);

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(domains);

  const svg = d3
    .select('#d3GraphCanvas')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`);

  const g = svg.append('g');

  const zoom = d3
    .zoom()
    .scaleExtent([0.2, 5])
    .on('zoom', (event) => g.attr('transform', event.transform));

  svg.call(zoom);

  currentSvg = svg;
  currentZoom = zoom;

  const simulation = d3
    .forceSimulation(nodesList)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(120),
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'collide',
      d3.forceCollide().radius((d) => Math.max(12, 6 + d.degree * 2)),
    );

  currentSimulation = simulation;

  const link = g
    .append('g')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', '#334155')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', (d) => Math.min(4, Math.max(1, d.weight)));

  const node = g
    .append('g')
    .selectAll('g')
    .data(nodesList)
    .enter()
    .append('g')
    .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));

  currentNodes = nodesList;
  currentNodeSelection = node;

  // Append Circles
  node
    .append('circle')
    .attr('r', (d) => Math.max(8, 4 + Math.sqrt(d.degree) * 4))
    .attr('fill', (d) => colorScale(d.domain))
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 2)
    .attr('class', 'cursor-pointer transition-all duration-200');

  // Node emphasis (focused ring / dimmed others) is applied by focusLinkageNode,
  // not here: a fresh render starts with no highlight.

  // Append Labels
  node
    .append('text')
    .text((d) => d.title.substring(0, 10) + (d.title.length > 10 ? '...' : ''))
    .attr('x', (d) => Math.max(10, 6 + Math.sqrt(d.degree) * 4))
    .attr('y', 4)
    .attr('fill', '#94a3b8')
    .attr('font-size', '10px')
    .attr('pointer-events', 'none');

  // Interactions (Hover & Tooltip)
  node
    .on('mouseover', (event, d) => {
      tooltip.style.opacity = '1';
      ttTitle.innerText = d.title;
      ttDomain.innerText = d.domain;
      ttTags.innerHTML = linkageTooltipTagsHtml(d.tags);

      link
        .style('stroke', (l) =>
          l.source.id === d.id || l.target.id === d.id ? '#6366f1' : '#334155',
        )
        .style('stroke-opacity', (l) => (l.source.id === d.id || l.target.id === d.id ? 1 : 0.2))
        .style('stroke-width', (l) => (l.source.id === d.id || l.target.id === d.id ? 3 : 1));
    })
    .on('mousemove', (event) => {
      tooltip.style.left = `${event.clientX}px`;
      tooltip.style.top = `${event.clientY - 15}px`;
    })
    .on('mouseout', () => {
      tooltip.style.opacity = '0';
      link
        .style('stroke', '#334155')
        .style('stroke-opacity', 0.6)
        .style('stroke-width', (d) => Math.min(4, Math.max(1, d.weight)));
    })
    .on('click', (event, d) => {
      openReaderModal(d.id);
    });

  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    node.attr('transform', (d) => `translate(${d.x},${d.y})`);

    centerFocusedNode();
  });

  simulation.on('end', () => {
    if (focusedNodeId != null) {
      // The first-tick centering used early coordinates; re-center once on the
      // final layout so the focused node is truly centered after settling.
      pendingFocusCenter = true;
      centerFocusedNode();
    }
  });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

/**
 * Apply the current node emphasis to the rendered selection: the focused
 * bookmark's circle gains an indigo ring (stroke-width 4) and every other node
 * dims to 40% opacity. No-op when nothing is focused.
 */
function applyFocusStyles() {
  if (currentNodeSelection == null || focusedNodeId == null) return;
  currentNodeSelection.attr('opacity', (d) => (d.id === focusedNodeId ? 1 : 0.4));
  currentNodeSelection
    .select('circle')
    .attr('stroke', (d) => (d.id === focusedNodeId ? '#6366f1' : '#0f172a'))
    .attr('stroke-width', (d) => (d.id === focusedNodeId ? 4 : 2));
}

/** Remove any emphasis, restoring every node to its default appearance. */
function clearFocusStyles() {
  if (currentNodeSelection == null) return;
  currentNodeSelection.attr('opacity', 1);
  currentNodeSelection.select('circle').attr('stroke', '#0f172a').attr('stroke-width', 2);
}

/**
 * Center the viewport on the focused bookmark (animated, zoom k=1.6) so the
 * user always sees exactly which node is highlighted. Idempotent — repeated
 * calls mid-animation are ignored; the centering is re-applied when the
 * simulation settles (the 'end' event).
 */
function centerFocusedNode() {
  if (focusedNodeId == null || pendingFocusCenter === false) return;
  const node = currentNodes ? currentNodes.find((d) => d.id === focusedNodeId) : null;
  if (!node || !currentSvg || !currentZoom) {
    pendingFocusCenter = false;
    return;
  }
  const dx = currentWidth / 2 - node.x * 1.6;
  const dy = currentHeight / 2 - node.y * 1.6;
  currentSvg
    .transition()
    .duration(450)
    .call(currentZoom.transform, d3.zoomIdentity.translate(dx, dy).scale(1.6));
  pendingFocusCenter = false;
}

/**
 * Clear the node emphasis (graph re-rendered or view reset), restoring the
 * default view with no highlighted bookmark.
 */
function resetFocus() {
  clearFocusStyles();
  focusedNodeId = null;
  pendingFocusCenter = false;
}

/**
 * Zoom the graph by a multiplicative factor (toolbar buttons).
 *
 * @param {number} factor
 */
export function zoomGraphBy(factor) {
  if (currentSvg && currentZoom) currentSvg.transition().call(currentZoom.scaleBy, factor);
}

/**
 * Reset the graph view to the identity transform and re-render (monolith parity).
 */
export function resetGraphZoom() {
  if (currentSvg && currentZoom)
    currentSvg.transition().call(currentZoom.transform, d3.zoomIdentity);
  resetFocus();
  renderConceptLinkageGraph();
}

/**
 * Highlight and center a rendered node by bookmark id. Returns false — and
 * drops any stale highlight — when the id has no node in the current graph
 * (e.g. it fell outside the top-50 cap or was filtered out).
 *
 * @param {string} id
 * @returns {boolean} whether a node was found and focused
 */
export function focusLinkageNode(id) {
  const node = currentNodes ? currentNodes.find((d) => d.id === id) : null;
  if (!node) {
    clearFocusStyles();
    resetFocus();
    return false;
  }
  focusedNodeId = id;
  applyFocusStyles();
  pendingFocusCenter = true;
  // A settled simulation will not tick again, so center immediately in that
  // case; otherwise the tick handler centers on the first repositioned frame.
  if (!currentSimulation || currentSimulation.alpha() <= currentSimulation.alphaMin()) {
    centerFocusedNode();
  }
  return true;
}

/**
 * Switch to the linkage tab, render the graph, and focus the given bookmark's
 * node. The single entry point the bookmark-card and reader-modal buttons use.
 * Toasts when the bookmark is not among the rendered nodes.
 *
 * @param {string} id
 * @returns {boolean} whether a node was found and focused
 */
export function openLinkageForBookmark(id) {
  activateTab('linkage');
  renderConceptLinkageGraph();
  const focused = focusLinkageNode(id);
  if (!focused) {
    showToast('該書籤不在目前的關聯圖中（超出前 50 筆或已被篩除）');
  }
  return focused;
}
