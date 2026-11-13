import { describe, it, expect, vi } from 'vitest';
import { createUniqueSourceName, buildImportedMessage, buildBatchSummary } from './messages.js';

describe('createUniqueSourceName', () => {
  it('adds a suffix with timestamp to extension-less names', () => {
    const originalDateNow = Date.now;
    Date.now = vi.fn(() => 1700000000000);
    try {
      const name = createUniqueSourceName('file', 'csv');
      expect(name).toBe('file_1700000000000');
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('adds _1 suffix when existing name collides', () => {
    const originalDateNow = Date.now;
    Date.now = vi.fn(() => 1700000000000);
    try {
      // Pass existing name that collates with the generated candidate
      const name = createUniqueSourceName('file', ['file_1700000000000']);
      expect(name).toBe('file_1700000000000_1');
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('preserves extension when original name has one', () => {
    const originalDateNow = Date.now;
    Date.now = vi.fn(() => 1700000000000);
    try {
      const name = createUniqueSourceName('file.csv', []);
      expect(name).toBe('file_1700000000000.csv');
    } finally {
      Date.now = originalDateNow;
    }
  });
});

describe('buildImportedMessage', () => {
  it('includes skipped parse rows when present', () => {
    const message = buildImportedMessage('test.csv', 0, 5, 3);
    expect(message).toContain('3 列解析失敗');
  });

  it('includes droppedNoUrl when present', () => {
    const message = buildImportedMessage('test.csv', 0, 5, 0, 2);
    expect(message).toContain('2 筆缺少網址');
  });

  it('handles count zero with no other parts', () => {
    const message = buildImportedMessage('test.csv', 0, 0, 0);
    expect(message).toBe('已載入檔案: test.csv，但未偵測到任何書籤');
  });

  it('handles non-zero count with no gaps', () => {
    const message = buildImportedMessage('test.csv', 0, 5, 0, 0);
    expect(message).toBe('已成功載入檔案: test.csv');
  });

  it('includes note when provided', () => {
    const message = buildImportedMessage('test.csv', 0, 5, 0, 0, 'sanity check');
    expect(message).toContain('sanity check');
  });
});

describe('buildBatchSummary', () => {
  it('summarizes imported files with gaps', () => {
    const outcomes = [
      {
        status: 'imported',
        finalName: 'a.csv',
        count: 3,
        skipped: 1,
        droppedNoUrl: 0,
        displaced: 0,
      },
      {
        status: 'imported',
        finalName: 'b.csv',
        count: 2,
        skipped: 0,
        droppedNoUrl: 1,
        displaced: 0,
      },
    ];

    const summary = buildBatchSummary(outcomes);
    expect(summary).toContain('已成功載入 2 個檔案');
    expect(summary).toContain('共 1 列解析失敗');
    expect(summary).toContain('共 1 筆缺少網址已略過');
  });

  it('names failing files when present', () => {
    const outcomes = [
      {
        status: 'failed',
        finalName: 'bad.txt',
        message: '格式不支援',
        reason: '格式不支援',
      },
    ];

    const summary = buildBatchSummary(outcomes);
    expect(summary).toContain('bad.txt');
    expect(summary).toContain('格式不支援');
  });

  it('collapses long failure list to a count', () => {
    const outcomes = Array.from({ length: 5 }, (_, i) => ({
      status: 'failed',
      finalName: `file${i}.txt`,
      message: '格式不支援',
      reason: '格式不支援',
    }));

    const summary = buildBatchSummary(outcomes);
    expect(summary).toMatch(/5 個檔案均匯入失敗/);
  });

  it('handles empty outcomes', () => {
    const summary = buildBatchSummary([]);
    expect(summary).toBe('0 個檔案均匯入失敗：');
  });
});
