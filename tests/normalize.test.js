import { describe, it, expect } from 'vitest';
import { normalizeFields, normalizeTags, stableIdFromUrl } from '../src/model/normalize.js';

describe('normalizeFields', () => {
  it('prefers canonical id and aliases', () => {
    expect(normalizeFields({ id: 42, title: 'T', url: 'u' }, 0).id).toBe('42');
    expect(normalizeFields({ bookmark_id: 'b1', title: 'T', url: 'u' }, 0).id).toBe('b1');
    expect(normalizeFields({ uid: 'u1', title: 'T', url: 'u' }, 0).id).toBe('u1');
  });

  it('generates a stable URL-based id when no id alias is present', () => {
    const a = normalizeFields({ title: 'T', url: 'https://a.example.com/x' }, 0);
    const b = normalizeFields({ title: 'Other', url: 'https://a.example.com/x' }, 7);
    expect(a.id).toMatch(/^gen_[0-9a-f]{16}$/);
    // Same URL => same id regardless of title, index, or call time, so a
    // re-import of an id-less file merges instead of duplicating rows.
    expect(a.id).toBe(b.id);

    const different = normalizeFields({ title: 'T', url: 'https://b.example.com/y' }, 0);
    expect(different.id).not.toBe(a.id);
  });

  it('falls back to Date.now() + index only when there is neither id nor url', () => {
    const before = Date.now();
    const r = normalizeFields({ title: 'T' }, 7);
    const after = Date.now();
    expect(Number(r.id)).toBeGreaterThanOrEqual(before + 7);
    expect(Number(r.id)).toBeLessThanOrEqual(after + 7);
  });

  it('honours an explicit fallbackId over the stable hash', () => {
    expect(normalizeFields({}, 0, 'fb').id).toBe('fb');
    expect(normalizeFields({ url: 'https://a.example.com' }, 0, 'fb').id).toBe('fb');
  });

  it('resolves capitalized (case-variant) headers defensively', () => {
    const r = normalizeFields(
      { Title: 'Official', URL: 'https://official.example.com', Description: 'Body' },
      0,
    );
    expect(r.title).toBe('Official');
    expect(r.url).toBe('https://official.example.com');
    expect(r.preview).toBe('Body');
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

describe('stableIdFromUrl', () => {
  it('is deterministic and formatted as gen_ + 16 hex chars', () => {
    expect(stableIdFromUrl('https://example.com/a')).toBe(stableIdFromUrl('https://example.com/a'));
    expect(stableIdFromUrl('https://example.com/a')).toMatch(/^gen_[0-9a-f]{16}$/);
  });

  it('distinguishes different URLs', () => {
    expect(stableIdFromUrl('https://a.com')).not.toBe(stableIdFromUrl('https://b.com'));
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
