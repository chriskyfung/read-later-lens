/**
 * @fileoverview Unit tests for the persisted-source projection.
 *
 * `tests/store.test.js` covers the persistence behaviour end to end; this file
 * covers the pure projection on its own — the rule that decides what actually
 * reaches the disk, which was previously only readable inside `saveState()`.
 */
import { describe, it, expect } from 'vitest';

import { toPersistedSources } from '../src/core/store/serialize.js';

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
