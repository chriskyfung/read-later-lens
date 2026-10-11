/**
 * @fileoverview Pure data shaping for the linkage graph's render paths.
 *
 * Two mutations the view performs on the plain node records produced by
 * src/analytics/linkage.js, kept here because they are the parts of the Frame
 * A/Frame B render that carry real rules and no DOM: pinning the focus target
 * to the canvas centre, and merging the link pass's freshly built node list
 * into the object the DOM already holds. d3- and DOM-free so each rule is
 * unit-testable on its own.
 */

/**
 * Multiplier on d3's origin spiral for the not-yet-positioned nodes of a
 * focused render. d3 seeds them in a tight ~10px spiral around the origin,
 * which on a focused graph means heavily overlapping `forceCollide` radii and
 * an explosive first tick. Spreading them lets the graph grow outward from the
 * centred bookmark instead.
 */
export const INITIAL_SPREAD = 2.5;

/**
 * Find the node to focus and pin it to the canvas centre.
 *
 * d3's initializeNodes() copies fx/fy onto x/y, and every tick() restores
 * x = fx after the forces run, so this position holds for the lifetime of the
 * simulation — which is what lets the caller place the camera on the node in
 * the same call, with no transition and no wait for the first tick.
 *
 * Mutates and returns the node; returns null when `focusId` is null or names
 * no node in the selection.
 *
 * @param {{ id: string }[]} nodes
 * @param {string|null} focusId
 * @param {number} width
 * @param {number} height
 * @returns {{ id: string, fx: number, fy: number, x: number, y: number }|null}
 */
export function resolveFocusTarget(nodes, focusId, width, height) {
  if (focusId == null) return null;
  const node = nodes.find((d) => d.id === focusId) || null;
  if (!node) return null;
  node.fx = width / 2;
  node.fy = height / 2;
  node.x = width / 2;
  node.y = height / 2;
  return node;
}

/**
 * Prepare the link pass's node list for a focused render.
 *
 * Keeps the caller's `focusNode` object in the array — the DOM already holds it
 * as `__data__` — and adopts the degree the link pass computed for it.
 * Substituting the fresh copy would orphan the painted node: d3's data binding,
 * forceLink's id lookup and the tick handler must all agree on the same object.
 *
 * Then spreads the as-yet-unpositioned nodes out from the centred bookmark so
 * the graph grows away from it, instead of every node piling onto one spot and
 * being flung apart by forceCollide on the first tick.
 *
 * Mutates `nodes` in place and returns it. No-op on the node array when
 * `focusNode` is null, so a caller with nothing to focus cannot corrupt it.
 *
 * @param {object[]} nodes The link pass's freshly built node list.
 * @param {{ id: string, degree: number }|null} focusNode The pinned node.
 * @param {number} width
 * @param {number} height
 * @param {number} [spread] Defaults to INITIAL_SPREAD.
 * @returns {object[]} the same array, prepared
 */
export function prepareFocusedTopology(nodes, focusNode, width, height, spread = INITIAL_SPREAD) {
  if (!focusNode) return nodes;

  const idx = nodes.findIndex((n) => n.id === focusNode.id);
  if (idx !== -1) {
    focusNode.degree = nodes[idx].degree;
    nodes[idx] = focusNode;
  }

  nodes.forEach((n) => {
    if (n === focusNode) return;
    n.x = width / 2 + (n.x || 0) * spread;
    n.y = height / 2 + (n.y || 0) * spread;
  });

  return nodes;
}
