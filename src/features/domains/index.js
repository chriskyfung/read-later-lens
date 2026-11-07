/**
 * @fileoverview Domains feature barrel — presentation + behavior container.
 *
 * External importers reach through this facade, never into components/ or
 * behavior/ internals.
 */

// --- Presentation (markup only) ---
export {
  domainChartEmptyStateHtml,
  domainBarClass,
  domainBarHtml,
  panelDomainsHtml,
} from './components';

// --- Behavior (state / events / side-effects) ---
export { renderDomainChart, initDomains } from './behavior';
