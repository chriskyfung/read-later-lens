/**
 * @fileoverview Node sizing rules for the concept-linkage graph.
 *
 * The degree-based radius, label offset and label truncation that the D3 node
 * decoration applies. Kept as pure functions — and away from the d3 selection
 * wiring in ../views/linkage.js — so the geometry rules are testable without a
 * canvas.
 */

/** Radius floor, so a degree-0 node is still a visible circle. */
export const NODE_RADIUS_MIN = 8;

/** Label x-offset floor, keeping the text clear of the circle's left edge. */
export const NODE_LABEL_OFFSET_MIN = 10;

/** Characters of a title shown on the node before it is ellipsised. */
export const NODE_LABEL_CHARS = 10;

/**
 * Circle radius from a node's degree. Degree 0 collapses to NODE_RADIUS_MIN,
 * so a lone unlinked bookmark still renders at the same size the graph always
 * used for its smallest node.
 *
 * @param {number} degree
 * @returns {number}
 */
export function nodeRadius(degree) {
  return Math.max(NODE_RADIUS_MIN, 4 + Math.sqrt(degree) * 4);
}

/**
 * Label x-offset from a node's degree — nudges the text outside the circle as
 * the circle grows.
 *
 * @param {number} degree
 * @returns {number}
 */
export function nodeLabelOffsetX(degree) {
  return Math.max(NODE_LABEL_OFFSET_MIN, 6 + Math.sqrt(degree) * 4);
}

/**
 * Truncate a title to the length shown on the node, appending '...' only when
 * it was actually cut.
 *
 * @param {string} title
 * @returns {string}
 */
export function truncateNodeLabel(title) {
  return title.substring(0, NODE_LABEL_CHARS) + (title.length > NODE_LABEL_CHARS ? '...' : '');
}
