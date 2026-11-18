/**
 * @fileoverview Web Worker entry point for word-cloud computation.
 *
 * Receives serialized bookmark DTOs from the main thread, performs term
 * extraction + frequency aggregation entirely off the main thread, and
 * posts the results back through the transferred MessagePort.
 *
 * Protocol:
 *   in:  { requestId, bookmarks: BookmarkDTO[] } (with a transferred port in event.ports[0])
 *   out: { requestId, items: { word, count, sizeRatio }[], error: string|null } (via the transferred port)
 */

import { computeWordCloudFrequencies, computeWordCloudItems } from './aggregate.js';
import { preloadWorkerEngine } from './extract.js';

/* global self */

self.onmessage = async (event) => {
  const { requestId, bookmarks } = event.data || {};
  /** @type {MessagePort} */
  const replyPort = event.ports[0];

  if (!requestId || !Array.isArray(bookmarks) || !replyPort) {
    if (replyPort) {
      replyPort.postMessage({
        requestId: requestId ?? null,
        items: null,
        error: 'Invalid request: expected { requestId, bookmarks[] } with a reply port',
      });
    }
    return;
  }

  // Fire-and-forget engine preload only if any bookmark is English-routed.
  // CJK-only libraries never need compromise — Intl.Segmenter suffices.
  const hasEnglish = bookmarks.some((b) => b.detected_language === 'en');
  if (hasEnglish) {
    preloadWorkerEngine();
  }

  try {
    const sorted = computeWordCloudFrequencies(bookmarks);
    const items = computeWordCloudItems(sorted);
    replyPort.postMessage({ requestId, items, error: null });
  } catch (err) {
    console.error('Worker: word cloud computation failed:', err);
    replyPort.postMessage({
      requestId,
      items: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
