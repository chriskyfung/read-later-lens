/**
 * @fileoverview Unit tests for the split IndexedDB store modules.
 *
 * `tests/store.test.js` covers the persistence behaviour end to end; this file
 * covers the seams the split created — the pure projection, the revision
 * holder, and the facade contract that the rest of the app (and the other
 * test files) rely on.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  DB_NAME,
  LEGACY_DB_NAME,
  STORE_NAME,
  DB_VERSION,
  REV_KEY,
} from '../src/core/store/constants.js';
import { toPersistedSources } from '../src/core/store/serialize.js';
import { getKnownRev, setKnownRev, clearKnownRev } from '../src/core/store/revision.js';

describe('store/constants', () => {
  it('pins the database identity and row keys', () => {
    expect(DB_NAME).toBe('ReadLaterLensDB');
    expect(LEGACY_DB_NAME).toBe('InstapaperBookmarkManagerDB');
    expect(STORE_NAME).toBe('app_state');
    expect(DB_VERSION).toBe(1);
    expect(REV_KEY).toBe('rev');
  });
});

describe('store/serialize', () => {
  it('projects a source into the persisted row shape', () => {
    const rows = toPersistedSources(
      new Map([
        [
          'f1',
          {
            id: 'f1',
            name: 'f.csv',
            type: 'csv',
            profile: 'instapaper',
            originalData: 'raw',
          },
        ],
      ]),
    );

    expect(rows).toEqual([
      {
        id: 'f1',
        name: 'f.csv',
        type: 'csv',
        profile: 'instapaper',
        originalData: 'raw',
        sqliteSchema: null,
        csvColumns: null,
        csvDialect: null,
      },
    ]);
  });

  it('keeps SQLite payloads in memory only, for both payload-bearing types', () => {
    const rows = toPersistedSources(
      new Map([
        [
          'f1',
          {
            id: 'f1',
            name: 'f.db',
            type: 'sqlite',
            profile: 'instapaper',
            originalData: 'binary-payload',
            sqliteSchema: { name: 't', columns: ['a'] },
          },
        ],
        [
          'f2',
          {
            id: 'f2',
            name: 'g.db',
            type: 'db',
            profile: 'instapaper',
            originalData: 'binary-payload',
          },
        ],
      ]),
    );

    expect(rows[0].originalData).toBeNull();
    expect(rows[1].originalData).toBeNull();
    // The observed table layout is small, so it IS persisted.
    expect(rows[0].sqliteSchema).toEqual({ name: 't', columns: ['a'] });
  });

  it('persists the payload of a non-payload-bearing source', () => {
    const rows = toPersistedSources(
      new Map([
        ['f1', { id: 'f1', name: 'f.csv', type: 'csv', profile: 'p', originalData: 'raw' }],
      ]),
    );

    expect(rows[0].originalData).toBe('raw');
  });

  it('persists the observed CSV layout so a reload does not have to guess', () => {
    const rows = toPersistedSources(
      new Map([
        [
          'f1',
          {
            id: 'f1',
            name: 'f.csv',
            type: 'csv',
            profile: 'p',
            originalData: 'raw',
            csvColumns: ['title', 'url'],
            csvDialect: { delimiter: ';', eol: '\n' },
          },
        ],
      ]),
    );

    expect(rows[0].csvColumns).toEqual(['title', 'url']);
    expect(rows[0].csvDialect).toEqual({ delimiter: ';', eol: '\n' });
  });

  it('does not mutate the source map it is given', () => {
    const source = { id: 'f1', name: 'f.csv', type: 'csv', profile: 'p', originalData: 'raw' };
    const map = new Map([['f1', source]]);

    toPersistedSources(map);

    expect(map.get('f1')).toBe(source);
    expect(source).not.toHaveProperty('csvColumns');
  });

  it('returns an empty array for an empty map', () => {
    expect(toPersistedSources(new Map())).toEqual([]);
  });
});

describe('store/revision', () => {
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

describe('store facade', () => {
  it('exposes the public API unchanged', async () => {
    const facade = await import('../src/core/store.js');

    for (const name of ['saveState', 'loadState', 'isStateFresh', 'getStorageUsage', 'closeDb']) {
      expect(typeof facade[name]).toBe('function');
    }
  });

  it('re-exports the very same functions the barrel provides', async () => {
    const facade = await import('../src/core/store.js');
    const barrel = await import('../src/core/store/index.js');

    expect(facade.saveState).toBe(barrel.saveState);
    expect(facade.loadState).toBe(barrel.loadState);
    expect(facade.isStateFresh).toBe(barrel.isStateFresh);
    expect(facade.getStorageUsage).toBe(barrel.getStorageUsage);
    expect(facade.closeDb).toBe(barrel.closeDb);
  });

  it('keeps isStateFresh spyable through the facade', async () => {
    // `views-header.test.js` and `core/guard.js` both reach the probe through
    // this module, so a spy installed on the facade must be the value the
    // implementation resolves to — i.e. the facade re-exports, never wraps.
    const facade = await import('../src/core/store.js');
    const probe = vi.spyOn(facade, 'isStateFresh').mockResolvedValue(false);

    try {
      expect(await facade.isStateFresh()).toBe(false);
      expect(probe).toHaveBeenCalled();
    } finally {
      probe.mockRestore();
    }
  });
});
