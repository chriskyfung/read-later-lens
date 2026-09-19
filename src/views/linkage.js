/**
 * @fileoverview D3 concept-linkage graph view.
 *
 * Ports the monolith's `renderConceptLinkageGraph` verbatim: container
 * `#d3GraphCanvas`, top-50 nodes, cosine-similarity links above 0.15,
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
import {
  linkageEmptyStateHtml,
  linkageTooltipTagsHtml,
} from '../components/linkage/graph.js';

let currentSvg = null;
let currentZoom = null;
let currentSimulation = null;

/**
 * Render the concept-linkage graph tab.
 */
export function renderConceptLinkageGraph() {
  const container = document.getElementById('d3GraphCanvas');
  if (!container) return;
  container.innerHTML = '';
  if (currentSimulation) currentSimulation.stop();

  const tooltip = document.getElementById('graphTooltip');
  const ttTitle = document.getElementById('ttTitle');
  const ttDomain = document.getElementById('ttDomain');
  const ttTags = document.getElementById('ttTags');

  const filtered = getFilteredBookmarksTop(50); // Limit to top 50 for graph clarity
  if (filtered.length < 2) {
    container.innerHTML = linkageEmptyStateHtml();
    return;
  }

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

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

  // Append Circles
  node
    .append('circle')
    .attr('r', (d) => Math.max(8, 4 + Math.sqrt(d.degree) * 4))
    .attr('fill', (d) => colorScale(d.domain))
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 2)
    .attr('class', 'cursor-pointer transition-all duration-200');

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
  renderConceptLinkageGraph();
}
