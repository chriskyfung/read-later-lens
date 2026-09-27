import { describe, it, expect } from 'vitest';
import PapaReal from 'papaparse';
import {
  hardenCsvValue,
  hardenRecordForCsv,
  hardenRecordsForCsv,
  captureCsvDialect,
  csvUnparseConfig,
} from '../src/utils/csv.js';

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

  it('carries a key named after an Object.prototype member through as a real key', () => {
    // The clone must be a clone: a `__proto__` column assigned onto a plain {}
    // hits the inherited accessor and is lost, so the header row the user still
    // has would quietly lose a column at the last step before writing.
    const hardened = hardenRecordForCsv(JSON.parse('{"id":"1","__proto__":"=1+1"}'));

    expect(Object.keys(hardened)).toEqual(['id', '__proto__']);
    expect(Object.getOwnPropertyDescriptor(hardened, '__proto__').value).toBe("'=1+1");
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

describe('captureCsvDialect', () => {
  it('records the delimiter and line terminator PapaParse observed', () => {
    expect(captureCsvDialect({ delimiter: ';', linebreak: '\n' })).toEqual({
      delimiter: ';',
      linebreak: '\n',
    });
  });

  it('reports nothing when the parse described no dialect', () => {
    // `null` is the same "unknown, use the default" signal `csvColumns: null`
    // carries, so an unreadable meta can never be mistaken for a real dialect.
    expect(captureCsvDialect(undefined)).toBeNull();
    expect(captureCsvDialect(null)).toBeNull();
    expect(captureCsvDialect({})).toBeNull();
  });

  it('rejects a delimiter no consumer could read back', () => {
    // Papa validates the delimiter on the *parse* side only, so an observed value
    // handed straight back to unparse would be trusted by nothing at all.
    for (const delimiter of ['\r', '\n', '"', '﻿', ';;', '', undefined, 44]) {
      expect(captureCsvDialect({ delimiter, linebreak: '\n' })).toEqual({ linebreak: '\n' });
    }
  });

  it('rejects the control characters Papa guesses as a last resort', () => {
    // `\x1e`/`\x1f` are faithful to a file nothing can read, and Papa emits them
    // when it cannot tell one field from the next.
    expect(captureCsvDialect({ delimiter: '\x1e', linebreak: '\r\n' })).toEqual({
      linebreak: '\r\n',
    });
    expect(captureCsvDialect({ delimiter: '\x00' })).toBeNull();
  });

  it('rejects a line terminator that is not one a consumer expects', () => {
    for (const linebreak of ['\n\n', '\u2028', undefined, 10]) {
      expect(captureCsvDialect({ delimiter: ';', linebreak })).toEqual({ delimiter: ';' });
    }
  });

  it('keeps the half of a dialect that is usable', () => {
    // Losing both would be a worse answer than losing one: a `;` file whose
    // terminator was unreadable can still round-trip its separator.
    expect(captureCsvDialect({ delimiter: ';', linebreak: 'bogus' })).toEqual({ delimiter: ';' });
    expect(captureCsvDialect({ delimiter: 'bogus', linebreak: '\n' })).toEqual({ linebreak: '\n' });
  });

  it('accepts the RFC 4180 baseline and a tab source', () => {
    expect(captureCsvDialect({ delimiter: ',', linebreak: '\r\n' })).toEqual({
      delimiter: ',',
      linebreak: '\r\n',
    });
    expect(captureCsvDialect({ delimiter: '\t', linebreak: '\n' })).toEqual({
      delimiter: '\t',
      linebreak: '\n',
    });
  });

  it('records what the real parser reports, not a hand-written meta', () => {
    // Every case above feeds `captureCsvDialect` a literal, which makes them a
    // statement about our own validation and nothing more. At runtime the meta
    // comes from Papa, so the field names this reads are a contract with the
    // library: a build that stopped reporting `linebreak` would leave this suite
    // green while an LF source silently came back CRLF in the browser.
    //
    // The options are the importer's own, and the fixture is two columns wide on
    // purpose. Papa accepts a guessed delimiter only when its average field count
    // clears 1.99, and `skipEmptyLines: true` is what lets a two-column `;` file
    // that ends in a newline clear it: the empty row Papa sees there otherwise
    // drags the average under the bar, every candidate is rejected, and Papa
    // falls back to `,` in `meta.delimiter` as though it had detected one. The
    // source would then come back comma-delimited, so the coupling between that
    // flag and this result is pinned here rather than left to chance.
    const meta = PapaReal.parse('id;title\n1;a\n2;b\n', {
      header: true,
      skipEmptyLines: true,
    }).meta;

    expect(captureCsvDialect(meta)).toEqual({ delimiter: ';', linebreak: '\n' });
  });

  it('takes the ending of the first line break when a file mixes them', () => {
    // Papa returns LF whenever the first line break is LF, so the *minority*
    // ending can win; only CR-vs-CRLF falls back to a majority. The README
    // documents this rule, and this is what keeps the rule true of the library
    // the app actually loads.
    const options = { header: true, skipEmptyLines: true };

    expect(captureCsvDialect(PapaReal.parse('id,title\n1,a\r\n2,b\r\n', options).meta)).toEqual({
      delimiter: ',',
      linebreak: '\n',
    });
    expect(captureCsvDialect(PapaReal.parse('id,title\r\n1,a\r\n2,b\r\n', options).meta)).toEqual({
      delimiter: ',',
      linebreak: '\r\n',
    });
  });
});

describe('csvUnparseConfig', () => {
  it('falls back to RFC 4180 for an unknown dialect', () => {
    for (const dialect of [null, undefined, {}]) {
      expect(csvUnparseConfig(dialect)).toEqual({ delimiter: ',', newline: '\r\n' });
    }
  });

  it('completes a half-recorded dialect rather than leaving Papa to guess', () => {
    expect(csvUnparseConfig({ delimiter: ';' })).toEqual({ delimiter: ';', newline: '\r\n' });
    expect(csvUnparseConfig({ linebreak: '\n' })).toEqual({ delimiter: ',', newline: '\n' });
  });

  it('passes a full dialect through, renaming the terminator to the unparse option', () => {
    expect(csvUnparseConfig({ delimiter: '\t', linebreak: '\r' })).toEqual({
      delimiter: '\t',
      newline: '\r',
    });
  });

  it('re-validates at the boundary, so a value that skipped capture cannot emit garbage', () => {
    // Nothing produces such a record today, which is exactly why the check has
    // to live here rather than in the one place that happens to validate now:
    // Papa validates no delimiter on the unparse side, so an unrejected value
    // would reach the file writer untouched. A dropped-to-RFC answer is a
    // fidelity loss; a `\n` delimiter is a file no consumer can read.
    for (const delimiter of ['\n', '\x1e', '"', ';;', 44]) {
      expect(csvUnparseConfig({ delimiter, linebreak: '\r\n' })).toEqual({
        delimiter: ',',
        newline: '\r\n',
      });
    }
    expect(csvUnparseConfig({ delimiter: ';', linebreak: '\n\n' })).toEqual({
      delimiter: ';',
      newline: '\r\n',
    });
    // Not an object at all — a shape no capture could produce, so the guard
    // cannot be a property access that throws instead of a fallback.
    expect(csvUnparseConfig(';')).toEqual({ delimiter: ',', newline: '\r\n' });
  });
});
