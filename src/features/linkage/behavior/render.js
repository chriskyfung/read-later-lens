/**
 * @fileoverview Linkage graph view orchestration — thin public API wrappers.
 *
 * All render/focus/zoom/weighting logic now lives in the encapsulated
 * `LinkageGraph` class (./graph.js), which owns its own mutable state.
 * This module re-exports thin wrappers over the default `linkageGraph`
 * instance so existing callers (shell.js, tabActions.js, card.js, modalListeners.js,
 * tests) keep working unchanged.
 *
 * Internal modules import from ./graph.js and the submodules directly, never
 * through this barrel, keeping the dependency graph acyclic.
 */

import { linkageGraph } from './graph.js';

/** Re-export FOCUS_ZOOM so the module's public surface is unchanged for
 * callers that imported it from here rather than from ./linkage/focus.js. */
export { FOCUS_ZOOM } from './focus.js';

/**
 * Render the concept-linkage graph tab.
 * @param {string|null} [focusId] Bookmark id to pin and centre on.
 * @returns {boolean} Whether the graph rendered.
 */
export function renderConceptLinkageGraph(focusId = null) {
  return linkageGraph.render(focusId);
}

/**
 * Switch the graph's link scoring mode ('tf' | 'tfidf') and re-render.
 * Panel checkbox.
 */
export function setLinkageWeighting(mode) {
  linkageGraph.setWeighting(mode);
}

/**
 * Zoom the graph by a multiplicative factor (toolbar buttons).
 */
export function zoomGraphBy(factor) {
  linkageGraph.zoomBy(factor);
}

/**
 * Reset the graph view to the identity transform and re-render.
 */
export function resetGraphZoom() {
  linkageGraph.resetZoom();
}

/**
 * Highlight and center a rendered node by bookmark id.
 * @param {string} id
 * @returns {boolean} whether a node was found and focused
 */
export function focusLinkageNode(id) {
  return linkageGraph.focusNode(id);
}
