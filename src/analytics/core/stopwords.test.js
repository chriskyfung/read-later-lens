import { describe, it, expect } from 'vitest';
import { BASE_EN, CLOUD_EN, CJK_STOPWORDS, JA_STOPWORDS, cjkStopsetFor } from './stopwords.js';
import { bookmarkTokenFreq } from '../similarity.js';
import { wordCloudFrequencies } from '../wordcloud.js';

describe('stopwords', () => {
  it('keeps the cloud list byte-identical to the monolith (CLOUD_EN)', () => {
    expect(CLOUD_EN.size).toBe(200);
    expect(CJK_STOPWORDS.size).toBe(32);
  });
  it('splits aesthetic words out of the scorer base', () => {
    for (const w of ['time', 'new', 'way', 'know', 'make']) {
      expect(BASE_EN.has(w)).toBe(false);
      expect(CLOUD_EN.has(w)).toBe(true);
    }
    expect(BASE_EN.has('the')).toBe(true);
    expect(BASE_EN.has('https')).toBe(true);
    expect(CJK_STOPWORDS.has('的')).toBe(true);
    expect(JA_STOPWORDS.has('ので')).toBe(true);
  });
  it('routes the CJK stopset by language', () => {
    expect(cjkStopsetFor('ja').has('ので')).toBe(true);
    expect(cjkStopsetFor('zh').has('ので')).toBe(false);
    expect(cjkStopsetFor('zh').has('的')).toBe(true);
  });
});
describe('stopword split — scorer vs cloud', () => {
  it('similarity keeps aesthetic words the cloud drops', () => {
    const doc = { id: 'x', title: 'time management', article_preview: '' };
    const freq = bookmarkTokenFreq(doc);
    expect(freq.get('time')).toBe(1);
    const cloud = new Map(wordCloudFrequencies([{ ...doc }]));
    expect(cloud.has('time')).toBe(false);
    expect(cloud.get('management')).toBe(1);
  });
});
