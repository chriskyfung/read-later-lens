import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  persistCore,
  persistAndRender,
  persistAfterAction,
  persistAfterActionFireAndForget,
  PERSIST_WRITE_FAILED_MESSAGE,
} from './persist.js';
import { saveState } from '@/core/persistence';
import { updateStorageUsageUI } from '@/features/sidebar';
import { showToast } from '@/utils/dom';

vi.mock('@/core/persistence', () => ({
  saveState: vi.fn(async () => ({ persisted: true, conflict: false })),
}));
vi.mock('@/features/sidebar', () => ({
  updateStorageUsageUI: vi.fn(async () => {}),
}));
vi.mock('@/utils/dom', () => ({
  showToast: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveState).mockResolvedValue({ persisted: true, conflict: false });
  vi.mocked(updateStorageUsageUI).mockResolvedValue(undefined);
});

describe('persistCore', () => {
  it('reports a successful write', async () => {
    await expect(persistCore()).resolves.toEqual({ persisted: true, conflict: false });
  });

  it('reports a cross-tab conflict', async () => {
    vi.mocked(saveState).mockResolvedValue({ persisted: false, conflict: true });
    await expect(persistCore()).resolves.toEqual({ persisted: false, conflict: true });
  });

  it('never rejects when the save throws', async () => {
    vi.mocked(saveState).mockRejectedValue(new Error('quota'));
    await expect(persistCore()).resolves.toEqual({ persisted: false, conflict: false });
  });
});

describe('persistAndRender', () => {
  it('saves, then invokes the injected render callback', async () => {
    const render = vi.fn();
    const result = await persistAndRender(render);

    expect(saveState).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledExactlyOnceWith();
    expect(result).toEqual({ persisted: true, rendered: true, conflict: false });
  });

  it('reports rendered:false when the injected render throws', async () => {
    const render = vi.fn(() => {
      throw new Error('render boom');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await persistAndRender(render);

    expect(result).toEqual({ persisted: true, rendered: false, conflict: false });
    warn.mockRestore();
  });
});

describe('persistAfterAction', () => {
  it('stays silent on a clean write', async () => {
    await persistAfterAction();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('toasts the failure message when the write neither persists nor conflicts', async () => {
    vi.mocked(saveState).mockResolvedValue({ persisted: false, conflict: false });
    await persistAfterAction();
    expect(showToast).toHaveBeenCalledWith(PERSIST_WRITE_FAILED_MESSAGE);
  });
});

describe('persistAfterActionFireAndForget', () => {
  it('returns optimistic success immediately without awaiting the save', async () => {
    const result = await persistAfterActionFireAndForget();
    expect(result).toEqual({ persisted: true, conflict: false });
  });
});
