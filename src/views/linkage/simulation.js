/**
 * @fileoverview Force-simulation and link rendering for the concept-linkage graph.
 *
 * Both render paths in ../views/linkage.js build exactly the same simulation
 * and the same `<line>` elements, so the configuration lives here once rather
 * than twice. The node decoration rules are in ./nodes.js; the data shaping
 * each path does before calling in is in ./topology.js.
 */

import * as d3 from 'd3';
import { nodeRadius } from './nodes.js';

/** Link stroke colour in the resting state. */
const LINK_REST_STROKE = '#334155';
/** Link stroke opacity in the resting state. */
const LINK_REST_STROKE_OPACITY = 0.6;
/** Fixed link spring length. */
const LINK_DISTANCE = 120;
/** Repulsive charge strength. */
const CHARGE_STRENGTH = -300;
/** Radius added to a node's degree-derived value for forceCollide. */
const COLLIDE_BASE = 12;
/** Scale applied to degree for forceCollide. */
const COLLIDE_PER_DEGREE = 6;

/**
 * Clamp a link's weight into the rendered stroke-width range `[1, 4]`.
 *
 * NOTE: the link records carry `value`, not `weight`, so every call site
 * currently passes undefined and this yields NaN — SVG ignores an unparseable
 * stroke-width and falls back to its default of 1, which is why the omission
 * has gone unnoticed. The formula is preserved verbatim rather than corrected
 * here, because correcting it changes rendered line weights; see the follow-up
 * note in the decomposition report.
 *
 * @param {number} weight
 * @returns {number}
 */
export function linkStrokeWidth(weight) {
  return Math.min(4, Math.max(1, weight));
}

/**
 * Build the graph's force simulation: a fixed-distance link spring, a
 * repelling charge, a centring force, and a degree-based collision radius.
 *
 * @param {object[]} nodes
 * @param {{ source: string|object, target: string|object, value: number }[]} links
 * @param {number} width
 * @param {number} height
 * @returns {d3.Simulation}
 */
export function createForceSimulation(nodes, links, width, height) {
  return d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(LINK_DISTANCE),
    )
    .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'collide',
      d3.forceCollide().radius((d) => Math.max(COLLIDE_BASE, COLLIDE_PER_DEGREE + d.degree * 2)),
    );
}

/**
 * Append one `<line>` per link into a new `<g>` under `parent` (the scene's
 * pre-ordered link layer, which sits UNDER the node layer so circles cover
 * link strokes), in the resting style the hover handlers dim and re-emphasise
 * from.
 *
 * @param {d3.Selection} parent The zoomable `<g>`.
 * @param {{ source: string|object, target: string|object, value: number }[]} links
 * @returns {d3.Selection} the line selection
 */
export function createLinkSelection(parent, links) {
  return parent
    .append('g')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', LINK_REST_STROKE)
    .attr('stroke-opacity', LINK_REST_STROKE_OPACITY)
    .attr('stroke-width', (d) => linkStrokeWidth(d.weight));
}

/**
 * Refresh a node selection's circle radii after their degrees changed.
 *
 * A focused render paints the target before the link pass has run, so its
 * degree is still 0 and its circle still the placeholder radius; the real
 * degree only becomes knowable once the link pass completes.
 *
 * @param {d3.Selection} nodeSelection
 * @returns {d3.Selection} the circle selection
 */
export function refreshNodeRadii(nodeSelection) {
  return nodeSelection.select('circle').attr('r', (d) => nodeRadius(d.degree));
}

/**
 * Register the tick and end handlers that are identical for both render paths.
 *
 * The tick handler repositions every link and node; the end handler re-centres
 * the focused node once the layout has settled. They are NOT interchangeable:
 * only the end handler arms the re-centre (`pendingFocusCenter`), because
 * arming it on every tick would re-centre mid-animation.
 *
 * `getNodes` and `getLinks` are read lazily on every tick because a deferred
 * (Frame B) build wires these handlers before the selections they must move
 * exist. `onTick` and `onSettled` are the caller's focus-camera hooks, passed
 * verbatim.
 *
 * @param {d3.Simulation} simulation
 * @param {{
 *   getNodes: () => d3.Selection|null,
 *   getLinks: () => d3.Selection|null,
 *   onTick: () => void,
 *   onSettled: () => void,
 * }} hooks
 */
export function wireSimulationHandlers(simulation, { getNodes, getLinks, onTick, onSettled }) {
  simulation.on('tick', () => {
    const links = getLinks();
    if (links) {
      links
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
    }

    const nodes = getNodes();
    if (nodes) nodes.attr('transform', (d) => `translate(${d.x},${d.y})`);

    onTick();
  });

  simulation.on('end', () => {
    onSettled();
  });
}
