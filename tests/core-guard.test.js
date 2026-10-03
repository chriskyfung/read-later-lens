/**
 * @fileoverview The one cross-tab gate every destructive action calls.
 *
 * The probe itself (IndexedDB revision comparison) is covered in
 * `store.test.js`; this file pins `stateStillFresh`'s contract on top of it:
 * refuse-and-toast when stale, and fail OPEN on any probe error — a guard must
 * never be the reason an action cannot run, because `saveState()` re-checks
 * inside its writing transaction and cannot be skipped.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ probe: vi.fn(), showToast: vi.fn() }));

vi.mock('../src/core/store.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStateFresh: () => h.probe(),
}));

vi.mock('../src/utils/dom.js', async (importOriginal) => ({
  ...(await importOriginal()),
  showToast: h.showToast,
}));

const { stateStillFresh, STALE_STATE_MESSAGE } = await import('../src/core/guard.js');

describe('stateStillFresh', () => {
  beforeEach(() => {
    h.probe.mockReset();
    h.showToast.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('lets the action proceed, silently, while this tab is current', async () => {
    h.probe.mockResolvedValue(true);

    expect(await stateStillFresh()).toBe(true);

    expect(h.showToast).not.toHaveBeenCalled();
  });

  it('refuses and shows the shared message when another tab has written', async () => {
    h.probe.mockResolvedValue(false);

    expect(await stateStillFresh()).toBe(false);

    expect(h.showToast).toHaveBeenCalledTimes(1);
    expect(h.showToast).toHaveBeenCalledWith(STALE_STATE_MESSAGE);
  });

  it('fails open when the probe rejects, because saveState() still guards the write', async () => {
    h.probe.mockRejectedValue(new Error('IndexedDB unavailable'));

    expect(await stateStillFresh()).toBe(true);

    expect(h.showToast).not.toHaveBeenCalled();
  });

  it('fails open when the probe throws synchronously', async () => {
    h.probe.mockImplementation(() => {
      throw new Error('unexpected');
    });

    expect(await stateStillFresh()).toBe(true);
  });
});
