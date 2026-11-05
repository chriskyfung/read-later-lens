/**
 * @fileoverview Workspace panels composition (presentational markup only).
 */
import { panelBookmarksHtml } from '@/features/bookmarks';
import { panelWordcloudHtml } from '@/features/wordcloud';
import { panelDomainsHtml } from '@/features/domains';
import { panelLinkageHtml } from '@/features/linkage';

/** @returns {string} The composed panels markup. */
export function panelsHtml() {
  return `${panelBookmarksHtml()}
${panelWordcloudHtml()}
${panelDomainsHtml()}
${panelLinkageHtml()}`;
}
