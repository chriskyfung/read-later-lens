import { describe, it, expect, vi } from 'vitest';
import { initImporter } from './deps.js';

describe('initImporter', () => {
  it('initializes the importer state without throwing', () => {
    expect(() => initImporter({ persistAndRender: vi.fn(), render: vi.fn() })).not.toThrow();
  });
});
