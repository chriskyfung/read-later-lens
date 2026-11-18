/**
 * @fileoverview Web Worker entry point for word-cloud computation.
 *
 * Receives serialized bookmark DTOs from the main thread, performs term
 * extraction + frequency aggregation entirely off the main thread, and
 * posts the results back.
 *
 * Protocol:
 *   in:  { requestId, bookmarks: BookmarkDTO[] }
 *   out: { requestId, items: { word, count, sizeRatio }[], error: string|null }
 */

import { computeWordCloudFrequencies, computeWordCloudItems } from './aggregate.js';
import { preloadWorkerEngine } from './extract.js';

/* global self */

self.onmessage = async (event) => {
  const { requestId, bookmarks } = event.data || {};

  if (!requestId || !Array.isArray(bookmarks)) {
    self.postMessage({
      requestId: requestId ?? null,
      items: null,
      error: 'Invalid request: expected { requestId, bookmarks[] }',
    });
    return;
  }

  // Fire-and-forget engine preload so compromise starts downloading ASAP.
  preloadWorkerEngine();

  try {
    const sorted = computeWordCloudFrequencies(bookmarks);
    const items = computeWordCloudItems(sorted);
    self.postMessage({ requestId, items, error: null });
  } catch (err) {
    console.error('Worker: word cloud computation failed:', err);
    self.postMessage({
      requestId,
      items: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
