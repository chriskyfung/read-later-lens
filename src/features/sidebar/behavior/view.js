/**
 * @fileoverview Sidebar render orchestrator.
 *
 * Folders must render before tags: the folders renderer may reset the active
 * folder (empty-trash fallback), and the tag cloud reads the active tag.
 */

import { renderSidebarFolders } from './folders.js';
import { renderTagCloud } from './tags.js';

/**
 * Render all sidebar pieces (called by the main `renderAll` orchestrator).
 */
export function renderSidebar() {
  renderSidebarFolders();
  renderTagCloud();
}
