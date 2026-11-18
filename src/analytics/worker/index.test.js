/**
 * @fileoverview Tests for the word-cloud Web Worker entry point.
 *
 * Colocated beside src/analytics/worker/index.js. Mocks `self` and the
 * worker's internal dependencies (`./aggregate.js`, `./extract.js`) so the
 * message-handler protocol can be tested without loading `compromise`.
 */

/* global self */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('./aggregate.js', () => ({
  computeWordCloudFrequencies: vi.fn(() => [
    ['apple', 3],
    ['banana', 2],
  ]),
  computeWordCloudItems: vi.fn(() => [
    { word: 'apple', count: 3, sizeRatio: 2.25 },
    { word: 'banana', count: 2, sizeRatio: 1.5 },
  ]),
}));
vi.mock('./extract.js', () => ({
  preloadWorkerEngine: vi.fn(),
}));

import { computeWordCloudFrequencies, computeWordCloudItems } from './aggregate.js';
import { preloadWorkerEngine } from './extract.js';

const postMessageMock = vi.fn();

/** Creates a mock MessagePort pair for testing the worker protocol. */
function createMockPortPair() {
  const port1 = { postMessage: vi.fn(), close: vi.fn() };
  const port2 = { postMessage: vi.fn(), close: vi.fn() };
  // Simulate MessageChannel: port1 receives what port2 posts, and vice versa
  port1.postMessage.mockImplementation((msg) => {
    port2.onmessage?.({ data: msg, ports: [] });
  });
  port2.postMessage.mockImplementation((msg) => {
    port1.onmessage?.({ data: msg, ports: [] });
  });
  return { port1, port2 };
}

let replyPort;

beforeAll(async () => {
  globalThis.self = { postMessage: postMessageMock };
  await import('./index.js'); // sets self.onmessage
});

beforeEach(() => {
  postMessageMock.mockClear();
  computeWordCloudFrequencies.mockClear();
  computeWordCloudItems.mockClear();
  preloadWorkerEngine.mockClear();

  computeWordCloudFrequencies.mockReturnValue([
    ['apple', 3],
    ['banana', 2],
  ]);
  computeWordCloudItems.mockReturnValue([
    { word: 'apple', count: 3, sizeRatio: 2.25 },
    { word: 'banana', count: 2, sizeRatio: 1.5 },
  ]);

  // Create a fresh mock reply port for each test
  const { port1 } = createMockPortPair();
  replyPort = port1;
});

/**
 * Helper to fire the worker's onmessage with a mock transferred port.
 * @param {object} data
 * @param {object} [extra]
 */
function fireWorkerMessage(data, extra = {}) {
  return self.onmessage({
    data,
    ports: [replyPort],
    ...extra,
  });
}

describe('worker message handler protocol', () => {
  it('responds with an error for a missing requestId', async () => {
    await fireWorkerMessage({ bookmarks: [] });
    await vi.waitFor(() => expect(replyPort.postMessage).toHaveBeenCalled());
    expect(replyPort.postMessage).toHaveBeenCalledWith({
      requestId: null,
      items: null,
      error: expect.stringContaining('Invalid request'),
    });
  });

  it('responds with an error for a non-array bookmarks', async () => {
    await fireWorkerMessage({ requestId: 'req-1', bookmarks: 'not-array' });
    await vi.waitFor(() => expect(replyPort.postMessage).toHaveBeenCalled());
    expect(replyPort.postMessage).toHaveBeenCalledWith({
      requestId: 'req-1',
      items: null,
      error: expect.stringContaining('Invalid request'),
    });
  });

  it('responds with an error when no reply port is transferred', async () => {
    // Simulate missing ports array
    self.onmessage({ data: { requestId: 'req-1', bookmarks: [] }, ports: [] });
    // Should not throw and should not crash
    await vi.waitFor(() => {});
  });

  it('responds with items for a valid request', async () => {
    await fireWorkerMessage({
      requestId: 'req-2',
      bookmarks: [{ id: '1', detected_language: 'en' }],
    });
    await vi.waitFor(() => expect(replyPort.postMessage).toHaveBeenCalled());
    const call = replyPort.postMessage.mock.calls[0][0];
    expect(call.requestId).toBe('req-2');
    expect(call.error).toBeNull();
    expect(call.items).toEqual([
      { word: 'apple', count: 3, sizeRatio: 2.25 },
      { word: 'banana', count: 2, sizeRatio: 1.5 },
    ]);
    expect(computeWordCloudFrequencies).toHaveBeenCalledWith([
      { id: '1', detected_language: 'en' },
    ]);
  });

  it('preloads the engine only when English bookmarks are present', async () => {
    // English → preloads
    await fireWorkerMessage({
      requestId: 'req-3',
      bookmarks: [{ id: '1', detected_language: 'en' }],
    });
    await vi.waitFor(() => expect(preloadWorkerEngine).toHaveBeenCalled());

    // CJK → does not preload
    preloadWorkerEngine.mockClear();
    await fireWorkerMessage({
      requestId: 'req-4',
      bookmarks: [{ id: '2', detected_language: 'zh' }],
    });
    await vi.waitFor(() => expect(replyPort.postMessage).toHaveBeenCalled());
    expect(preloadWorkerEngine).not.toHaveBeenCalled();
  });

  it('responds with an error when computation throws', async () => {
    computeWordCloudFrequencies.mockImplementation(() => {
      throw new Error('boom');
    });
    await fireWorkerMessage({
      requestId: 'req-5',
      bookmarks: [{ id: '1', detected_language: 'en' }],
    });
    await vi.waitFor(() => expect(replyPort.postMessage).toHaveBeenCalled());
    const call = replyPort.postMessage.mock.calls[0][0];
    expect(call.requestId).toBe('req-5');
    expect(call.items).toBeNull();
    expect(call.error).toBe('boom');
  });

  it('passes requestId through in the response', async () => {
    await fireWorkerMessage({ requestId: 'custom-id-99', bookmarks: [] });
    await vi.waitFor(() => expect(replyPort.postMessage).toHaveBeenCalled());
    const call = replyPort.postMessage.mock.calls[0][0];
    expect(call.requestId).toBe('custom-id-99');
  });
});
