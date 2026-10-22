/**
 * @fileoverview Workspace shell markup (presentational).
 */
import { WORKSPACE_IDS } from './constants.js';
import { controlBarHtml } from './controlBar.js';
import { panelsHtml } from './panels.js';

/** @returns {string} The composed workspace markup. */
export function workspaceHtml() {
  return `
    <!-- Center Content Workspace -->
    <main class="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden">
${controlBarHtml()}
      <!-- Main Display Panels Container -->
      <div class="flex-1 overflow-y-auto p-6 relative" id="${WORKSPACE_IDS.CONTENT_VIEWPORT}">
${panelsHtml()}
      </div>
    </main>
`;
}
