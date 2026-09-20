/**
 * @fileoverview Central render orchestrator — always renders the sidebar, then
 * either the bookmark grid or the trash view (activeFolder === 'TRASH'), then
 * the active analytics view. Selection-only changes update the batch action bar
 * separately without invoking this full render.
 */

import { activeFolder, activeTab } from '../core/state.js';
import { renderSidebar } from './sidebar.js';
import { renderBookmarkCards } from './bookmarks.js';
import { renderTrashView } from './trash.js';
import { renderWordCloud } from './wordcloud.js';
import { renderDomainChart } from './domains.js';
import { renderConceptLinkageGraph } from './linkage.js';

/**
 * Re-render the sidebar and the bookmark grid (or the trash view), then the
 * active analytics view.
 */
export function renderAll() {
  renderSidebar();
  if (activeFolder === 'TRASH') renderTrashView();
  else renderBookmarkCards();

  if (activeTab === 'wordcloud') renderWordCloud();
  if (activeTab === 'domains') renderDomainChart();
  if (activeTab === 'linkage') renderConceptLinkageGraph();
}
