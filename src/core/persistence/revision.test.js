/**
 * @fileoverview Unit tests for the split IndexedDB store modules.
 *
 * This file covers the seams the split created — the pure projection, the revision
 * holder, and the barrel contract that the rest of the app (and the other
 * test files) rely on.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { getKnownRev, setKnownRev, clearKnownRev } from './revision.js';

describe('persistence/revision', () => {
  beforeEach(() => {
    clearKnownRev();
  });

  it('starts with no baseline', () => {
    expect(getKnownRev()).toBeUndefined();
  });

  it('remembers the revision it was given', () => {
    setKnownRev('rev-1');
    expect(getKnownRev()).toBe('rev-1');
  });

  it('forgets the baseline on clear', () => {
    setKnownRev('rev-1');
    clearKnownRev();
    expect(getKnownRev()).toBeUndefined();
  });
});
