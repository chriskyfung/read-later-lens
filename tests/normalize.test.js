import { describe, it, expect } from 'vitest';
import { normalizeFields, normalizeTags, stableIdFromUrl } from '../src/model/normalize.js';

describe('normalizeFields', () => {
  it('prefers canonical id and aliases', () => {
    expect(normalizeFields({ id: 42, title: 'T', url: 'u' }, 0).id).toBe('42');
    expect(normalizeFields({ bookmark_id: 'b1', title: 'T', url: 'u' }, 0).id).toBe('b1');
    expect(normalizeFields({ uid: 'u1', title: 'T', url: 'u' }, 0).id).toBe('u1');
  });

  it('generates a stable URL-based id when no id alias is present', () => {
    const a = normalizeFields({ title: 'T', url: 'https://a.example.com/x' }, 0, undefined, 's1');
    const b = normalizeFields(
      { title: 'Other', url: 'https://a.example.com/x' },
      7,
      undefined,
      's1',
    );
    expect(a.id).toMatch(/^gen_[0-9a-f]{16}$/);
    // Same URL under the same source => same id regardless of title, index, or
    // call time, so re-importing an id-less file merges instead of duplicating.
    expect(a.id).toBe(b.id);

    const different = normalizeFields(
      { title: 'T', url: 'https://b.example.com/y' },
      0,
      undefined,
      's1',
    );
    expect(different.id).not.toBe(a.id);
  });

  it('scopes the URL hash to the source so two sources never collide', () => {
    const inF1 = normalizeFields(
      { title: 'T', url: 'https://a.example.com/x' },
      0,
      undefined,
      'f1',
    );
    const inF2 = normalizeFields(
      { title: 'T', url: 'https://a.example.com/x' },
      0,
      undefined,
      'f2',
    );
    // The unsalted collision made mergeBookmarks move the older record to the
    // newest source, silently decrementing the older folder's count.
    expect(inF1.id).not.toBe(inF2.id);
  });

  it('does not reproduce the legacy unsalted id when the source is omitted', () => {
    const withSource = normalizeFields({ url: 'https://a.example.com/x' }, 0, undefined, 'f1');
    const unsalted = normalizeFields({ url: 'https://a.example.com/x' }, 0);
    expect(unsalted.id).toMatch(/^gen_[0-9a-f]{16}$/);
    expect(unsalted.id).not.toBe(withSource.id);
    // The NUL separator is in the preimage even for an empty salt, so the
    // no-source path is not the legacy id either. Pinned literally so nobody
    // restores "legacy compatibility" by accident: pre-salt rows do not merge
    // on re-import, and the README documents that duplicate.
    expect(unsalted.id).not.toBe('gen_a30158530b5be715'); // legacy hash of this URL
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
