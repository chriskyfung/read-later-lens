import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { initSql } from '../src/io/sqlLoader.js';
import { setSQL, SQL } from '../src/core/state.js';

const fakeEngine = { Database: class {} };

beforeAll(() => {
  globalThis.window = globalThis.window || {};
});

beforeEach(() => {
  setSQL(null);
  globalThis.window.initSqlJs = undefined;
});

describe('initSql (src/io/sqlLoader.js)', () => {
  it('returns the cached engine without touching the CDN global', async () => {
    setSQL(fakeEngine);
    const loader = vi.fn(async () => fakeEngine);
    globalThis.window.initSqlJs = loader;

    const result = await initSql();

    expect(result).toBe(fakeEngine);
    expect(loader).not.toHaveBeenCalled();
    expect(SQL).toBe(fakeEngine);
  });

  it('initializes via window.initSqlJs with the CDN locateFile when state is empty', async () => {
    const loader = vi.fn(async () => fakeEngine);
    globalThis.window.initSqlJs = loader;

    const result = await initSql();

    expect(result).toBe(fakeEngine);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(SQL).toBe(fakeEngine);
    const [{ locateFile }] = loader.mock.calls[0];
    expect(locateFile('sql-wasm.wasm')).toBe(
      'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm'
    );
  });

  it('is idempotent — the CDN global runs exactly once', async () => {
    const loader = vi.fn(async () => fakeEngine);
    globalThis.window.initSqlJs = loader;

    const first = await initSql();
    const second = await initSql();

    expect(first).toBe(fakeEngine);
    expect(second).toBe(fakeEngine);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
