import { describe, it, expect } from 'vitest';
import {
  checkImport,
  defaultProfileId,
  profileLabel,
  selectableProfiles,
  OFFICIAL_CSV_UNSUPPORTED_MESSAGE,
} from '../src/providers/profiles.js';

describe('profile descriptors', () => {
  it('preselects InstapaperScraper and keeps roadmap cards out of the selectable list', () => {
    expect(defaultProfileId()).toBe('instapaper-scraper');
    expect(selectableProfiles().map((p) => p.id)).toEqual(['instapaper-scraper', 'rll-unified']);
  });

  it('exposes zh-TW labels for messages', () => {
    expect(profileLabel('rll-unified')).toBe('Read Later Lens 統一匯出');
    expect(profileLabel('missing-id')).toBe('missing-id');
  });
});

describe('checkImport — official Instapaper CSV (blocked)', () => {
  // Verbatim header of the official account export.
  const OFFICIAL = ['URL', 'Title', 'Selection', 'Folder', 'Timestamp', 'Tags'];

  it('blocks the official header under either profile with actionable guidance', () => {
    for (const profile of ['instapaper-scraper', 'rll-unified']) {
      const result = checkImport(profile, { csvHeaders: OFFICIAL });
      expect(result.verdict).toBe('unsupported');
      expect(result.message).toBe(OFFICIAL_CSV_UNSUPPORTED_MESSAGE);
      expect(result.message).toContain('InstapaperScraper');
    }
  });

  it('matches case-insensitively (BOM + lowercase headers still block)', () => {
    const result = checkImport('instapaper-scraper', {
      csvHeaders: ['\uFEFFurl', 'title', 'folder', 'timestamp'],
    });
    expect(result.verdict).toBe('unsupported');
  });

  it('does NOT block near-miss CSVs that merely share url/title/timestamp', () => {
    const result = checkImport('instapaper-scraper', {
      csvHeaders: ['url', 'title', 'timestamp'],
    });
    expect(result.verdict).toBe('ok');
  });
});

describe('checkImport — profile/column mismatch (warn only)', () => {
  it('warns when unified columns arrive under the InstapaperScraper profile', () => {
    const result = checkImport('instapaper-scraper', {
      csvHeaders: ['id', 'title', 'url', 'source_file_id', 'detected_language'],
    });
    expect(result.verdict).toBe('mismatch');
    expect(result.suggestedProfileId).toBe('rll-unified');
    expect(result.message).toContain('Read Later Lens 統一匯出');
  });

  it('warns when scraper columns arrive under the unified profile', () => {
    const result = checkImport('rll-unified', { csvHeaders: ['id', 'title', 'url'] });
    expect(result.verdict).toBe('mismatch');
    expect(result.suggestedProfileId).toBe('instapaper-scraper');
    expect(result.message).toContain('InstapaperScraper');
  });

  it('runs the same fingerprint over JSON record keys', () => {
    expect(checkImport('instapaper-scraper', { jsonKeys: ['id', 'title', 'url'] }).verdict).toBe(
      'ok',
    );
    expect(
      checkImport('instapaper-scraper', { jsonKeys: ['id', 'url', 'source_file_id'] }).verdict,
    ).toBe('mismatch');
  });

  it('recognises the versioned unified envelope exactly, even when empty', () => {
    const envelope = { format: 'read-later-lens', version: 1, bookmarks: [] };
    const mismatch = checkImport('instapaper-scraper', { jsonRoot: envelope, jsonKeys: [] });
    expect(mismatch.verdict).toBe('mismatch');
    expect(mismatch.suggestedProfileId).toBe('rll-unified');

    const exact = checkImport('rll-unified', { jsonRoot: envelope, jsonKeys: [] });
    expect(exact.verdict).toBe('ok');

    // Plain arrays / foreign objects never trip the envelope branch.
    expect(checkImport('instapaper-scraper', { jsonRoot: [{ id: 1 }], jsonKeys: ['id'] })).toEqual({
      verdict: 'ok',
    });
    expect(
      checkImport('instapaper-scraper', { jsonRoot: { format: 'other-tool' }, jsonKeys: [] }),
    ).toEqual({ verdict: 'ok' });
  });
});

describe('checkImport — unknown sources (accept)', () => {
  it('accepts headers it cannot fingerprint', () => {
    expect(checkImport('instapaper-scraper', { csvHeaders: ['link', 'name'] })).toEqual({
      verdict: 'ok',
    });
  });

  it('accepts empty samples (headerless / no rows yet)', () => {
    expect(checkImport('instapaper-scraper')).toEqual({ verdict: 'ok' });
    expect(checkImport('instapaper-scraper', { csvHeaders: [] })).toEqual({ verdict: 'ok' });
    expect(checkImport('instapaper-scraper', { jsonKeys: [] })).toEqual({ verdict: 'ok' });
  });
});
