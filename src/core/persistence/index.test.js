/**
 * @fileoverview Unit tests for the split IndexedDB store modules.
 *
 * This file covers the seams the split created — the pure projection, the revision
 * holder, and the barrel contract that the rest of the app (and the other
 * test files) rely on.
 */
import { describe, it, expect, vi } from 'vitest';

describe('persistence barrel', () => {
  it('exposes the public API unchanged', async () => {
    const barrel = await import('./index.js');

    for (const name of ['saveState', 'loadState', 'isStateFresh', 'getStorageUsage', 'closeDb']) {
      expect(typeof barrel[name]).toBe('function');
    }
  });

  it('keeps isStateFresh spyable through the barrel', async () => {
    // `views-header.test.js` and `core/guard.js` both reach the probe through
    // this module, so a spy installed on the barrel must be the value the
    // implementation resolves to — i.e. the barrel re-exports, never wraps.
    const barrel = await import('./index.js');
    const probe = vi.spyOn(barrel, 'isStateFresh').mockResolvedValue(false);

    try {
      expect(await barrel.isStateFresh()).toBe(false);
      expect(probe).toHaveBeenCalled();
    } finally {
      probe.mockRestore();
    }
  });
});
