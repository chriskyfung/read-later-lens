/** @fileoverview Similarity modal feature barrel — presentation + behavior container.
 *
 * External importers reach through this facade,
 * never into components/ or behavior/ internals.
 */

// --- Presentation (markup only) ---
export { similarityModalHtml } from './components';

// --- Behavior (state / events / side-effects) ---
export { openSimilarityModal, closeSimilarityModal, renderSimilarityModal } from './behavior';
