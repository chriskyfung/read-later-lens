/**
 * @fileoverview Central render orchestrator — always renders the sidebar, then
 * the bookmark grid (the trash is a dedicated modal, opened from the sidebar
 * row instead of switching the grid tab), then the active analytics view.
 * Selection-only changes update the batch action bar separately without
 * invoking this full render.
 */

import { activeTab } from '../core/state';
import { renderSidebar } from '../views/sidebar';
import { renderBookmarkCards } from '@/features/bookmarks';

import { renderWordCloud } from '../views/wordcloud.js';
import { renderDomainChart } from '../views/domains.js';
import { renderConceptLinkageGraph } from '@/features/linkage';

/**
 * Re-render the sidebar and the bookmark grid (or the trash view), then the
 * active analytics view.
 */
export function renderAll() {
  renderSidebar();
  renderBookmarkCards();

  if (activeTab === 'wordcloud') renderWordCloud();
  if (activeTab === 'domains') renderDomainChart();
  if (activeTab === 'linkage') renderConceptLinkageGraph();
}
