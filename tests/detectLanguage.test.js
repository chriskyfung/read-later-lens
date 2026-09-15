import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../src/analytics/detectLanguage.js';

describe('detectLanguage', () => {
  it('defaults to en for empty input', () => {
    expect(detectLanguage('')).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
    expect(detectLanguage(null)).toBe('en');
  });

  it('detects en for plain latin text', () => {
    expect(detectLanguage('Hello world, this is plain english.')).toBe('en');
  });

  it('detects zh when more than 3 Han characters are present', () => {
    expect(detectLanguage('你好世界')).toBe('zh');
    expect(detectLanguage('你好世界測試內容')).toBe('zh');
  });

  it('detects ja when more than 3 kana characters are present', () => {
    expect(detectLanguage('こんにちは')).toBe('ja');
    expect(detectLanguage('カタカナテスト')).toBe('ja');
  });

  it('treats exactly 3 matches as not enough (boundary)', () => {
    expect(detectLanguage('你好世')).toBe('en');
    expect(detectLanguage('こんに')).toBe('en');
  });

  it('prefers ja over zh when both are present', () => {
    expect(detectLanguage('你好世界 こんにちは')).toBe('ja');
  });
});
