/**
 * @fileoverview Center content workspace — composes the control bar and the
 * four tab panels into the <main> shell.
 *
 * Markup blocks are extracted byte-for-byte from the original monolith
 * (index.html "Center Content Workspace"). mountWorkspace() appends the
 * composed <main> to the END of #appBody ('beforeend'), so the DOM order is
 * [sidebar, main] regardless of when mountSidebar() ran (it uses
 * 'afterbegin').
 *
 * Behavior lives in src/views/workspaceActions.js (listeners must be
 * registered after this mount).
 */

import { controlBarHtml } from './controlBar.js';
import { panelBookmarksHtml } from './bookmarks/panel.js';
import { panelWordcloudHtml } from './wordcloud/panel.js';
import { panelDomainsHtml } from './panelDomains.js';
import { panelLinkageHtml } from './panelLinkage.js';

/** @returns {string} The composed workspace markup. */
export function workspaceHtml() {
  return `
    <!-- Center Content Workspace -->
    <main class="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden">
${controlBarHtml()}
      <!-- Main Display Panels Container -->
      <div class="flex-1 overflow-y-auto p-6 relative" id="contentViewport">
${panelBookmarksHtml()}
${panelWordcloudHtml()}
${panelDomainsHtml()}
${panelLinkageHtml()}
      </div>
    </main>
`;
}

/**
 * Append the composed workspace to the end of the #appBody wrapper.
 */
export function mountWorkspace() {
  document.getElementById('appBody').insertAdjacentHTML('beforeend', workspaceHtml());
}
