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
    // Not a leading prefix - deliberately untouched:
    expect(extractDomain('https://notwww.example.com/a')).toBe('notwww.example.com');
    expect(extractDomain('https://sub.www.example.com/a')).toBe('sub.www.example.com');
    expect(extractDomain('https://hostwww.example.com/a')).toBe('hostwww.example.com');
    expect(extractDomain('http://www2.example.com/a')).toBe('www2.example.com');
  });

  it('keeps other punctuation intact', () => {
    expect(extractDomain('https://www.example.com/a?b=c#d')).toBe('example.com');
  });

  it('keeps empty hostnames as the empty string', () => {
    expect(extractDomain('mailto:a@b.com')).toBe('');
    expect(extractDomain('https://')).toBe('');
  });
});
