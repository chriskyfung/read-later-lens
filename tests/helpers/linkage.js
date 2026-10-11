/**
 * @fileoverview Shared DOM and wait helpers for the linkage view suites.
 *
 * Extracted from tests/views-linkage.test.js when that file was split by
 * concern: the render/guard suite and the focus/camera suite both drive the
 * same real jsdom document, so the fixtures they need live here rather than
 * being duplicated.
 *
 * Not a suite itself (vitest only collects `*.test.js`), so importing it has no
 * side effects beyond defining these functions.
 */

import { setBookmarks } from '../../src/core/state.js';
import { renderConceptLinkageGraph } from '../../src/views/linkage.js';

/**
 * A minimal bookmark record, shaped like a parsed CSV row.
 *
 * @param {number|string} id
 * @param {string} [title]
 * @param {string} [url]
 */
export function BM(id, title = `t${id}`, url = `https://example.com/${id}`) {
  return {
    id: String(id),
    title,
    url,
    article_preview: '',
    content: '',
    instapaper_url: `https://www.instapaper.com/read/${id}`,
    detected_language: 'en',
    tags: [],
    source_file_id: 'f1',
    source_file_name: 'a.csv',
  };
}

/** Appends a real canvas to the document and returns it. */
export function createCanvas() {
  const canvas = document.createElement('div');
  canvas.id = 'd3GraphCanvas';
  canvas.className = 'flex-1';
  document.body.appendChild(canvas);
  return canvas;
}

/** Build the tab bar, panels and toast the linkage entry point drives. */
export function createTabShell() {
  ['bookmarks', 'wordcloud', 'domains', 'linkage'].forEach((tab) => {
    const btn = document.createElement('button');
    btn.className = 'main-tab';
    btn.dataset.tab = tab;
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = `panel${tab[0].toUpperCase()}${tab.slice(1)}`;
    panel.className = 'tab-panel hidden';
    document.body.appendChild(panel);
  });

  const toast = document.createElement('div');
  toast.id = 'toastNotification';
  const msg = document.createElement('div');
  msg.id = 'toastMsg';
  toast.appendChild(msg);
  document.body.appendChild(toast);
}

/**
 * Stop any running simulation and clear the document between tests.
 *
 * The view stops the simulation only when a canvas is present, so add a
 * throwaway one to drive the stop, then remove it with everything else.
 */
export function resetModuleState() {
  const canvas = document.createElement('div');
  canvas.id = 'd3GraphCanvas';
  document.body.appendChild(canvas);
  setBookmarks([]);
  renderConceptLinkageGraph();
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

/**
 * Poll until the zoom group carries the centering transform. It must not
 * return on the first transform it sees: `svg.call(zoom)` writes an identity
 * transform at render time, and centering is a 450ms d3 transition that starts
 * from that identity, so the mid-transition scale is still near 1. Matching on
 * the final scale is what makes this a claim about completed centering.
 *
 * @param {HTMLElement} canvas
 * @param {RegExp} [expected]
 * @param {number} [timeout]
 * @returns {Promise<string|null>} the transform, or null if it never settled
 */
export async function waitForTransform(canvas, expected = /scale\(1\.6\)/, timeout = 2000) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    const g = canvas.querySelector('svg > g');
    last = g ? g.getAttribute('transform') : null;
    if (last && expected.test(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return last;
}

/**
 * Parse the three components out of an SVG
 * `transform="translate(x,y) scale(k)"`.
 *
 * @param {string|null} transform
 * @returns {{x: number, y: number, k: number}|null}
 */
export function parseTransform(transform) {
  const m = /translate\(([-\d.]+),([-\d.]+)\)\s+scale\(([\d.]+)\)/.exec(transform || '');
  return m ? { x: +m[1], y: +m[2], k: +m[3] } : null;
}

/**
 * Wait for the deferred topology (Frame B) to land.
 *
 * A focused render paints the bookmark in one call and appends the rest of the
 * graph in a later macrotask, so anything that asserts on the *whole* graph
 * has to wait for it. Polling on a count rather than a fixed sleep keeps this
 * robust when the fallback timer fires sooner or later than expected.
 *
 * @param {HTMLElement} canvas
 * @param {number} expectedCircles
 * @param {number} [timeout]
 */
export async function waitForTopology(canvas, expectedCircles, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (canvas.querySelectorAll('circle').length >= expectedCircles) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `topology did not arrive: expected ${expectedCircles} circles, ` +
      `found ${canvas.querySelectorAll('circle').length}`,
  );
}

/**
 * Map each rendered node to its emphasis state, keyed by label text.
 *
 * Keying by label rather than index matters: a focused render appends the
 * TARGET first and the rest afterwards, so DOM order is target-first and does
 * NOT follow filtered order.
 *
 * @param {HTMLElement} canvas
 * @returns {Map<string, {stroke: string|null, opacity: string|null}>}
 */
export function nodesByLabel(canvas) {
  const out = new Map();
  for (const g of canvas.querySelectorAll('g.nodes > g')) {
    const label = g.querySelector('text');
    if (!label) continue;
    out.set(label.textContent, {
      stroke: g.querySelector('circle').getAttribute('stroke'),
      opacity: g.getAttribute('opacity'),
    });
  }
  return out;
}
