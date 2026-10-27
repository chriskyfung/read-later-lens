/**
 * @fileoverview Modal layer stack for src/utils/dom.
 *
 * Owns the *layer stack*: a modal opened on top of another becomes a new layer
 * instance. The layer beneath stays open but is marked inert, and closing the
 * top layer reveals the one beneath it, re-rendering that layer's content from
 * the payload it was pushed with. Escape (see src/views/modalListeners.js)
 * therefore unwinds nested dialogs in reverse order.
 *
 * This is the *only* stateful module in src/utils/dom. The `layers` array and
 * `layerRegistry` Map live here alone; the public barrel (src/utils/dom/index.js)
 * re-exports functions, never the array, so a second copy of the stack cannot
 * be created. The stack invariant — stack order => z-index => inert/aria-hidden
 * reachability — is kept inside syncLayers() for exactly that reason.
 *
 * Registering a view's closer is done by injection (registerModalLayer) rather
 * than import, because importing src/views here would close the
 * readerModal -> similarityModal -> dom.js cycle.
 */

/** Base z-index for overlays (the markup ships with Tailwind `z-50`). */
export const MODAL_Z_BASE = 50;

/**
 * Runaway guard for the layer stack. Real navigation (reader <-> similarity)
 * never comes close to this; it only trims pathological loops.
 */
const MODAL_STACK_GUARD = 10;

/**
 * Background roots that go inert while a layer is open. Both are siblings of
 * the modal overlays under <body>: the header is inserted 'afterbegin' and the
 * app shell lives in #appBody.
 */
const BACKGROUND_IDS = ['appHeader', 'appBody'];

/**
 * Open layers, bottom -> top. Entries are layer *instances*, so the same
 * overlay id may appear more than once (a reader beneath a similarity drawer
 * beneath another reader). `payload` + `restore` let a revealed layer put its
 * content back; `onRetire` clears layer-owned module state whenever the layer
 * leaves the stack, including guard eviction.
 *
 * @type {{
 *   id: string,
 *   payload: any,
 *   restore: Function|null,
 *   onRetire: Function|null,
 *   opener: HTMLElement|null,
 * }[]
 */
const layers = [];

/**
 * Per-overlay metadata registered by the owning view module. Injected rather
 * than imported, because importing src/views here would close the
 * readerModal -> similarityModal -> dom.js cycle.
 *
 * @type {Map<string, {close: Function}>}
 */
const layerRegistry = new Map();

/**
 * Register an overlay's chrome so the stack can keep it in sync.
 *
 * @param {string} id Overlay element id (e.g. 'readerModal').
 * @param {object} meta
 * @param {Function} meta.close Closes the layer.
 */
export function registerModalLayer(id, { close }) {
  layerRegistry.set(id, { close });
}

/** @returns {number} How many layers are open (0 when no modal is open). */
export function stackDepth() {
  return layers.length;
}

/** @returns {string|null} Id of the overlay on top of the stack. */
export function topLayerId() {
  return layers.length ? layers[layers.length - 1].id : null;
}

/** @returns {HTMLElement|null} The overlay element on top of the stack. */
export function topLayer() {
  const id = topLayerId();
  return id ? document.getElementById(id) : null;
}

/**
 * Mark the page behind the modals inert so focus cannot escape into it.
 *
 * @param {boolean} inert
 */
function setBackgroundInert(inert) {
  BACKGROUND_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el && 'inert' in el) el.inert = inert;
  });
}

/**
 * Re-apply z-index / inert / aria-hidden to every layer so paint order matches
 * stack order (all overlays share Tailwind's `z-50`, so DOM order alone is not
 * enough) and buried layers are genuinely unreachable. Focus moves to the new
 * top layer, whose container is focusable via tabindex="-1".
 */
function syncLayers() {
  layers.forEach((layer, index) => {
    const el = document.getElementById(layer.id);
    if (!el) return;
    const isTop = index === layers.length - 1;
    el.classList.remove('hidden');
    el.style.zIndex = String(MODAL_Z_BASE + index + 1);
    if ('inert' in el) el.inert = !isTop;
    el.setAttribute('aria-hidden', String(!isTop));
  });

  setBackgroundInert(layers.length > 0);

  const top = topLayer();
  if (top && typeof top.focus === 'function') top.focus();
}

/**
 * Push a modal layer on top of the stack, showing its overlay.
 *
 * @param {string} id Overlay element id.
 * @param {object} [options]
 * @param {*} [options.payload] Handed back to `restore` when the layer is revealed.
 * @param {Function|null} [options.restore] Re-renders the layer's content.
 * @param {Function|null} [options.onRetire] Clears layer-owned module state.
 */
export function pushLayer(id, { payload = null, restore = null, onRetire = null } = {}) {
  const el = document.getElementById(id);
  if (!el) return;

  if (layers.length >= MODAL_STACK_GUARD) {
    console.warn(`Modal stack guard (${MODAL_STACK_GUARD}) reached; evicting the oldest layer.`);
    popLayer(layers[0].id);
  }

  layers.push({ id, payload, restore, onRetire, opener: document.activeElement || null });
  syncLayers();
}

/**
 * Remove a layer from the stack, then reveal the layer beneath it (restoring
 * that layer's content) or hand focus back to whatever opened the bottom layer.
 *
 * @param {string} id Overlay element id.
 */
export function popLayer(id) {
  const index = layers.map((layer) => layer.id).lastIndexOf(id);
  const el = document.getElementById(id);

  if (index === -1) {
    // Untracked overlay (e.g. opened before registration): hide it defensively.
    if (el) el.classList.add('hidden');
    return;
  }

  const [closed] = layers.splice(index, 1);
  if (el) {
    el.classList.add('hidden');
    el.style.zIndex = '';
    if ('inert' in el) el.inert = false;
    el.removeAttribute('aria-hidden');
  }
  if (typeof closed.onRetire === 'function') closed.onRetire();

  const revealed = layers[layers.length - 1];
  if (revealed) {
    if (typeof revealed.restore === 'function') revealed.restore(revealed.payload);
    syncLayers();
    return;
  }

  setBackgroundInert(false);
  const opener = closed.opener;
  if (opener && typeof opener.focus === 'function') opener.focus();
}

/**
 * Close a layer through its registered closer, so the owning module can reset
 * its own state on the way out.
 *
 * @param {string} id Overlay element id.
 */
export function closeLayer(id) {
  const close = layerRegistry.get(id)?.close;
  if (close) close();
  else popLayer(id);
}

/** Close the topmost open layer (no-op when no modal is open). */
export function closeTopLayer() {
  const id = topLayerId();
  if (id) closeLayer(id);
}

/**
 * Close every open layer, top first. Gives tests (and a repeated boot) a clean
 * starting point without leaking layer state between runs.
 */
export function resetLayers() {
  while (layers.length) {
    const before = layers.length;
    closeLayer(layers[layers.length - 1].id);
    // A registered closer that did not pop (or a missing one) must not stall
    // the drain, so fall back to removing the layer directly.
    if (layers.length === before) popLayer(layers[layers.length - 1].id);
  }
}
