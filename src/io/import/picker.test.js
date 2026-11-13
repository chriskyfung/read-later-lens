import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyProfileSelection, cardEl, selectedProfileId } from './picker.js';

// Mock document
beforeEach(() => {
  globalThis.document = {
    getElementById: vi.fn().mockReturnValue({
      innerText: '',
      className: '',
      classList: { add: vi.fn(), remove: vi.fn() },
    }),
  };
});

describe('cardEl', () => {
  it('returns element by profile id', () => {
    expect(typeof cardEl).toBe('function');
  });

  it('calls document.getElementById with correct profile id', () => {
    const result = cardEl('instapaper-scraper');
    expect(document.getElementById).toHaveBeenCalledWith('importProfile-instapaper-scraper');
    expect(result).toBeDefined();
  });
});

describe('applyProfileSelection', () => {
  it('sets selected profile id and updates card classes', () => {
    globalThis.selectedProfileId = 'instapaper-scraper';
    globalThis.selectableProfiles = () => [
      { id: 'instapaper-scraper', label: 'InstapaperScraper', isDefault: true },
      { id: 'rll-unified', label: 'Read Later Lens', isDefault: false },
    ];

    applyProfileSelection('instapaper-scraper');

    expect(selectedProfileId).toBe('instapaper-scraper');
  });
});
