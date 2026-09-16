import { describe, it, expect } from 'vitest';
import { buildLinkageGraph, LINKAGE_LIMIT, LINKAGE_THRESHOLD } from '../src/analytics/linkage.js';

const bm = (id, over = {}) => ({
  id: String(id),
  title: `apple pie recipe ${id}`,
  url: `https://www.site${id}.com/a`,
  article_preview: 'pie text',
  content: '',
  instapaper_url: `https://www.instapaper.com/read/${id}`,
  detected_language: 'en',
  tags: [],
  source_file_id: 'f1',
  source_file_name: 'a.csv',
  ...over,
});

describe('buildLinkageGraph', () => {
  it('exposes the monolith constants', () => {
    expect(LINKAGE_LIMIT).toBe(50);
    expect(LINKAGE_THRESHOLD).toBe(0.15);
  });

  it('links similar nodes, increments degree, and skips dissimilar pairs', () => {
    const { nodes, links } = buildLinkageGraph([
      bm(1),
      bm(2), // identical text -> similarity 1
      bm(3, { title: 'zzz qqq', article_preview: 'unrelated' }),
    ]);

    expect(nodes).toHaveLength(3);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ source: '1', target: '2' });
    expect(links[0].value).toBeCloseTo(1);

    expect(nodes[0].degree).toBe(1);
    expect(nodes[1].degree).toBe(1);
    expect(nodes[2].degree).toBe(0);
  });

  it('uses a strict > threshold (monolith parity)', () => {
    const docs = [bm(1), bm(2)]; // similarity exactly 1
    expect(buildLinkageGraph(docs, { threshold: 1 }).links).toHaveLength(0);
    expect(buildLinkageGraph(docs, { threshold: 0.999 }).links).toHaveLength(1);
  });

  it('defaults to the 0.15 threshold', () => {
    const docs = [
      bm(1, { title: 'alpha beta gamma delta', article_preview: '' }),
      bm(2, { title: 'alpha beta gamma epsilon', article_preview: '' }),
    ];
    const { links } = buildLinkageGraph(docs);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].value).toBeGreaterThan(0.15);
  });

  it('derives domains: strips www., falls back to unknown for bad URLs', () => {
    const { nodes, domains } = buildLinkageGraph([
      bm(1, { url: 'https://www.example.com/a' }),
      bm(2, { url: '::::not-a-url' }),
    ]);
    expect(nodes[0].domain).toBe('example.com');
    expect(nodes[1].domain).toBe('unknown');
    expect([...domains].sort()).toEqual(['example.com', 'unknown']);
  });

  it('caps the node list at the limit (default 50)', () => {
    const many = Array.from({ length: 60 }, (_, i) => bm(i + 1));
    expect(buildLinkageGraph(many).nodes).toHaveLength(50);
    expect(buildLinkageGraph(many, { limit: 5 }).nodes).toHaveLength(5);
  });

  it('handles a single node (no pairs, no links)', () => {
    const { nodes, links } = buildLinkageGraph([bm(1)]);
    expect(nodes).toHaveLength(1);
    expect(links).toHaveLength(0);
    expect(nodes[0].degree).toBe(0);
  });

  it('returns empty structures for an empty list', () => {
    const { nodes, links, domains } = buildLinkageGraph([]);
    expect(nodes).toEqual([]);
    expect(links).toEqual([]);
    expect(domains.size).toBe(0);
  });

  it('carries title/url/tags onto the nodes', () => {
    const { nodes } = buildLinkageGraph([bm(1, { tags: ['a', 'b'] })]);
    expect(nodes[0]).toMatchObject({
      id: '1',
      title: 'apple pie recipe 1',
      url: 'https://www.site1.com/a',
      tags: ['a', 'b'],
    });
    // tags fall back to [] when absent
    const { nodes: noTags } = buildLinkageGraph([bm(2, { tags: undefined })]);
    expect(noTags[0].tags).toEqual([]);
  });
});
