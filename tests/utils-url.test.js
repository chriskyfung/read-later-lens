import { describe, it, expect } from 'vitest';
import { extractDomain } from '../src/utils/url.js';

describe('extractDomain', () => {
  it('uses the default fallback when given an invalid URL', () => {
    expect(extractDomain('::::')).toBe('');
    expect(extractDomain('not a url', 'fallback')).toBe('fallback');
  });

  it('strips only a leading www. prefix', () => {
    expect(extractDomain('https://www.example.com/a')).toBe('example.com');
    expect(extractDomain('https://example.com/b')).toBe('example.com');
  });

  it('preserves the known first-occurrence quirk from the original call sites', () => {
    // NOTE: pinned on purpose — this is the OLD (buggy) semantics. The follow-up
    // fix commit flips these to anchored strip: a hostname containing 'www.'
    // anywhere is NOT mangled.
    expect(extractDomain('https://notwww.example.com/a')).toBe('notexample.com');
    expect(extractDomain('https://sub.www.example.com/a')).toBe('sub.example.com');
    expect(extractDomain('https://hostwww.example.com/a')).toBe('hostexample.com');
  });

  it('keeps empty hostnames as the empty string', () => {
    expect(extractDomain('mailto:a@b.com')).toBe('');
    expect(extractDomain('https://')).toBe('');
  });
});
