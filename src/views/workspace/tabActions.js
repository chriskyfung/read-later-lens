/**
 * @fileoverview Workspace tab switching — activate a tab and lazily render
 * its heavy panel content.
 */
import { activateTab } from '../tabs.js';
import { renderWordCloud } from '../wordcloud.js';
import { renderDomainChart } from '../domains.js';
import { renderConceptLinkageGraph } from '../linkage';

/**
 * Activate a tab and lazily render heavy panel content.
 * Called by the registered tab-button listeners.
 * @param {string} tabId
 */
export function switchTab(tabId) {
  activateTab(tabId);
  if (tabId === 'wordcloud') renderWordCloud();
  if (tabId === 'domains') renderDomainChart();
  if (tabId === 'linkage') renderConceptLinkageGraph();
}
