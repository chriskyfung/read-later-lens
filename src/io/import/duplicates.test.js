import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  duplicatePromptReady,
  findDuplicateSourceId,
  waitForDuplicateResolution,
} from './duplicates.js';
import { setSourceFiles } from '@/core/state';

// Mock document.getElementById for duplicatePromptReady tests
beforeEach(() => {
  globalThis.document = {
    getElementById: vi.fn(),
  };
});

describe('findDuplicateSourceId', () => {
  it('returns null when no source files exist', () => {
    setSourceFiles(new Map());
    expect(findDuplicateSourceId('any.csv')).toBeNull();
  });

  it('returns source id when matching source file name exists', () => {
    setSourceFiles(
      new Map([['my-id', { id: 'my-id', name: 'test.csv', type: 'csv', originalData: '' }]]),
    );
    expect(findDuplicateSourceId('test.csv')).toBe('my-id');
    expect(findDuplicateSourceId('other.csv')).toBeNull();
  });
});

describe('duplicatePromptReady', () => {
  it('returns true when all prompt IDs exist', () => {
    globalThis.document.getElementById = vi.fn().mockImplementation((id) => {
      const existing = new Set([
        'duplicateModal',
        'duplicateFileText',
        'dupBtnOverwrite',
        'dupBtnKeepBoth',
        'dupBtnCancel',
      ]);
      return existing.has(id) ? { innerText: '', className: '' } : null;
    });
    expect(duplicatePromptReady()).toBe(true);
  });

  it('returns false when a prompt ID is missing', () => {
    globalThis.document.getElementById = vi.fn().mockImplementation((id) => {
      const existing = new Set(['duplicateModal', 'duplicateFileText']); // missing others
      return existing.has(id) ? { innerText: '', className: '' } : null;
    });
    expect(duplicatePromptReady()).toBe(false);
  });
});

describe('waitForDuplicateResolution', () => {
  it('function exists and is callable', () => {
    expect(typeof waitForDuplicateResolution).toBe('function');
  });
});
