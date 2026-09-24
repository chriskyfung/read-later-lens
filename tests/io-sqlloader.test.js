import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setSQL, SQL } from '../src/core/state.js';

const fakeEngine = { Database: class {} };
const initSqlJs = vi.hoisted(() => vi.fn());
const wasmUrl = vi.hoisted(() => '/node_modules/sql.js/dist/sql-wasm.wasm');

vi.mock('sql.js', () => ({ default: initSqlJs }));
vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: wasmUrl }));

import { initSql } from '../src/io/sqlLoader.js';

beforeEach(() => {
  setSQL(null);
  initSqlJs.mockReset();
  initSqlJs.mockResolvedValue(fakeEngine);
});

describe('initSql (src/io/sqlLoader.js)', () => {
  it('returns the cached engine without initializing SQL.js again', async () => {
    setSQL(fakeEngine);

    const result = await initSql();

    expect(result).toBe(fakeEngine);
    expect(initSqlJs).not.toHaveBeenCalled();
    expect(SQL).toBe(fakeEngine);
  });

  it('initializes through the dependency with the Vite-bundled WASM URL', async () => {
    const result = await initSql();

    expect(result).toBe(fakeEngine);
    expect(initSqlJs).toHaveBeenCalledTimes(1);
    expect(SQL).toBe(fakeEngine);
    const [{ locateFile }] = initSqlJs.mock.calls[0];
    expect(locateFile('sql-wasm.wasm')).toBe(wasmUrl);
  });

  it('coalesces concurrent initialization and caches the completed engine', async () => {
    let finishInitialization;
    initSqlJs.mockReturnValue(
      new Promise((resolve) => {
        finishInitialization = () => resolve(fakeEngine);
      }),
    );

    const first = initSql();
    const second = initSql();
    finishInitialization();
    await expect(first).resolves.toBe(fakeEngine);
    await expect(second).resolves.toBe(fakeEngine);

    expect(initSqlJs).toHaveBeenCalledTimes(1);
    expect(SQL).toBe(fakeEngine);
  });

  it('allows a later attempt after initialization fails', async () => {
    initSqlJs.mockRejectedValueOnce(new Error('WASM unavailable'));

    await expect(initSql()).rejects.toThrow('WASM unavailable');
    await expect(initSql()).resolves.toBe(fakeEngine);
    expect(initSqlJs).toHaveBeenCalledTimes(2);
  });
});
