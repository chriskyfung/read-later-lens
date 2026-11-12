/**
 * @fileoverview Unit tests for the persistence constants.
 */

import { describe, it, expect } from 'vitest';

import { DB_NAME, LEGACY_DB_NAME, STORE_NAME, DB_VERSION, REV_KEY } from './constants.js';

describe('persistence/constants', () => {
  it('pins the database identity and row keys', () => {
    expect(DB_NAME).toBe('ReadLaterLensDB');
    expect(LEGACY_DB_NAME).toBe('InstapaperBookmarkManagerDB');
    expect(STORE_NAME).toBe('app_state');
    expect(DB_VERSION).toBe(1);
    expect(REV_KEY).toBe('rev');
  });
});
