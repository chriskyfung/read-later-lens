import { describe, it, expect, beforeEach } from 'vitest';
import { setReadingQueue, readingQueue } from '@/core/state';
import {
  addToQueue,
  removeFromQueue,
  moveQueueItem,
  moveQueueItemToTop,
  moveQueueItemToBottom,
  clearQueue,
} from './actions.js';

beforeEach(() => {
  setReadingQueue([]);
});

describe('addToQueue', () => {
  it('adds an item to an empty queue', () => {
    expect(addToQueue('b1')).toBe(true);
    expect(readingQueue).toEqual(['b1']);
  });

  it('appends to the end of a non-empty queue', () => {
    setReadingQueue(['b1', 'b2']);
    expect(addToQueue('b3')).toBe(true);
    expect(readingQueue).toEqual(['b1', 'b2', 'b3']);
  });

  it('is idempotent — returns false when already queued', () => {
    setReadingQueue(['b1']);
    expect(addToQueue('b1')).toBe(false);
    expect(readingQueue).toEqual(['b1']);
  });

  it('does not add when queue is at capacity', () => {
    setReadingQueue(
      Array(100)
        .fill(0)
        .map((_, i) => `b${i}`),
    );
    expect(addToQueue('b100')).toBe(false);
    expect(readingQueue).toHaveLength(100);
  });

  it('allows re-adding after removal', () => {
    setReadingQueue(['b1']);
    removeFromQueue('b1');
    expect(addToQueue('b1')).toBe(true);
    expect(readingQueue).toEqual(['b1']);
  });
});

describe('removeFromQueue', () => {
  it('returns false when not queued', () => {
    expect(removeFromQueue('b1')).toBe(false);
  });

  it('removes an item from the queue', () => {
    setReadingQueue(['b1', 'b2', 'b3']);
    expect(removeFromQueue('b2')).toBe(true);
    expect(readingQueue).toEqual(['b1', 'b3']);
  });

  it('removes the first item', () => {
    setReadingQueue(['b1', 'b2']);
    expect(removeFromQueue('b1')).toBe(true);
    expect(readingQueue).toEqual(['b2']);
  });

  it('removes the last item', () => {
    setReadingQueue(['b1', 'b2']);
    expect(removeFromQueue('b2')).toBe(true);
    expect(readingQueue).toEqual(['b1']);
  });
});

describe('moveQueueItem', () => {
  it('returns false when not queued', () => {
    expect(moveQueueItem('b1', 0)).toBe(false);
  });

  it('moves an item to a new index', () => {
    setReadingQueue(['b1', 'b2', 'b3', 'b4']);
    expect(moveQueueItem('b4', 0)).toBe(true);
    expect(readingQueue).toEqual(['b4', 'b1', 'b2', 'b3']);
  });

  it('moves an item to the middle', () => {
    setReadingQueue(['b1', 'b2', 'b3', 'b4']);
    expect(moveQueueItem('b1', 2)).toBe(true);
    expect(readingQueue).toEqual(['b2', 'b3', 'b1', 'b4']);
  });

  it('clamps negative index to 0', () => {
    setReadingQueue(['b1', 'b2', 'b3']);
    expect(moveQueueItem('b3', -5)).toBe(true);
    expect(readingQueue).toEqual(['b3', 'b1', 'b2']);
  });

  it('clamps overflow index to last', () => {
    setReadingQueue(['b1', 'b2', 'b3']);
    expect(moveQueueItem('b1', 99)).toBe(true);
    expect(readingQueue).toEqual(['b2', 'b3', 'b1']);
  });

  it('is a no-op when old and new index are the same', () => {
    setReadingQueue(['b1', 'b2']);
    expect(moveQueueItem('b1', 0)).toBe(true);
    expect(readingQueue).toEqual(['b1', 'b2']);
  });
});

describe('moveQueueItemToTop', () => {
  it('moves an item to index 0', () => {
    setReadingQueue(['b1', 'b2', 'b3']);
    expect(moveQueueItemToTop('b3')).toBe(true);
    expect(readingQueue).toEqual(['b3', 'b1', 'b2']);
  });

  it('is a no-op when already at top', () => {
    setReadingQueue(['b1', 'b2']);
    expect(moveQueueItemToTop('b1')).toBe(true);
    expect(readingQueue).toEqual(['b1', 'b2']);
  });
});

describe('moveQueueItemToBottom', () => {
  it('moves an item to the last index', () => {
    setReadingQueue(['b1', 'b2', 'b3']);
    expect(moveQueueItemToBottom('b1')).toBe(true);
    expect(readingQueue).toEqual(['b2', 'b3', 'b1']);
  });

  it('is a no-op when already at bottom', () => {
    setReadingQueue(['b1', 'b2']);
    expect(moveQueueItemToBottom('b2')).toBe(true);
    expect(readingQueue).toEqual(['b1', 'b2']);
  });
});

describe('clearQueue', () => {
  it('empties the queue', () => {
    setReadingQueue(['b1', 'b2', 'b3']);
    clearQueue();
    expect(readingQueue).toEqual([]);
  });

  it('is a no-op on an already empty queue', () => {
    expect(() => clearQueue()).not.toThrow();
    expect(readingQueue).toEqual([]);
  });
});
