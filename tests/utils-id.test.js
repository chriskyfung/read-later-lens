import { describe, it, expect } from 'vitest';
import { newFileId } from '../src/utils/id.js';

const UUID_RE = /^file_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newFileId', () => {
  it('mints a file_-prefixed v4 UUID', () => {
    expect(newFileId()).toMatch(UUID_RE);
  });

  it('mints a distinct id on every call', () => {
    const ids = new Set([newFileId(), newFileId(), newFileId()]);
    expect([...ids][0]).toMatch(UUID_RE);
    expect(ids.size).toBe(3);
  });
});
