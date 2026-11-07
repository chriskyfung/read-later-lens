/**
 * @fileoverview Similarity modal markup barrel — stable public surface for the split.
 *
 * Importers reach through this facade, not into the individual module, so the
 * internal file layout can evolve without touching callers.
 */

export { similarityModalHtml } from './similarityModal.js';
