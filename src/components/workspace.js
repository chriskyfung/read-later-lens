/**
 * @fileoverview Center content workspace — facade preserving the public API.
 *
 * Implementation lives in src/components/workspace/ (shell + controlBar +
 * panels + constants). This module re-exports the stable public surface so
 * importers (src/main.js, tests) keep working unchanged.
 */
export { workspaceHtml, mountWorkspace, WORKSPACE_IDS } from './workspace/index.js';
