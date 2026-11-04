/**
 * @fileoverview Similarity modal behavior barrel — state / events / side-effects container.
 *
 * External importers reach through this facade,
 * never into components/ or behavior/ internals.
 */

export {
  openSimilarityModal,
  closeSimilarityModal,
  renderSimilarityModal,
} from './similarityModal.js';
