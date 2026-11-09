// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { openTrashModal, closeTrashModal } from './controller.js';

describe('trash modal controller', () => {
  beforeEach(() => {
    // Minimal DOM - just need the modal element to exist
    document.body.innerHTML = '<div id="trashModal" class="hidden"></div>';
  });

  it('openTrashModal does not throw and adds the modal to DOM', () => {
    expect(() => openTrashModal()).not.toThrow();
    const modal = document.getElementById('trashModal');
    expect(modal).not.toBeNull();
  });

  it('closeTrashModal does not throw and removes modal from DOM', () => {
    openTrashModal();
    expect(() => closeTrashModal()).not.toThrow();
    const modal = document.getElementById('trashModal');
    expect(modal).not.toBeNull();
  });
});
