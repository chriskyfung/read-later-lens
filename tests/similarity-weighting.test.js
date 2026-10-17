import { describe, it, expect } from 'vitest';
import { mostSimilar } from '../src/analytics/similarity.js';

const bm = (id, title, preview = '') => ({
  id: String(id),
  title,
  article_preview: preview,
  url: `https://example.com/${id}`,
  detected_language: 'en',
  tags: [],
  source_file_id: 'f1',
  source_file_name: 'a.csv',
});

describe('mostSimilar weighting passthrough', () => {
  // Target mixes generic words (shared by many docs) with distinctive words.
  // Under TF, generic docs sharing 4 common tokens outrank a distinctive doc
  // sharing 2 rare tokens. Under TF-IDF, the common words are down-weighted
  // and the distinctive pair wins.
  const target = bm('t', 'ai briefing news update quantum entanglement');
  const generic1 = bm('g1', 'ai briefing news update zebra giraffe penguin walrus');
  const generic2 = bm('g2', 'ai briefing news update tiger lion horse cat');
  const distinctive = bm('d', 'quantum entanglement study');
  const list = [target, generic1, generic2, distinctive];

  it('default 3-arg call is byte-identical to explicit tf', () => {
    const implicit = mostSimilar(list, target, 5);
    const explicit = mostSimilar(list, target, 5, { weighting: 'tf' });
    expect(explicit).toEqual(implicit);
  });

  it('tf surfaces generic-word docs first', () => {
    const results = mostSimilar(list, target, 5, { weighting: 'tf' });
    const top = results[0];
    expect(top.doc.id).toMatch(/^g/); // generic docs outrank distinctive under TF
  });

  it('tfidf surfaces distinctive-word docs first', () => {
    const results = mostSimilar(list, target, 5, { weighting: 'tfidf' });
    const top = results[0];
    expect(top.doc.id).toBe('d'); // distinctive pair wins once common words are down-weighted
  });

  it('flat idf (uniform vocabulary) is exactly plain cosine', () => {
    // All docs contain the same terms {xx, yy, zz}, so every idf is equal;
    // weighting is a constant factor that cancels in cosine normalization.
    const uniform = [bm('a', 'xx yy zz'), bm('b', 'xx xx yy zz'), bm('c', 'xx yy yy zz zz')];
    const targetU = bm('t', 'xx yy zz');
    const tf = mostSimilar([...uniform, targetU], targetU, 3, { weighting: 'tf' });
    const tfidf = mostSimilar([...uniform, targetU], targetU, 3, { weighting: 'tfidf' });
    expect(tfidf.map((r) => r.doc.id)).toEqual(tf.map((r) => r.doc.id));
    tfidf.forEach((r, i) => {
      expect(r.score).toBeCloseTo(tf[i].score);
    });
  });

  it('tfidf ranking collapses the generic-word hairball', () => {
    const hairball = [target];
    const privates = ['zebra', 'giraffe', 'penguin', 'walrus', 'tiger', 'lion'];
    for (let i = 0; i < 6; i++) {
      hairball.push(bm(`h${i}`, `ai briefing news update ${privates[i]}`));
    }
    hairball.push(bm('q1', 'quantum entanglement paper'));
    hairball.push(bm('q2', 'quantum entanglement study'));

    const tf = mostSimilar(hairball, target, 10, { weighting: 'tf' });
    const tfidf = mostSimilar(hairball, target, 10, { weighting: 'tfidf' });

    // TF: all six generic docs share {ai, briefing, news, update} with target
    const tfTop = tf[0].doc.id;
    expect(tfTop).toMatch(/^h/);

    // TF-IDF: common words down-weighted -> distinctive pair survives at top
    const tfidfTop = tfidf[0].doc.id;
    expect(tfidfTop).toMatch(/^q/);
  });
});
