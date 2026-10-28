import { describe, it, expect } from 'vitest';
import { mostSimilar, mostSimilarAuto } from '../src/analytics/similarity.js';
import { sigmoid, targetSpecificity, buildIdf } from '../src/analytics/scoring.js';
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

describe('mostSimilarAuto', () => {
  // 20-document corpus: target + 6 generic + 1 distinctive + 12 filler.
  // Generic words ('ai','briefing','news','update') appear in 7 docs;
  // distinctive words ('quantum','entanglement') appear in 2 docs; filler
  // words appear in 1 doc each. IDF spread exceeds MIN_IDF_SPREAD so the
  // auto-blend gate engages.
  const filler = [
    ['apple', 'banana'],
    ['cherry', 'date'],
    ['elderberry', 'fig'],
    ['grape', 'honeydew'],
    ['kiwi', 'lemon'],
    ['mango', 'nectarine'],
    ['orange', 'papaya'],
    ['quince', 'raspberry'],
    ['strawberry', 'tangerine'],
    ['ugli', 'vanilla'],
    ['watermelon', 'xigua'],
    ['yam', 'zucchini'],
  ];
  const corpus = [
    bm('t', 'ai briefing news update quantum entanglement'), // target, mixed
    bm('g1', 'ai briefing news update zebra'), // generic
    bm('g2', 'ai briefing news update giraffe'),
    bm('g3', 'ai briefing news update penguin'),
    bm('g4', 'ai briefing news update walrus'),
    bm('g5', 'ai briefing news update tiger'),
    bm('g6', 'ai briefing news update lion'),
    bm('d', 'quantum entanglement study'), // distinctive
    ...filler.map(([w1, w2], i) => bm(`f${i + 1}`, `${w1} ${w2}`)),
  ];
  const target = corpus[0];

  it('small corpus stays tf (lambda 0)', () => {
    const small = [corpus[0], corpus[1], corpus[7]];
    const out = mostSimilarAuto(small, corpus[0], 5);
    expect(out.mode).toBe('tf');
    expect(out.lambda).toBe(0);
    expect(out.results.map((r) => r.doc.id)).toEqual(
      mostSimilar(small, corpus[0], 5, { weighting: 'tf' }).map((r) => r.doc.id),
    );
  });

  it('uniform vocabulary stays tf (zero idf spread)', () => {
    const uniform = [bm('a', 'xx yy zz'), bm('b', 'xx xx yy zz'), bm('c', 'xx yy yy zz zz')];
    const targetU = bm('t', 'xx yy zz');
    const out = mostSimilarAuto([...uniform, targetU], targetU, 3);
    expect(out.mode).toBe('tf');
    expect(out.lambda).toBe(0);
  });

  it('generic target -> mode tfidf and reorders vs tf', () => {
    const out = mostSimilarAuto(corpus, target, 5);
    expect(out.mode).toBe('tfidf');
    expect(out.lambda).toBeGreaterThan(0.7);
    const tfTop = mostSimilar(corpus, target, 5, { weighting: 'tf' })[0].doc.id;
    expect(tfTop).toMatch(/^g/); // tf puts a generic doc first
    expect(out.results[0].doc.id).toBe('d'); // tfidf puts the distinctive doc first
  });

  it('distinctive target -> mode tf (lambda 0)', () => {
    const distinctiveTarget = corpus[7];
    const out = mostSimilarAuto(corpus, distinctiveTarget, 5);
    expect(out.mode).toBe('tf');
    expect(out.lambda).toBeLessThan(0.3);
    expect(out.results.map((r) => r.doc.id)).toEqual(
      mostSimilar(corpus, distinctiveTarget, 5, { weighting: 'tf' }).map((r) => r.doc.id),
    );
  });
});

describe('auto helpers', () => {
  it('sigmoid(0) is 0.5 and monotonic', () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(5)).toBeGreaterThan(sigmoid(0));
    expect(sigmoid(-5)).toBeLessThan(sigmoid(0));
  });

  it('targetSpecificity uses weight 1 for unseen terms', () => {
    const freqs = [
      new Map([['rare', 1]]),
      new Map([
        ['common', 1],
        ['rare', 1],
      ]),
    ];
    const idf = buildIdf(freqs);
    // 'novel' never appears in corpus -> weight 1; 'rare' -> its idf
    const spec = targetSpecificity(
      new Map([
        ['novel', 1],
        ['rare', 1],
      ]),
      idf,
    );
    expect(spec).toBe((1 + idf.get('rare')) / 2);
  });
});
