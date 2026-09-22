import { describe, it, expect } from 'vitest';
import { normalizeFields, normalizeTags } from '../src/model/normalize.js';

describe('normalizeFields', () => {
  it('prefers canonical id and aliases', () => {
    expect(normalizeFields({ id: 42, title: 'T', url: 'u' }, 0).id).toBe('42');
    expect(normalizeFields({ bookmark_id: 'b1', title: 'T', url: 'u' }, 0).id).toBe('b1');
    expect(normalizeFields({ uid: 'u1', title: 'T', url: 'u' }, 0).id).toBe('u1');
  });

  it('falls back to Date.now() + index when no id alias is present', () => {
    const before = Date.now();
    const r = normalizeFields({ title: 'T', url: 'u' }, 7);
    const after = Date.now();
    expect(Number(r.id)).toBeGreaterThanOrEqual(before + 7);
    expect(Number(r.id)).toBeLessThanOrEqual(after + 7);
  });

  it('honours an explicit fallbackId', () => {
    expect(normalizeFields({}, 0, 'fb').id).toBe('fb');
  });

  it('resolves title/url/preview/content aliases', () => {
    const r = normalizeFields({ name: 'N', link: 'L', description: 'D', content: 'C' }, 0);
    expect(r.title).toBe('N');
    expect(r.url).toBe('L');
    expect(r.preview).toBe('D');
    expect(r.content).toBe('C');

    expect(normalizeFields({ original_url: 'ou' }, 0).url).toBe('ou');
    expect(normalizeFields({ excerpt: 'ex' }, 0).preview).toBe('ex');
    expect(normalizeFields({ summary: 'sm' }, 0).preview).toBe('sm');
  });

  it('treats empty strings as missing so aliases win (monolith parity)', () => {
    expect(normalizeFields({ title: '', name: 'N' }, 0).title).toBe('N');
    expect(normalizeFields({ url: '', link: 'L' }, 0).url).toBe('L');
    expect(normalizeFields({ article_preview: '', description: 'D' }, 0).preview).toBe('D');
    expect(normalizeFields({ content: '', description: 'D' }, 0).content).toBe('D');
  });

  it('content falls back to the resolved preview', () => {
    expect(normalizeFields({ summary: 'sm' }, 0).content).toBe('sm');
    expect(normalizeFields({ description: 'D' }, 0).content).toBe('D');
  });

  it('falls back to defaults when missing', () => {
    expect(normalizeFields({}, 0).title).toBe('Untitled Article');
    expect(normalizeFields({}, 0).url).toBe('#');
    expect(normalizeFields({}, 0).preview).toBe('');
    expect(normalizeFields({}, 0).content).toBe('');
  });
});

describe('normalizeTags', () => {
  it('returns [] for falsy input', () => {
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags('')).toEqual([]);
    expect(normalizeTags(0)).toEqual([]);
    expect(normalizeTags(false)).toEqual([]);
  });

  it('passes arrays through untouched (no trimming/filtering)', () => {
    const arr = ['a', ' b ', '', 'c'];
    expect(normalizeTags(arr)).toBe(arr);
    expect(normalizeTags(['a', ' b '])).toEqual(['a', ' b ']);
  });

  it('splits strings strictly on commas, preserving whitespace', () => {
    expect(normalizeTags('foo, bar baz,q')).toEqual(['foo', ' bar baz', 'q']);
    expect(normalizeTags('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps whitespace-only strings as a single element (truthy input)', () => {
    expect(normalizeTags('   ')).toEqual(['   ']);
  });
});
