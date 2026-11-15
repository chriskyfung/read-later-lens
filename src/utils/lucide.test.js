import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const lucideMock = vi.hoisted(() => {
  const base = {
    createIcons: vi.fn(),
    CircleQuestionMark: {},
    GraphStar: {},
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return undefined;
    },
  });
});

vi.mock('lucide', () => lucideMock);

import { createIcons } from 'lucide';
import { initializeLucideIcons, lazyInitializeLucideIcons } from './lucide.js';

const mockedCreateIcons = vi.mocked(createIcons);

beforeAll(() => {
  globalThis.document = globalThis.document || {};
});

beforeEach(() => {
  mockedCreateIcons.mockClear();
  lucideMock.CircleQuestionMark = {};
  lucideMock.GraphStar = {};
  delete lucideMock.UndefinedIcon;
});

// ---- initializeLucideIcons ------------------------------------------------

describe('initializeLucideIcons', () => {
  it('does nothing when icon map is empty', () => {
    initializeLucideIcons({});
    expect(mockedCreateIcons).not.toHaveBeenCalled();
  });

  it('calls createIcons with single icon', () => {
    const FakeIcon = {};
    initializeLucideIcons({ GraphStar: FakeIcon });
    expect(mockedCreateIcons).toHaveBeenCalledTimes(1);
    expect(mockedCreateIcons).toHaveBeenCalledWith({
      icons: { GraphStar: FakeIcon },
      root: document,
    });
  });

  it('calls createIcons with multiple icons', () => {
    const CircleQuestionMark = {};
    const GraphStar = {};
    initializeLucideIcons({ CircleQuestionMark, GraphStar });
    expect(mockedCreateIcons).toHaveBeenCalledTimes(1);
    expect(mockedCreateIcons).toHaveBeenCalledWith({
      icons: { CircleQuestionMark, GraphStar },
      root: document,
    });
  });

  it('uses custom root element', () => {
    const FakeIcon = {};
    const root = {};
    initializeLucideIcons({ GraphStar: FakeIcon }, root);
    expect(mockedCreateIcons).toHaveBeenCalledTimes(1);
    expect(mockedCreateIcons).toHaveBeenCalledWith({
      icons: { GraphStar: FakeIcon },
      root,
    });
  });

  it('is idempotent across repeated calls', () => {
    const FakeIcon = {};
    initializeLucideIcons({ GraphStar: FakeIcon });
    initializeLucideIcons({ GraphStar: FakeIcon });
    expect(mockedCreateIcons).toHaveBeenCalledTimes(2);
  });
});

// ---- lazyInitializeLucideIcons --------------------------------------------

describe('lazyInitializeLucideIcons', () => {
  it('does nothing when iconNames is empty', async () => {
    await lazyInitializeLucideIcons([]);
    expect(mockedCreateIcons).not.toHaveBeenCalled();
  });

  it('dynamically imports lucide and initializes valid icons', async () => {
    await lazyInitializeLucideIcons(['GraphStar']);
    expect(mockedCreateIcons).toHaveBeenCalledTimes(1);
    expect(mockedCreateIcons).toHaveBeenCalledWith({
      icons: { GraphStar: lucideMock.GraphStar },
      root: document,
    });
  });

  it('skips icons that are undefined in lucide', async () => {
    lucideMock.UndefinedIcon = undefined;
    await lazyInitializeLucideIcons(['UndefinedIcon']);
    expect(mockedCreateIcons).not.toHaveBeenCalled();
  });

  it('initializes only defined icons from mixed list', async () => {
    lucideMock.UndefinedIcon = undefined;
    await lazyInitializeLucideIcons(['CircleQuestionMark', 'UndefinedIcon', 'GraphStar']);
    expect(mockedCreateIcons).toHaveBeenCalledTimes(1);
    expect(mockedCreateIcons).toHaveBeenCalledWith({
      icons: {
        CircleQuestionMark: lucideMock.CircleQuestionMark,
        GraphStar: lucideMock.GraphStar,
      },
      root: document,
    });
  });

  it('uses custom root element', async () => {
    const root = {};
    await lazyInitializeLucideIcons(['GraphStar'], root);
    expect(mockedCreateIcons).toHaveBeenCalledTimes(1);
    expect(mockedCreateIcons).toHaveBeenCalledWith({
      icons: { GraphStar: lucideMock.GraphStar },
      root,
    });
  });

  it('returns a promise that resolves', async () => {
    const result = lazyInitializeLucideIcons(['GraphStar']);
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });
});
