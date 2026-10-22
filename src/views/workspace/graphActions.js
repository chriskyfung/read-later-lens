/**
 * @fileoverview Workspace graph actions — D3 zoom controls and the TF ⇄ TF-IDF
 * weighting toggle. The zoom/pan state lives in src/views/linkage.js.
 */
import { zoomGraphBy, resetGraphZoom, setLinkageWeighting } from '../linkage.js';

/** Zoom multiplier applied per zoom-in step. */
export const ZOOM_IN_FACTOR = 1.3;

/** Zoom multiplier applied per zoom-out step (the inverse of ZOOM_IN_FACTOR). */
export const ZOOM_OUT_FACTOR = 1 / ZOOM_IN_FACTOR;

/**
 * Zoom the concept-linkage graph in.
 */
export function zoomIn() {
  zoomGraphBy(ZOOM_IN_FACTOR);
}

/**
 * Zoom the concept-linkage graph out.
 */
export function zoomOut() {
  zoomGraphBy(ZOOM_OUT_FACTOR);
}

/**
 * Reset the concept-linkage graph zoom to its default.
 */
export function resetZoom() {
  resetGraphZoom();
}

/**
 * Switch the graph's scoring mode between TF and TF-IDF.
 * @param {boolean} enabled - True for TF-IDF, false for TF.
 */
export function applyWeighting(enabled) {
  setLinkageWeighting(enabled ? 'tfidf' : 'tf');
}
