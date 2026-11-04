import { describe, it, expect } from 'vitest';
import { newFileId } from 'src/utils/id.js';
import { extractDomain } from 'src/utils/url.js';

describe('src path alias', () => {
  it('resolves a module imported through the src alias', () => {
    expect(newFileId()).toMatch(/^file_[0-9a-f]{8}-/);
  });

  it('resolves a nested module imported through the src alias', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
  });
});
