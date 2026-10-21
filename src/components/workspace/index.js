/**
 * @fileoverview Workspace shell entry point.
 */
import { workspaceHtml } from './shell.js';

export { workspaceHtml };

/**
 * Append the composed workspace to the end of the #appBody wrapper.
 *
 * mountWorkspace() appends the composed <main> to the END of #appBody
 * ('beforeend'), so the DOM order is [sidebar, main] regardless of when
 * mountSidebar() ran (it uses 'afterbegin').
 */
export function mountWorkspace() {
  document.getElementById('appBody').insertAdjacentHTML('beforeend', workspaceHtml());
}
