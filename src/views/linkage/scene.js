/**
 * @fileoverview SVG scene construction and per-node DOM mechanics.
 *
 * Owns the parts of a render that are about *where things go on screen*
 * rather than *what the graph is*: the zoomable `<svg>` scaffold, the
 * per-node `<g>` layer factory (drag + circle + label + hover), the tooltip
 * element lookup, and the frame deferral that schedules Frame B after paint.
 * The graph's data shaping is in ./topology.js, the forces in
 * ./simulation.js, and the camera in ./focus.js.
 *
 * Kept separate from ./nodes.js on purpose: nodes.js holds the pure sizing
 * rules whose unit tests need no DOM; this module is DOM/d3-heavy.
 */

import * as d3 from 'd3';
import { openReaderModal } from '../readerModal.js';
import { linkageTooltipTagsHtml } from '../../components/linkage/graph.js';
import { graphState } from './state.js';
import { nodeLabelOffsetX, nodeRadius, truncateNodeLabel } from './nodes.js';
import { linkStrokeWidth } from './simulation.js';

/**
 * Run `fn` after the browser has had a chance to paint.
 *
 * Frame A of a focused render must be on screen before Frame B's topology pass
 * blocks the main thread, so this is `requestAnimationFrame` followed by a
 * macrotask (a rAF callback runs *before* paint, so deferring inside it is what
 * actually yields). Falls back to a plain macrotask where rAF is unavailable
 * (jsdom without `pretendToBeVisual`), which still lets the microtask queue
 * drain — enough for the tests, which never assert on paint.
 *
 * @param {() => void} fn
 */
export function afterPaint(fn) {
  if (typeof window === 'object' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => setTimeout(fn, 0));
  } else {
    setTimeout(fn, 0);
  }
}

/**
 * Look up the tooltip elements the hover handlers write into.
 *
 * @returns {{ tooltip: HTMLElement|null, ttTitle: HTMLElement|null,
 *   ttDomain: HTMLElement|null, ttTags: HTMLElement|null }}
 */
export function gatherTooltipRefs() {
  return {
    tooltip: document.getElementById('graphTooltip'),
    ttTitle: document.getElementById('ttTitle'),
    ttDomain: document.getElementById('ttDomain'),
    ttTags: document.getElementById('ttTags'),
  };
}

/**
 * Create the zoomable `<svg>` scene for one render and store it on graphState
 * (the toolbar zoom helpers and the focus camera both read it from there).
 *
 * The zoomable `<g>` is the single transform root: the zoom behaviour rewrites
 * its `transform`, and everything drawn — links, nodes — lives underneath.
 *
 * @param {number} width
 * @param {number} height
 * @returns {{ svg: import('d3').Selection, g: import('d3').Selection,
 *   zoom: import('d3').ZoomBehavior, nodeWrapper: import('d3').Selection }}
 */
export function createScene(width, height) {
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

  graphState.svg = svg;
  graphState.zoom = zoom;

  /**
   * The single node wrapper for this render, created once. Frame B appends its
   * nodes into this same wrapper, so every node stays under one element and the
   * emphasis/tick handlers can reach all of them with one selection.
   */
  const nodeWrapper = g.append('g').attr('class', 'nodes');

  return { svg, g, zoom, nodeWrapper };
}

/**
 * Build the node layer for one render: append a drag-enabled `<g>` per node
 * and decorate them with circle, label and interactions.
 *
 * `linkRef` and `simRef` are mutable holders shared with the orchestrator:
 * Frame A's handlers must reach the link selection and the simulation, which
 * only exist once Frame B has built them.
 *
 * @param {{
 *   nodeWrapper: import('d3').Selection,
 *   colorScale: any,
 *   linkRef: { current: any },
 *   simRef: { current: any },
 *   tooltipRefs: { tooltip: any, ttTitle: any, ttDomain: any, ttTags: any },
 * }} deps
 * @returns {{ appendNodeGroups: (data: object[]) => any,
 *   decorateNodes: (node: any) => void }}
 */
export function createNodeLayer({ nodeWrapper, colorScale, linkRef, simRef, tooltipRefs }) {
  const { tooltip, ttTitle, ttDomain, ttTags } = tooltipRefs;

  function dragstarted(event, d) {
    // d3-drag reports `active` as the gesture count BEFORE incrementing, so it
    // is 0 on the first drag's start — the moment to re-heat the simulation.
    // (fa6439a bailed whenever `event.active` was 0, i.e. always, so a settled
    // simulation was never reheated and dragged nodes froze.)
    // The reheat needs a simulation: Frame A of a focused render has none yet,
    // so skip only that part — the pin is still seeded, and Frame B's new
    // simulation starts hot (alpha 1), which keeps a drag in flight moving.
    if (simRef.current && !event.active) simRef.current.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active && simRef.current) simRef.current.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  /** Append one drag-enabled `<g>` per node, returning the enter selection. */
  const appendNodeGroups = (data) =>
    nodeWrapper
      .selectAll('g')
      .data(data, (d) => d.id)
      .enter()
      .append('g')
      .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));

  /** Append the circle, label and interactions for a node selection. */
  const decorateNodes = (node) => {
    node
      .append('circle')
      .attr('r', (d) => nodeRadius(d.degree))
      .attr('fill', (d) => colorScale(d.domain))
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2)
      .attr('class', 'cursor-pointer transition-all duration-200');

    node
      .append('text')
      .text((d) => truncateNodeLabel(d.title))
      .attr('x', (d) => nodeLabelOffsetX(d.degree))
      .attr('y', 4)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('pointer-events', 'none');

    node
      .on('mouseover', (event, d) => {
        tooltip.style.opacity = '1';
        ttTitle.innerText = d.title;
        ttDomain.innerText = d.domain;
        ttTags.innerHTML = linkageTooltipTagsHtml(d.tags);
        if (!linkRef.current) return; // Frame A: no links drawn yet
        linkRef.current
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
        if (!linkRef.current) return;
        linkRef.current
          .style('stroke', '#334155')
          .style('stroke-opacity', 0.6)
          .style('stroke-width', (l) => linkStrokeWidth(l.weight));
      })
      .on('click', (event, d) => {
        openReaderModal(d.id);
      });
  };

  return { appendNodeGroups, decorateNodes };
}
