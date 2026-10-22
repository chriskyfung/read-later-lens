/**
 * @fileoverview Workspace shell entry point.
 */
import { WORKSPACE_IDS } from './constants.js';
import { workspaceHtml } from './shell.js';

export { WORKSPACE_IDS } from './constants.js';
export { workspaceHtml };

/**
 * Append the composed workspace to the end of the #appBody wrapper.
 *
 * mountWorkspace() appends the composed <main> to the END of #appBody
 * ('beforeend'), so the DOM order is [sidebar, main] regardless of when
 * mountSidebar() ran (it uses 'afterbegin').
 */
export function mountWorkspace() {
  const appBody = document.getElementById(WORKSPACE_IDS.APP_BODY);
  if (!appBody) {
    console.warn(`[workspace] #${WORKSPACE_IDS.APP_BODY} not found; skipping workspace mount`);
    return;
  }
  appBody.insertAdjacentHTML('beforeend', workspaceHtml());
}
