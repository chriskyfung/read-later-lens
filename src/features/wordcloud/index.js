/**
 * @fileoverview Wordcloud feature barrel — presentation + behavior container.
 * External importers reach through this facade,
 * never into components/ or behavior/ internals.
 */

// --- Presentation (markup only) ---
export {
  wordCloudEmptyStateHtml,
  wordCloudItemClass,
  wordCloudItemLabel,
  panelWordcloudHtml,
} from './components';

// --- Behavior (state / events / side-effects) ---
export { renderWordCloud, initWordCloud } from './behavior';
