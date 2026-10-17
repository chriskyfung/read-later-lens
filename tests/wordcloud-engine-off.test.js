// CJK-only libraries never request the English engine chunk
// (needsKeywordEngine only looks at English-routed documents), so before
// the decoupling this file pins, they stayed on the legacy bigram path
// forever. Every test takes a fresh module registry so the engine starts
// 'idle' — exactly the state a Chinese-only collection lives in.
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

async function freshModules() {
  const keywords = await import('../src/analytics/keywords.js');
  const { wordCloudFrequencies } = await import('../src/analytics/wordcloud.js');
  return { keywords, wordCloudFrequencies };
}

describe('CJK segmentation with the engine never loaded', () => {
  it('extracts CJK terms without the engine', async () => {
    const { keywords } = await freshModules();
    expect(keywords.keywordsReady()).toBe(false);
    expect(keywords.extractCjkKeywordTerms('深度學習研究')).not.toEqual([]);
  });

  it('renders words, not bigram fragments, and never requests the chunk', async () => {
    const { keywords, wordCloudFrequencies } = await freshModules();
    const map = new Map(
      wordCloudFrequencies([{ id: '1', title: '機器學習與深度學習的比較', article_preview: '' }]),
    );
    expect(map.get('深度')).toBe(1);
    expect(map.get('學習')).toBe(2);
    // Legacy bigram fragments — the segmenter never emits these.
    expect(map.get('度學')).toBeUndefined();
    expect(map.get('器學')).toBeUndefined();
    // Rendering a CJK-only library must not trigger the English chunk.
    expect(keywords.keywordsReady()).toBe(false);
  });

  it('keeps Latin words in CJK documents searchable before the engine loads', async () => {
    const { keywords, wordCloudFrequencies } = await freshModules();
    const map = new Map(
      wordCloudFrequencies([{ id: '1', title: 'Google 的 AI 應用研究', article_preview: '' }]),
    );
    expect(map.get('google')).toBe(1);
    expect(map.get('ai')).toBe(1);
    expect(keywords.keywordsReady()).toBe(false);
  });
});

describe('transition when the engine arrives', () => {
  it('re-keys Latin runs from stem to lemma across the load', async () => {
    const { keywords, wordCloudFrequencies } = await freshModules();
    const docs = [
      { id: '1', title: 'daily running', article_preview: '' },
      { id: '2', title: 'running 的應用研究', article_preview: '' },
    ];

    // Populate the per-record and aggregate memos in the pre-load state —
    // the same engine-off pass a two-stage render paints as its stage 1
    // while the chunk is still in flight.
    const before = new Map(wordCloudFrequencies(docs));
    expect(keywords.keywordsReady()).toBe(false);
    expect(before.get('running')).toBe(1); // segmented + lowercased, no chunk

    await keywords.loadKeywordsEngine();
    expect(keywords.keywordsReady()).toBe(true);

    // Same record objects → same memos: the path change must invalidate
    // both the per-record terms and the aggregate, re-keying 'running'
    // from the legacy stem to the compromise lemma.
    const after = new Map(wordCloudFrequencies(docs));
    expect(after.get('running')).toBe(2);
    expect(after.get('runn')).toBeUndefined();
  });

  it('converges on identical rows whether the chunk lands before or after aggregation', async () => {
    const docs = [
      { id: '1', title: 'daily running', article_preview: '' },
      { id: '2', title: 'running 的應用研究', article_preview: '' },
    ];

    // Path A — the two-stage view: aggregate first (stage 1), the engine
    // arrives, and the SAME record objects re-aggregate (stage 2).
    const a = await freshModules();
    const stage1 = a.wordCloudFrequencies(docs);
    await a.keywords.loadKeywordsEngine();
    const upgraded = a.wordCloudFrequencies(docs);

    // Path B — prefetch-first: the chunk is resident before any aggregation
    // ever runs (the idle/intent prefetch case).
    vi.resetModules();
    const b = await freshModules();
    await b.keywords.loadKeywordsEngine();
    const direct = b.wordCloudFrequencies(docs);

    expect(upgraded).toEqual(direct);
    // Stage 1 really was a different (stem-keyed) rendering of the same data,
    // so the equality above proves convergence, not a shared stale memo.
    expect(stage1).not.toEqual(upgraded);
  });
});
