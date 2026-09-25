// @vitest-environment jsdom

/**
 * Registry audit for DOM XSS sinks.
 *
 * Every markup builder in src/ that interpolates imported data is fed one
 * hostile payload and must neutralize it. The assertions run against a REAL
 * DOM (jsdom), so unlike the hand-rolled stubs elsewhere — whose querySelector
 * returns a fake element for any selector — "no element was created" is a
 * meaningful claim here.
 *
 * Add any new data-fed builder to REGISTRY so the audit keeps covering it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bookmarkCardHtml } from '../src/components/bookmarks/card.js';
import { trashItemHtml } from '../src/components/bookmarks/trashPanel.js';
import { domainBarHtml } from '../src/components/domains/bar.js';
import { sidebarFolderItemHtml } from '../src/components/sidebar/folderRow.js';
import { linkageTooltipTagsHtml } from '../src/components/linkage/graph.js';
import { saveSourceFileRowHtml } from '../src/components/io/saveModal.js';
import { renderSaveModal } from '../src/io/exporter.js';
import { setSourceFiles } from '../src/core/state.js';

const HOSTILE = '<img src=x onerror=alert(1)>';
const HOSTILE_NAME = `">${HOSTILE}.csv`;

const hostileBookmark = {
  id: '1',
  title: HOSTILE,
  url: 'https://example.com/a',
  article_preview: HOSTILE,
  tags: [HOSTILE],
  detected_language: 'en',
  source_file_id: 'F1',
  source_file_name: HOSTILE_NAME,
  deleted_at: '2026-01-01T00:00:00.000Z',
};

/** Every markup builder in src/ that interpolates imported data. */
const REGISTRY = [
  [
    'bookmarkCardHtml',
    () => bookmarkCardHtml({ bookmark: hostileBookmark, domain: 'example.com', isSelected: false }),
  ],
  ['trashItemHtml', () => trashItemHtml(hostileBookmark)],
  ['domainBarHtml', () => domainBarHtml({ domain: HOSTILE, count: 3, pct: 10 })],
  [
    'sidebarFolderItemHtml',
    () =>
      sidebarFolderItemHtml({ file: { id: 'F1', name: HOSTILE_NAME, type: HOSTILE }, count: 1 }),
  ],
  ['linkageTooltipTagsHtml', () => linkageTooltipTagsHtml([HOSTILE])],
  [
    'saveSourceFileRowHtml',
    () => saveSourceFileRowHtml({ file: { id: 'F1', name: HOSTILE_NAME, type: HOSTILE } }),
  ],
];

describe('data-fed markup builders (registry audit)', () => {
  it.each(REGISTRY)('%s neutralizes a hostile payload', (_label, render) => {
    const host = document.createElement('div');
    host.innerHTML = render();

    // No injected element, and no event-handler attribute from the payload.
    // (svg is deliberately absent: bookmark cards legitimately embed icons.)
    expect(host.querySelector('img, script, iframe, object, embed')).toBeNull();
    expect(host.querySelector('[onerror]')).toBeNull();
    // The payload still reaches the user — as TEXT, not as markup.
    expect(host.textContent).toContain('alert(1)');
  });
});

describe('renderSaveModal — the reported innerHTML sink', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="saveSourceFilesList"></div>';
    setSourceFiles(new Map([['F1', { id: 'F1', name: HOSTILE_NAME, type: 'csv' }]]));
  });

  it('renders the hostile name as text, with no injected element', () => {
    expect(renderSaveModal()).toBe(true);

    const container = document.getElementById('saveSourceFilesList');
    expect(container.children).toHaveLength(1);
    expect(container.querySelector('img, script, iframe, object, embed')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.textContent).toContain(HOSTILE_NAME);
    expect(container.querySelector('[data-save-file]').dataset.saveFile).toBe('F1');
  });

  it('keeps the empty state when no sources are loaded', () => {
    setSourceFiles(new Map());

    expect(renderSaveModal()).toBe(true);
    expect(document.getElementById('saveSourceFilesList').textContent).toContain(
      '尚無載入的來源檔案',
    );
  });
});
