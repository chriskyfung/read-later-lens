/**
 * @fileoverview Central render orchestrator — always renders the sidebar and
 * bookmark grid, then the active analytics view. Selection-only changes update
 * the batch action bar separately without invoking this full render.
 */

import { activeTab } from '../core/state.js';
import { renderSidebar } from './sidebar.js';
import { renderBookmarkCards } from './bookmarks.js';
import { renderWordCloud } from './wordcloud.js';
import { renderDomainChart } from './domains.js';
import { renderConceptLinkageGraph } from './linkage.js';

/**
 * Re-render the sidebar and bookmark grid, then the active analytics view.
 */
export function renderAll() {
  renderSidebar();
  renderBookmarkCards();

  if (activeTab === 'wordcloud') renderWordCloud();
  if (activeTab === 'domains') renderDomainChart();
  if (activeTab === 'linkage') renderConceptLinkageGraph();
}
