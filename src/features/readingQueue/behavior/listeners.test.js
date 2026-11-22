// @vitest-environment jsdom

/**
 * @fileoverview Drag-and-drop reorder regression tests for the reading queue.
 *
 * The reorder never worked because the markup made the whole row the
 * draggable="true" element while the dragstart handler required the event target
 * to be the drag handle ([data-drag-handle]). In a real browser dragstart fires
 * on the draggable element — the row — whose closest('[data-drag-handle]') is
 * null (the handle is a descendant, never an ancestor), so the handler bailed
 * and draggedElement was never set. Reordering silently no-op'd.
 *
 * These tests simulate the browser: they dispatch dragstart on whichever element
 * carries draggable="true". Against the old markup that is the row, and the
 * reorder no-ops; against the fixed markup (only the handle is draggable) the
 * row reorders. Heavy side-effect modules the drop handler calls are mocked so
 * the test stays focused on the reorder contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setBookmarks, setReadingQueue, readingQueue } from '@/core/state';

vi.mock('@/features/reader/behavior/controller.js', () => ({
  openReaderModal: vi.fn(),
}));
vi.mock('@/features/sidebar/behavior', () => ({ updateQueueBadge: vi.fn() }));
vi.mock('@/features/bookmarks', () => ({ renderBookmarkCards: vi.fn() }));
vi.mock('./deps.js', () => ({ persistAfterQueueAction: vi.fn() }));
import { renderQueueView } from './view.js';
import { registerQueueListeners } from './listeners.js';
import { queueModalHtml } from '../components/queueModal.js';

// Build a minimal BookmarkRecord-shaped object for the queue row markup.
function mk(id) {
  return {
    id,
    title: `Title ${id}`,
    url: `https://example.com/${id}`,
    detected_language: 'EN',
    deleted_at: void 0,
  };
}

// Give each row a deterministic vertical box (stacked 40px tall) so
// getDragAfterElement's getBoundingClientRect math is meaningful in jsdom,
// where every rect is otherwise all zeros.
function box(rows) {
  rows.forEach((row, i) => {
    row.getBoundingClientRect = () => ({
      top: i * 40,
      bottom: i * 40 + 40,
      height: 40,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: i * 40,
      toJSON() {},
    });
  });
}

// Build a drag event carrying the dataTransfer surface the handlers touch and a
// controllable clientY (read-only on a native Event).
function ev(type, y = 0) {
  const e = new window.Event(type, { bubbles: true, cancelable: true });
  e.dataTransfer = {
    effectAllowed: '',
    dropEffect: '',
    setData() {},
    getData() {
      return '';
    },
    setDragImage() {},
  };
  Object.defineProperty(e, 'clientY', { value: y });
  return e;
}

// The element a real browser fires dragstart on: nearest self-or-descendant
// carrying draggable="true" (the handle after the fix, the row before it).
function src(row) {
  if (row.getAttribute('draggable') === 'true') return row;
  const inner = row.querySelector('[draggable="true"]');
  if (!inner) throw new Error('row has no draggable element');
  return inner;
}

// Mount the modal, seed state, render the list, wire listeners.
function go(ids) {
  document.body.innerHTML = queueModalHtml();
  setBookmarks(ids.map(mk));
  setReadingQueue([...ids]);
  renderQueueView();
  registerQueueListeners();
  const list = document.getElementById('queueList');
  const rows = Array.from(list.querySelectorAll('[data-queue-row]'));
  box(rows);
  return { list, rows };
}

beforeEach(() => {
  setBookmarks([]);
  setReadingQueue([]);
  document.body.innerHTML = '';
});

describe('drag-and-drop reorder', () => {
  it('makes the drag handle the draggable element, not the row', () => {
    go(['b1']);
    const row = document.querySelector('[data-queue-row]');
    const handle = row.querySelector('[data-drag-handle]');
    expect(row.getAttribute('draggable')).toBe('false');
    expect(handle.getAttribute('draggable')).toBe('true');
  });

  it('moves a dragged row to the end of the queue', () => {
    const { list, rows } = go(['b1', 'b2', 'b3']);
    src(rows[0]).dispatchEvent(ev('dragstart'));
    list.dispatchEvent(ev('dragover', 1000));
    list.dispatchEvent(ev('drop', 1000));
    expect(readingQueue).toEqual(['b2', 'b3', 'b1']);
  });

  it('moves a dragged row to the top of the queue', () => {
    const { list, rows } = go(['b1', 'b2', 'b3']);
    src(rows[2]).dispatchEvent(ev('dragstart'));
    list.dispatchEvent(ev('dragover', 5));
    list.dispatchEvent(ev('drop', 5));
    expect(readingQueue).toEqual(['b3', 'b1', 'b2']);
  });

  it('drops a row into the middle at the hovered position', () => {
    const { list, rows } = go(['b1', 'b2', 'b3']);
    src(rows[0]).dispatchEvent(ev('dragstart'));
    list.dispatchEvent(ev('dragover', 90));
    list.dispatchEvent(ev('drop', 90));
    expect(readingQueue).toEqual(['b2', 'b1', 'b3']);
  });

  it('does not reorder when the drag starts outside a drag handle', () => {
    const { list, rows } = go(['b1', 'b2', 'b3']);
    rows[0].dispatchEvent(ev('dragstart'));
    list.dispatchEvent(ev('dragover', 1000));
    list.dispatchEvent(ev('drop', 1000));
    expect(readingQueue).toEqual(['b1', 'b2', 'b3']);
  });
});
