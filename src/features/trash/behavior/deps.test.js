// @vitest-environment jsdom
/* global vi */

import { describe, it, expect } from 'vitest';
import { initTrashDeps, getDeps } from './deps.js';

describe('trash deps', () => {
  it('initTrashDeps merges injected deps', () => {
    const customRender = vi.fn();
    const deps = initTrashDeps({ render: customRender });
    expect(deps.persist).toBeDefined();
    expect(deps.render).toBe(customRender);
  });

  it('getDeps returns the current deps', () => {
    const deps = getDeps();
    expect(deps.persist).toBeDefined();
    expect(deps.render).toBeDefined();
  });
});
