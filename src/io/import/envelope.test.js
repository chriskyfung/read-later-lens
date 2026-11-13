import { describe, it, expect, vi } from 'vitest';
import { typeFromSourceName, expandEnvelopeSources } from './envelope.js';
import { initImporter } from './deps.js';
import { resolveImportAdapter } from '@/providers';

describe('typeFromSourceName', () => {
  it('returns csv for .csv extension', () => {
    expect(typeFromSourceName('bookmarks.csv')).toBe('csv');
  });

  it('returns json for .json extension', () => {
    expect(typeFromSourceName('highlights.json')).toBe('json');
  });

  it('returns sqlite for .sqlite extension', () => {
    expect(typeFromSourceName('data.sqlite')).toBe('sqlite');
  });

  it('returns db for .db extension', () => {
    expect(typeFromSourceName('data.db')).toBe('db');
  });

  it('returns empty string for unknown extension', () => {
    expect(typeFromSourceName('notes.txt')).toBe('');
    expect(typeFromSourceName('data')).toBe('');
  });

  it('returns empty string for file with no extension', () => {
    expect(typeFromSourceName('myfile')).toBe('');
  });
});

describe('expandEnvelopeSources', () => {
  it('expands unified export into per-source records', async () => {
    const { JSDOM } = await import('jsdom');
    globalThis.document = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      runScripts: 'dangerously',
    }).window.document;
    initImporter({ persistAndRender: vi.fn(), render: vi.fn() });

    const result = await expandEnvelopeSources(
      'rll-unified', // unified exports only rebuild per-source folders
      [
        {
          id: 'a1',
          name: 'instapaper.csv',
          type: 'csv',
          source_file_id: 'file_a',
          title: 'Instapaper',
          url: 'https://example.com/a',
        },
        {
          id: 'b1',
          name: 'raindrop.json',
          type: 'json',
          source_file_id: 'file_b',
          title: 'Raindrop',
          url: 'https://example.com/b',
        },
      ],
      { id: 'new-id', name: 'new.csv', type: 'csv', profile: 'instapaper-scraper' },
      [{ id: 'file_a', name: 'instapaper.csv' }],
      resolveImportAdapter('rll-unified'),
    );

    expect(result).toBeDefined();
    expect(result?.fileRecords).toHaveLength(2);
    expect(result?.records.length).toBeGreaterThan(0);
  });

  it('returns null when no manifest and single source', async () => {
    const { JSDOM } = await import('jsdom');
    globalThis.document = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      runScripts: 'dangerously',
    }).window.document;
    initImporter({ persistAndRender: vi.fn(), render: vi.fn() });

    const result = await expandEnvelopeSources(
      'instapaper-scraper',
      [{ id: 'file_a', name: 'instapaper.csv', type: 'csv' }],
      { id: 'new-id', name: 'new.csv', type: 'csv', profile: 'instapaper-scraper' },
      [],
      resolveImportAdapter('instapaper-scraper'),
    );

    expect(result).toBeNull();
  });
});
