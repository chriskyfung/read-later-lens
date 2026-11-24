/**
 * @fileoverview Workspace tab switching — activate a tab and lazily render
 * its heavy panel content.
 */
import { activateTab } from '@/behavior/tabs.js';
import { renderWordCloud } from '@/features/wordcloud';
import { renderDomainChart } from '@/features/domains';
import { renderConceptLinkageGraph, linkageGraph } from '@/features/linkage';

let previousTab = null;

/**
 * Activate a tab and lazily render heavy panel content.
 * Called by the registered tab-button listeners.
 * Disposes the linkage graph (stops its D3 simulation) when leaving the
 * linkage tab so no stray timers or selections outlive the view.
 * @param {string} tabId
 */
export function switchTab(tabId) {
  const wasLinkage = previousTab === 'linkage';
  activateTab(tabId);
  previousTab = tabId;
  if (wasLinkage && tabId !== 'linkage') {
    linkageGraph.dispose();
  }
  if (tabId === 'wordcloud') renderWordCloud();
  if (tabId === 'domains') renderDomainChart();
  if (tabId === 'linkage') renderConceptLinkageGraph();
}
