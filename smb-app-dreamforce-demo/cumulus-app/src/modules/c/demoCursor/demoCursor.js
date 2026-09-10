import { LightningElement, api, track } from 'lwc';

// ─────────────────────────────────────────────────────────────────────────
// c-demo-cursor - translucent click hotspot + synthetic pointer overlay
// for demo / autoplay runs.
//
// Two drive modes, both active at once:
//
//   1. Ambient  - while `active`, real pointer moves and real clicks
//                 anywhere in the app spawn a hotspot. Works today with
//                 `?demo=1` and needs no runner.
//   2. Scripted - the autoplay runner calls moveTo()/clickAt()/pulseOn()
//                 to drive the pointer without any real input.
//
// Document-level listeners are used because each LWC lives in its own
// shadow root; a click on a deeply nested button is only observable from
// the document (events retarget but still bubble to it).
// ─────────────────────────────────────────────────────────────────────────

// Ceiling on concurrently rendered hotspots. The animationend handler is
// the normal cleanup path; this is the backstop for the case where a
// rapid burst of clicks outpaces animation frames.
const MAX_HOTSPOTS = 12;

export default class DemoCursor extends LightningElement {
  // Gate. When false the overlay renders nothing and binds no listeners.
  _active = false;

  @api
  get active() {
    return this._active;
  }
  set active(value) {
    const next = !!value;
    if (next === this._active) return;
    this._active = next;
    if (next) {
      this._bind();
    } else {
      this._unbind();
      this.hotspots = [];
      this.showPointer = false;
    }
  }

  @track hotspots = [];
  @track showPointer = false;

  _x = 0;
  _y = 0;
  _seq = 0;
  _bound = false;
  // True while the atlasDemo autoplay runner is on screen. The runner
  // paints its own SVG arrow cursor and highlight ring, so we mute our
  // ambient pointer dot to avoid two pointers competing - but we still
  // paint hotspots for every scripted click via `atlas-demo-click`.
  _runnerActive = false;

  connectedCallback() {
    if (this._active) this._bind();
  }

  disconnectedCallback() {
    this._unbind();
  }

  // ── Scripted API (for the autoplay runner) ──────────────────
  // Move the synthetic pointer without emitting a hotspot.
  @api
  moveTo(x, y) {
    this._setPosition(x, y);
  }

  // Move the pointer and emit a hotspot - the scripted equivalent of a
  // click. Call this immediately before dispatching the real action so
  // the ripple and the resulting UI change read as one beat.
  @api
  clickAt(x, y) {
    this._setPosition(x, y);
    this._spawnHotspot(this._x, this._y);
  }

  // Centre the pointer on an element and emit a hotspot there. Accepts
  // any element the runner already holds a reference to, including ones
  // inside another component's shadow root.
  @api
  clickOn(element) {
    const rect = element?.getBoundingClientRect?.();
    if (!rect) return;
    this.clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  @api
  hidePointer() {
    this.showPointer = false;
  }

  // ── Ambient listeners ───────────────────────────────────────
  _bind() {
    if (this._bound || typeof document === 'undefined') return;
    // Capture phase so a handler that calls stopPropagation deeper in
    // the tree can't swallow the hotspot.
    document.addEventListener('pointermove', this._onPointerMove, true);
    document.addEventListener('pointerdown', this._onPointerDown, true);
    // atlasDemo bridge - see cumulus-app/src/demo/atlasDemo.js.
    document.addEventListener('atlas-demo-click', this._onScriptedClick);
    document.addEventListener('atlas-demo-start', this._onRunnerStart);
    document.addEventListener('atlas-demo-end', this._onRunnerEnd);
    this._bound = true;
  }

  _unbind() {
    if (!this._bound || typeof document === 'undefined') return;
    document.removeEventListener('pointermove', this._onPointerMove, true);
    document.removeEventListener('pointerdown', this._onPointerDown, true);
    document.removeEventListener('atlas-demo-click', this._onScriptedClick);
    document.removeEventListener('atlas-demo-start', this._onRunnerStart);
    document.removeEventListener('atlas-demo-end', this._onRunnerEnd);
    this._bound = false;
  }

  _onPointerMove = (event) => {
    // While the runner is on screen it owns the pointer visual, so
    // suppress ambient tracking. Hotspots still fire on scripted
    // clicks via `atlas-demo-click`.
    if (this._runnerActive) return;
    this._setPosition(event.clientX, event.clientY);
  };

  _onPointerDown = (event) => {
    if (this._runnerActive) return;
    this._setPosition(event.clientX, event.clientY);
    this._spawnHotspot(this._x, this._y);
  };

  _onScriptedClick = (event) => {
    const { x, y } = event.detail || {};
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this._spawnHotspot(x, y);
  };

  _onRunnerStart = () => {
    this._runnerActive = true;
    this.showPointer = false;
  };

  _onRunnerEnd = () => {
    this._runnerActive = false;
  };

  // ── Internals ───────────────────────────────────────────────
  _setPosition(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this._x = x;
    this._y = y;
    this.showPointer = true;
  }

  _spawnHotspot(x, y) {
    this._seq += 1;
    const next = [
      ...this.hotspots,
      {
        id: `dc-${this._seq}`,
        style: `left:${Math.round(x)}px;top:${Math.round(y)}px;`
      }
    ];
    this.hotspots =
      next.length > MAX_HOTSPOTS ? next.slice(next.length - MAX_HOTSPOTS) : next;
  }

  handleHotspotEnd(event) {
    const id = event.currentTarget.dataset.id;
    this.hotspots = this.hotspots.filter((h) => h.id !== id);
  }

  get pointerStyle() {
    return `left:${Math.round(this._x)}px;top:${Math.round(this._y)}px;`;
  }
}
