/** @fileoverview Linkage feature barrel — presentation + behavior container.
 *
 * External importers reach through this facade,
 * never into components/ or behavior/ internals.
 */

// --- Presentation (markup only) ---
export { linkageEmptyStateHtml, linkageTooltipTagsHtml, panelLinkageHtml } from './components';

// --- Behavior (state / events / side-effects) ---
export {
  FOCUS_ZOOM,
  focusCameraTransform,
  setFocusCamera,
  centerFocusedNode,
  applyFocusStyles,
  clearFocusStyles,
  resetFocus,
  focusSimulationHooks,
  NODE_RADIUS_MIN,
  NODE_LABEL_OFFSET_MIN,
  NODE_LABEL_CHARS,
  nodeRadius,
  nodeLabelOffsetX,
  truncateNodeLabel,
  afterPaint,
  createNodeLayer,
  createScene,
  gatherTooltipRefs,
  linkStrokeWidth,
  createForceSimulation,
  createLinkSelection,
  refreshNodeRadii,
  wireSimulationHandlers,
  graphState,
  FALLBACK_WIDTH,
  FALLBACK_HEIGHT,
  resolveCanvasSize,
  clearRenderState,
  cancelPendingTopology,
  isCurrentGeneration,
  nextRenderGeneration,
  INITIAL_SPREAD,
  pinNodeAt,
  unpinNode,
  resolveFocusTarget,
  prepareFocusedTopology,
  renderConceptLinkageGraph,
  setLinkageWeighting,
  zoomGraphBy,
  resetGraphZoom,
  focusLinkageNode,
  openLinkageForBookmark,
} from './behavior';
