import { describe, it, expect } from 'vitest';
import { hardenCsvValue, hardenRecordForCsv, hardenRecordsForCsv } from '../src/utils/csv.js';

describe('hardenCsvValue', () => {
  it('prefixes every character a spreadsheet would evaluate', () => {
    for (const value of ['=SUM(1,2)', '+2+5', '-1+1', '@SUM(A1)', '\tcmd', '\rcmd']) {
      expect(hardenCsvValue(value)).toBe(`'${value}`);
    }
  });

  it('neutralizes a DDE payload', () => {
    expect(hardenCsvValue("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
  });

  it('leaves inert values untouched', () => {
    for (const value of ['', 'Read Later Lens', 'https://example.com/a?b=1', '2 + 2 = 4']) {
      expect(hardenCsvValue(value)).toBe(value);
    }
  });

  it('only checks the first character, matching the spreadsheet attack surface', () => {
    // Leading text means the cell is never evaluated, so it must not be mangled.
    expect(hardenCsvValue('note: =SUM(1)')).toBe('note: =SUM(1)');
  });

  it('passes through non-string values', () => {
    for (const value of [0, 42, true, false, null, undefined, NaN, new Date(0)]) {
      expect(hardenCsvValue(value)).toBe(value);
    }
  });

  it('does not double-prefix an already-quoted value', () => {
    expect(hardenCsvValue("'=SUM(1)")).toBe("'=SUM(1)");
  });
});

describe('hardenRecordForCsv', () => {
  it('hardens text fields and leaves identifiers alone', () => {
    const hardened = hardenRecordForCsv({
      id: '123',
      title: '=HYPERLINK("http://evil","click")',
      url: 'https://example.com',
      article_preview: '-1+1',
      deleted_at: null,
    });

    expect(hardened).toEqual({
      id: '123',
      title: '\'=HYPERLINK("http://evil","click")',
      url: 'https://example.com',
      article_preview: "'-1+1",
      deleted_at: null,
    });
  });

  it('hardens a tags array only when the joined cell itself is dangerous', () => {
    // A spreadsheet evaluates one cell, so "ok,=SUM(1)" is already inert and must
    // round-trip untouched — hardening it would silently corrupt the tag on
    // re-import without removing any real attack surface.
    expect(hardenRecordForCsv({ tags: ['ok', '=SUM(1)'] }).tags).toEqual(['ok', '=SUM(1)']);
    // But a cell whose first character is a formula trigger must be neutralized.
    expect(hardenRecordForCsv({ tags: ['=SUM(1)', 'ok'] }).tags).toBe("'=SUM(1),ok");
  });

  it('leaves an empty array alone', () => {
    const empty = [];
    expect(hardenCsvValue(empty)).toBe(empty);
  });

  it('does not mutate the source record', () => {
    const record = { title: '=SUM(1)', tags: ['=SUM(2)'] };
    const snapshot = JSON.parse(JSON.stringify(record));

    hardenRecordForCsv(record);

    expect(record).toEqual(snapshot);
  });

  it('preserves a completely safe record unchanged', () => {
    const record = { id: '1', title: 'Clean', url: 'https://a.com', tags: ['news', 'tech'] };
    expect(hardenRecordForCsv(record)).toEqual(record);
  });
});

describe('hardenRecordsForCsv', () => {
  it('hardens every record and returns a new array', () => {
    const records = [
      { id: '1', title: '=1+1' },
      { id: '2', title: 'safe' },
    ];
    const hardened = hardenRecordsForCsv(records);

    expect(hardened).toEqual([
      { id: '1', title: "'=1+1" },
      { id: '2', title: 'safe' },
    ]);
    expect(hardened[0]).not.toBe(records[0]);
    expect(records[0].title).toBe('=1+1');
  });

  it('handles an empty export without throwing', () => {
    expect(hardenRecordsForCsv([])).toEqual([]);
  });
});
