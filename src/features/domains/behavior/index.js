/**
 * @fileoverview Domains behavior barrel — stable public surface for the split.
 *
 * Importers reach through this facade (src/features/domains), not into the
 * individual modules, so the internal file layout can evolve without touching callers.
 */
export { renderDomainChart, initDomains } from './domains.js';
