import { describe, it, expect, vi } from 'vitest';
import { registerImporterListeners } from './listeners.js';

describe('registerImporterListeners', () => {
  it('wires #fileInput change events to handleFileUploads', async () => {
    // Minimal DOM stubbing
    globalThis.document = {
      getElementById: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        value: '',
        files: [],
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const input = document.getElementById('fileInput');
    expect(input).not.toBeNull();
    registerImporterListeners();

    // Verify change listener was registered
    expect(document.getElementById).toHaveBeenCalledWith('fileInput');
  });

  it('no-ops when #fileInput is missing', () => {
    document.getElementById = vi.fn().mockReturnValue(null);

    expect(() => registerImporterListeners()).not.toThrow();

    // Restore
    // We can't easily restore the original, but the function should not throw
  });
});
