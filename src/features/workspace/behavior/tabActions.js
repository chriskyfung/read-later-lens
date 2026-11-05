/**
 * @fileoverview Workspace tab switching — activate a tab and lazily render
 * its heavy panel content.
 */
import { activateTab } from '@/views/tabs.js';
import { renderWordCloud } from '@/features/wordcloud';
import { renderDomainChart } from '@/features/domains';
import { renderConceptLinkageGraph } from '@/features/linkage';

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
