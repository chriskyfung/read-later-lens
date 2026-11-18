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
});

describe('worker message handler protocol', () => {
  it('responds with an error for a missing requestId', async () => {
    self.onmessage({ data: { bookmarks: [] } });
    await vi.waitFor(() => expect(postMessageMock).toHaveBeenCalled());
    expect(postMessageMock).toHaveBeenCalledWith({
      requestId: null,
      items: null,
      error: expect.stringContaining('Invalid request'),
    });
  });

  it('responds with an error for a non-array bookmarks', async () => {
    self.onmessage({ data: { requestId: 'req-1', bookmarks: 'not-array' } });
    await vi.waitFor(() => expect(postMessageMock).toHaveBeenCalled());
    expect(postMessageMock).toHaveBeenCalledWith({
      requestId: 'req-1',
      items: null,
      error: expect.stringContaining('Invalid request'),
    });
  });

  it('responds with items for a valid request', async () => {
    self.onmessage({
      data: { requestId: 'req-2', bookmarks: [{ id: '1', detected_language: 'en' }] },
    });
    await vi.waitFor(() =>
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'req-2', error: null }),
      ),
    );
    expect(computeWordCloudFrequencies).toHaveBeenCalledWith([
      { id: '1', detected_language: 'en' },
    ]);
    expect(postMessageMock).toHaveBeenCalledWith({
      requestId: 'req-2',
      items: [
        { word: 'apple', count: 3, sizeRatio: 2.25 },
        { word: 'banana', count: 2, sizeRatio: 1.5 },
      ],
      error: null,
    });
  });

  it('preloads the engine only when English bookmarks are present', async () => {
    // English → preloads
    self.onmessage({
      data: { requestId: 'req-3', bookmarks: [{ id: '1', detected_language: 'en' }] },
    });
    await vi.waitFor(() => expect(preloadWorkerEngine).toHaveBeenCalled());

    // CJK → does not preload
    preloadWorkerEngine.mockClear();
    self.onmessage({
      data: { requestId: 'req-4', bookmarks: [{ id: '2', detected_language: 'zh' }] },
    });
    await vi.waitFor(() => expect(postMessageMock).toHaveBeenCalled());
    expect(preloadWorkerEngine).not.toHaveBeenCalled();
  });

  it('responds with an error when computation throws', async () => {
    computeWordCloudFrequencies.mockImplementation(() => {
      throw new Error('boom');
    });
    self.onmessage({
      data: { requestId: 'req-5', bookmarks: [{ id: '1', detected_language: 'en' }] },
    });
    await vi.waitFor(() =>
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'req-5', items: null, error: 'boom' }),
      ),
    );
    expect(postMessageMock).toHaveBeenCalledWith({
      requestId: 'req-5',
      items: null,
      error: 'boom',
    });
  });

  it('passes requestId through in the response', async () => {
    self.onmessage({
      data: { requestId: 'custom-id-99', bookmarks: [] },
    });
    await vi.waitFor(() => expect(postMessageMock).toHaveBeenCalled());
    const call = postMessageMock.mock.calls[0][0];
    expect(call.requestId).toBe('custom-id-99');
  });
});
