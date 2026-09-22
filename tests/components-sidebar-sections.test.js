import { describe, it, expect } from 'vitest';
import { sidebarHtml } from '../src/components/sidebar/panel.js';
import { sidebarFoldersSectionHtml } from '../src/components/sidebar/sections/folders.js';
import { sidebarLanguageFiltersSectionHtml } from '../src/components/sidebar/sections/languageFilters.js';
import { sidebarTagCloudSectionHtml } from '../src/components/sidebar/sections/tags.js';
import { sidebarStorageSectionHtml } from '../src/components/sidebar/sections/storage.js';

/**
 * Tests for the static sidebar section modules: each owns exactly one monolith
 * section, and panel.js composes them in the original DOM order.
 */

describe('sidebar section helpers', () => {
  it('keeps the folders section anchors', () => {
    const html = sidebarFoldersSectionHtml();
    expect(html).toContain('id="folderList"');
    expect(html).toContain('id="allFolderBtn"');
    expect(html).toContain('id="totalSourceCount"');
    expect(html).toContain('id="allCountBadge"');
  });

  it('keeps the language pills section anchors', () => {
    const html = sidebarLanguageFiltersSectionHtml();
    expect(html).toContain('id="languageFilters"');
    expect(html.match(/data-lang=/g)).toHaveLength(5);
  });

  it('keeps the tag cloud section anchors and the shared placeholder', () => {
    const html = sidebarTagCloudSectionHtml();
    expect(html).toContain('id="tagFilterCloud"');
    expect(html).toContain('尚無標籤');
  });

  it('keeps the storage section anchors', () => {
    const html = sidebarStorageSectionHtml();
    expect(html).toContain('id="storageUsageText"');
    expect(html).toContain('id="storageProgressBar"');
  });

  it('composes the sections in the monolith DOM order', () => {
    const html = sidebarHtml();
    const order = [
      '<!-- Source Files / Folders -->',
      '<!-- Language Filters -->',
      '<!-- Custom Tags Filter -->',
      '<!-- IndexedDB Storage Info -->',
    ].map((marker) => html.indexOf(marker));
    expect(order.every((i) => i > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});