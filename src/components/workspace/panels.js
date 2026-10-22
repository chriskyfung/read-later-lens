/**
 * @fileoverview Workspace panels composition (presentational markup only).
 */
import { panelBookmarksHtml } from '../bookmarks/panel.js';
import { panelWordcloudHtml } from '../wordcloud/panel.js';
import { panelDomainsHtml } from '../domains/panel.js';
import { panelLinkageHtml } from '../linkage/panel.js';

/** @returns {string} The composed panels markup. */
export function panelsHtml() {
  return `${panelBookmarksHtml()}
${panelWordcloudHtml()}
${panelDomainsHtml()}
${panelLinkageHtml()}`;
}
