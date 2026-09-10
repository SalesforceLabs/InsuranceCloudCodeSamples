/**
 * atlasDemo.js - Guided, visible autoplay engine for the Atlas prototype.
 *
 * Activated by `?demo=<name>` (or `?demo=1`, which maps to the default
 * Acme Employee-Benefits script). The engine paints a floating cursor,
 * a highlight ring, and a caption/coach-mark bar over the live app, then
 * drives the real UI by dispatching genuine DOM events into the LWC
 * component tree. Because it clicks real buttons / fills real inputs, the
 * demo exercises the same handlers a broker would - no mock forks.
 *
 * The whole app is one big Shadow-DOM tree, so every locator here is
 * shadow-piercing (see deepQueryAll). Steps are self-healing: each one
 * polls for its target (waitFor) and, on timeout, logs a warning and
 * moves on rather than hanging - so a drifted selector degrades the demo
 * instead of freezing it. Timing is therefore driven by "wait for the
 * next element to exist", not by brittle fixed sleeps.
 *
 * Public entry: startDemoIfRequested().
 */

import runAcmeEbDemo from './acmeEbScript.js';

const SCRIPTS = {
  '1': runAcmeEbDemo,
  'acme': runAcmeEbDemo,
  'acme-eb': runAcmeEbDemo,
  'eb': runAcmeEbDemo
};

// ── Pacing ──────────────────────────────────────────────────────────
// Two clocks drive the demo and they are deliberately independent:
//
//   1. COSMETIC dwell - the small, human-legible beats between actions
//      (cursor glides in, the glow settles, a moment to read a caption).
//      These are the ONLY pauses `demoSpeed` scales. They exist purely
//      so a viewer can follow along; they never gate correctness.
//
//   2. READINESS waits - waitFor/waitForVisible/waitForInteractable.
//      These poll the live DOM and return the instant the UI is ready.
//      They are wall-clock (never scaled) so a slow-mounting modal still
//      gets its full grace period, and a fast one is acted on at once.
//
// The old single PACE multiplier stretched *everything*, so timing felt
// random and desynced: fixed sleeps would fire before a modal painted,
// or long after it was ready. Splitting the clocks means the demo is
// paced by what the UI is actually doing, with a light cosmetic veneer
// on top. Override the cosmetic veneer per-run with `?demoSpeed=0.5`
// (snappier) / `1` (default) / `2` (slower, for narration).
const DEFAULT_SPEED = 1;

function readSpeed() {
  if (typeof window === 'undefined') return DEFAULT_SPEED;
  try {
    const raw = new URLSearchParams(window.location.search).get('demoSpeed');
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 4 ? n : DEFAULT_SPEED;
  } catch (_) {
    return DEFAULT_SPEED;
  }
}

// Cosmetic-only multiplier. Applied to dwell()/say beats, NOT to the
// readiness polls in waitFor().
const SPEED = readSpeed();

// Canonical cosmetic beats (ms, pre-scale). Kept small + consistent so
// pacing reads as a steady rhythm rather than a grab-bag of magic
// numbers. Every script pause resolves to one of these.
const BEAT = {
  tick: 120, // micro-pause after a value lands
  beat: 300, // standard between-action beat
  read: 700, // give the eye time to read a new caption / step
  scene: 1200 // scene change (step → step, modal open)
};

// ── URL flag ────────────────────────────────────────────────────────
function readDemoName() {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get('demo');
  } catch (_) {
    return null;
  }
}

// ── Abort plumbing ──────────────────────────────────────────────────
class DemoAborted extends Error {}

// ── Shadow-piercing DOM helpers ─────────────────────────────────────
function deepQueryAll(selector, root) {
  const start = root || document;
  const out = [];
  const seen = new Set();
  const walk = (node) => {
    if (!node) return;
    let matches = [];
    try {
      matches = node.querySelectorAll(selector);
    } catch (_) {
      matches = [];
    }
    for (const el of matches) {
      if (!seen.has(el)) {
        seen.add(el);
        out.push(el);
      }
    }
    let all = [];
    try {
      all = node.querySelectorAll('*');
    } catch (_) {
      all = [];
    }
    for (const el of all) {
      if (el.shadowRoot) walk(el.shadowRoot);
    }
    if (node.shadowRoot) walk(node.shadowRoot);
  };
  walk(start);
  return out;
}

function isVisible(el) {
  if (!el || !el.getClientRects) return false;
  if (el.getClientRects().length === 0) return false;
  const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  if (cs && (cs.visibility === 'hidden' || cs.display === 'none')) return false;
  return true;
}

// Ready-to-be-acted-on check: connected, visible, and not disabled.
// This is the gate every interaction waits on so we never fire a click
// into an element that is still animating in, or is present-but-
// disabled (e.g. a "Proceed" button before its precondition is met).
// `requireVisible` is relaxed for inputs that are intentionally offscreen
// (custom-checkbox `<input>`s hidden behind a faux glyph).
function isInteractable(el, { requireVisible = true } = {}) {
  if (!el || !el.isConnected) return false;
  if (el.disabled === true) return false;
  if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return false;
  const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  if (cs && cs.pointerEvents === 'none' && requireVisible) return false;
  if (!requireVisible) return true;
  return isVisible(el);
}

function norm(s) {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// ── The engine ──────────────────────────────────────────────────────
class DemoEngine {
  constructor(name) {
    this.name = name;
    this.aborted = false;
    this.stepIndex = 0;
    this.scopeEl = null; // when set, locators search only within this element
    this._buildOverlay();
  }

  // -- Overlay chrome (cursor + ring + caption + skip) ----------------
  _buildOverlay() {
    const style = document.createElement('style');
    style.setAttribute('data-atlas-demo', 'true');
    style.textContent = `
      /* Cursor hotspot: a circular translucent glow centred on the
         target (matches the c-demo-cursor hotspot language) rather
         than an opaque arrow. Sized 36px with a -18px margin so the
         translate() in point() lands the glow's centre on the
         element's centre. */
      .atlas-demo-cursor{position:fixed;z-index:2147483646;left:0;top:0;width:36px;height:36px;
        margin:-18px 0 0 -18px;pointer-events:none;border-radius:50%;
        transition:transform .28s cubic-bezier(.22,.61,.36,1);
        transform:translate(60px,60px);will-change:transform;
        background:radial-gradient(circle,rgba(6,106,254,.40) 0%,rgba(6,106,254,.20) 55%,rgba(6,106,254,0) 100%);
        box-shadow:0 0 0 1px rgba(6,106,254,.35),0 0 20px 6px rgba(6,106,254,.22)}
      .atlas-demo-ring{position:fixed;z-index:2147483645;pointer-events:none;border-radius:10px;
        border:2px solid #066afe;box-shadow:0 0 0 4px rgba(6,106,254,.25),0 6px 20px rgba(0,0,0,.18);
        transition:all .22s cubic-bezier(.22,.61,.36,1);opacity:0;left:0;top:0;width:0;height:0;
        background:rgba(6,106,254,.06)}
      .atlas-demo-ring.is-on{opacity:1}
      .atlas-demo-bar{position:fixed;z-index:2147483646;left:50%;bottom:26px;transform:translateX(-50%);
        max-width:min(760px,92vw);display:flex;align-items:center;gap:14px;
        padding:12px 16px;border-radius:12px;background:#0a1c33;color:#fff;
        font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 12px 40px rgba(0,0,0,.35);opacity:0;transition:opacity .3s}
      .atlas-demo-bar.is-on{opacity:1}
      .atlas-demo-bar__spark{flex:0 0 auto;width:26px;height:26px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg,#7f5cff,#066afe)}
      .atlas-demo-bar__spark svg{width:15px;height:15px;fill:#fff}
      .atlas-demo-bar__txt{flex:1 1 auto;font-size:14px;line-height:1.4;font-weight:500}
      .atlas-demo-bar__count{flex:0 0 auto;font-size:12px;opacity:.7;font-variant-numeric:tabular-nums}
      .atlas-demo-bar__skip{flex:0 0 auto;border:1px solid rgba(255,255,255,.35);background:transparent;
        color:#fff;font:inherit;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;
        cursor:pointer}
      .atlas-demo-bar__skip:hover{background:rgba(255,255,255,.12)}
    `;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.className = 'atlas-demo-cursor';
    document.body.appendChild(cursor);

    const ring = document.createElement('div');
    ring.className = 'atlas-demo-ring';
    document.body.appendChild(ring);

    const bar = document.createElement('div');
    bar.className = 'atlas-demo-bar';
    bar.innerHTML =
      '<span class="atlas-demo-bar__spark"><svg viewBox="0 0 13 13" aria-hidden="true"><path d="M8.87 6.78 7.04 7.69a2.6 2.6 0 0 0-1.28 1.27l-.91 1.82a.36.36 0 0 1-.64 0l-.91-1.82a2.6 2.6 0 0 0-1.28-1.27L.2 6.78a.36.36 0 0 1 0-.63l1.83-.92A2.6 2.6 0 0 0 3.3 3.97l.91-1.83a.36.36 0 0 1 .64 0l.91 1.83a2.6 2.6 0 0 0 1.28 1.26l1.83.92a.36.36 0 0 1 0 .63z"/></svg></span>' +
      '<span class="atlas-demo-bar__txt"></span>' +
      '<span class="atlas-demo-bar__count"></span>' +
      '<button type="button" class="atlas-demo-bar__skip">End demo</button>';
    document.body.appendChild(bar);
    bar.querySelector('.atlas-demo-bar__skip').addEventListener('click', () => this.abort());

    this.els = {
      style,
      cursor,
      ring,
      bar,
      txt: bar.querySelector('.atlas-demo-bar__txt'),
      count: bar.querySelector('.atlas-demo-bar__count')
    };

    // Signal c-demo-cursor to suppress its own ambient pointer dot -
    // we own the pointer visuals while the runner is on screen.
    document.dispatchEvent(new CustomEvent('atlas-demo-start'));
  }

  teardown() {
    for (const k of ['cursor', 'ring', 'bar', 'style']) {
      const el = this.els[k];
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    document.dispatchEvent(new CustomEvent('atlas-demo-end'));
  }

  abort() {
    this.aborted = true;
    this.teardown();
  }

  _checkAbort() {
    if (this.aborted) throw new DemoAborted();
  }

  // -- Low-level scheduling -------------------------------------------
  // Abortable timer primitive. `scale` decides whether demoSpeed applies:
  // cosmetic beats scale, readiness polls do not.
  _delay(ms) {
    return new Promise((resolve, reject) => {
      const t = setInterval(() => {
        if (this.aborted) {
          clearInterval(t);
          reject(new DemoAborted());
        }
      }, 80);
      setTimeout(() => {
        clearInterval(t);
        this.aborted ? reject(new DemoAborted()) : resolve();
      }, ms);
    });
  }

  // Cosmetic pause - the only thing `demoSpeed` scales. Floored so it
  // never collapses to zero (the floor also keeps the abort poll live).
  dwell(ms = BEAT.beat) {
    return this._delay(Math.max(40, Math.round(ms * SPEED)));
  }

  // Back-compat alias used by older script call sites: treat as a
  // cosmetic dwell so `?demoSpeed=` still governs it.
  sleep(ms) {
    return this.dwell(ms);
  }

  // Unscaled wall-clock tick used exclusively by the readiness polls.
  _rawSleep(ms) {
    return this._delay(ms);
  }

  // Poll `fn` until it returns truthy or the wall-clock timeout elapses.
  // Timeout is NEVER scaled by demoSpeed - a slow UI still gets its full
  // grace period, and a ready UI is acted on within one poll interval.
  async waitFor(fn, { timeout = 9000, interval = 90 } = {}) {
    const end = Date.now() + timeout;
    for (;;) {
      this._checkAbort();
      let val = null;
      try {
        val = fn();
      } catch (_) {
        val = null;
      }
      if (val) return val;
      if (Date.now() > end) return null;
      await this._rawSleep(interval);
    }
  }

  // ── Readiness helpers (UI-driven synchronization) ──────────────────
  // These are the backbone of the new pacing model: before every
  // interaction the engine waits for the target to be interactable, and
  // after every UI-changing action a script waits for the next expected
  // element (or for a transient one to disappear). No fixed sleeps gate
  // correctness - only the DOM does.

  // First interactable element matching `selector` (respecting scope).
  waitForInteractable(selector, { nth = 0, timeout = 9000, requireVisible = true } = {}) {
    return this.waitFor(
      () => {
        const el = this.all(selector, { requireVisible })[nth];
        return el && isInteractable(el, { requireVisible }) ? el : null;
      },
      { timeout }
    );
  }

  // Resolve once at least one visible element matches (element returned).
  waitForVisible(selector, { nth = 0, timeout = 9000 } = {}) {
    return this.waitFor(() => this.one(selector, nth), { timeout });
  }

  // Resolve (true) once nothing visible matches - used to confirm a
  // listbox closed, a modal dismissed, a spinner cleared, etc.
  async waitForGone(selector, { timeout = 9000 } = {}) {
    const ok = await this.waitFor(() => (this.all(selector).length === 0 ? true : null), {
      timeout
    });
    return ok === true;
  }

  // -- Locators (respect current scope) -------------------------------
  _root() {
    return this.scopeEl && this.scopeEl.isConnected ? this.scopeEl : document;
  }

  // Visible matches by default. Pass { requireVisible:false } for
  // intentionally-offscreen controls (custom-checkbox inputs).
  all(selector, { requireVisible = true } = {}) {
    const raw = deepQueryAll(selector, this._root());
    return requireVisible ? raw.filter(isVisible) : raw;
  }

  one(selector, nth = 0) {
    return this.all(selector)[nth] || null;
  }

  // Unfiltered deep query - includes visually-hidden nodes. Used to
  // reach the real <input type=checkbox> behind a faux SLDS glyph.
  deepAll(selector) {
    return deepQueryAll(selector, this._root());
  }

  deepOne(selector, nth = 0) {
    return this.deepAll(selector)[nth] || null;
  }

  byText(selector, text, { nth = 0 } = {}) {
    const want = norm(text);
    const hits = this.all(selector).filter((el) => norm(el.textContent).includes(want));
    // Prefer the tightest match (shortest text) so we grab the button,
    // not an ancestor container that happens to contain the phrase.
    hits.sort((a, b) => norm(a.textContent).length - norm(b.textContent).length);
    return hits[nth] || null;
  }

  openModal() {
    const modals = deepQueryAll('.slds-modal.slds-fade-in-open', document).filter(isVisible);
    const container = modals.length
      ? modals[modals.length - 1].querySelector('.slds-modal__container') ||
        modals[modals.length - 1]
      : null;
    return container;
  }

  // -- Visual affordances ---------------------------------------------
  // Glide the cursor + ring onto `el` and let the glow settle BEFORE the
  // caller acts. Scrolling into view is gated on a raw (unscaled) beat so
  // the rect we read is post-scroll; the settle beat afterwards is
  // cosmetic (scaled by demoSpeed) so the viewer registers where we're
  // about to click.
  async point(el) {
    if (!el) return;
    let r = el.getBoundingClientRect();
    const inView = r.top >= 0 && r.bottom <= (window.innerHeight || 0);
    if (!inView) {
      try {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      } catch (_) {
        /* ignore */
      }
      // Wall-clock settle for the scroll animation (not demoSpeed-scaled)
      // so the rect below is accurate regardless of pacing.
      await this._rawSleep(220);
      r = el.getBoundingClientRect();
    }
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    this.els.cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    const ring = this.els.ring;
    ring.classList.add('is-on');
    ring.style.left = `${r.left - 6}px`;
    ring.style.top = `${r.top - 6}px`;
    ring.style.width = `${r.width + 12}px`;
    ring.style.height = `${r.height + 12}px`;
    // Cosmetic settle so the glow visibly lands on the target first.
    await this.dwell(BEAT.beat);
  }

  // -- Caption ---------------------------------------------------------
  say(text) {
    this.els.bar.classList.add('is-on');
    this.els.txt.textContent = text;
  }

  async step(text, pause = BEAT.read) {
    this._checkAbort();
    this.stepIndex += 1;
    this.els.count.textContent = String(this.stepIndex);
    this.say(text);
    await this.dwell(pause);
  }

  // -- Actions ---------------------------------------------------------
  // ROOT-CAUSE FIX (dropdowns wouldn't open/select): the previous
  // implementation dispatched a synthetic `click` MouseEvent AND called
  // el.click(). For every toggle control in this app - the picklist
  // triggers, the tier multi-select, the account "Create RFQ" caret -
  // the onclick handler flips an `isOpen` boolean, so firing it twice
  // opened the menu then immediately closed it. Options never stayed
  // long enough to pick.
  //
  // Now activation happens EXACTLY ONCE. We still send pointer/mouse
  // press-release beats (some components glow/hover off those and they
  // don't trigger onclick, so they can't double-toggle), then a single
  // native `el.click()` which LWC's real onclick listeners honour and
  // which composes out of every shadow root.
  fireClick(el) {
    // Bridge event so c-demo-cursor can paint its hotspot at the point.
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (rect) {
      document.dispatchEvent(
        new CustomEvent('atlas-demo-click', {
          detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        })
      );
    }
    const opts = { bubbles: true, cancelable: true, composed: true, view: window };
    // Press/release beats only - NOT a click. These feed hover/press
    // visuals without invoking the onclick toggle.
    el.dispatchEvent(new MouseEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    // The single activation. Native click fires the real onclick once.
    if (typeof el.click === 'function') {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent('click', opts));
    }
  }

  // Tick a checkbox to `checked` via a single native click so the
  // component's onchange fires once (used for the tier multi-select and
  // the submission-board row boxes). No-op if already in target state.
  setChecked(el, checked = true) {
    if (!el) return;
    if (!!el.checked === !!checked) return;
    if (typeof el.click === 'function') {
      el.click();
    } else {
      el.checked = checked;
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  }

  setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  // -- High-level combinators (used by scripts) -----------------------
  // Every combinator follows the same UI-gated shape:
  //   1. wait for the target to be interactable (present + visible +
  //      enabled) - wall-clock, unscaled.
  //   2. point (glow settles) then act, exactly once.
  //   3. optionally wait for the NEXT expected state: `expect` (a
  //      selector that must appear) and/or `gone` (a selector that must
  //      disappear) - again wall-clock.
  //   4. a single cosmetic dwell so the beat reads.
  // `optional:true` downgrades a missing target to a quiet skip so a
  // drifted selector degrades the demo instead of freezing it.
  async _settle({ expect, gone } = {}) {
    if (gone) await this.waitForGone(gone);
    if (expect) await this.waitForVisible(expect);
  }

  async click(selector, opts = {}) {
    const { nth = 0, timeout = 9000, optional = false, expect, gone, dwell = BEAT.beat } = opts;
    const el = await this.waitForInteractable(selector, { nth, timeout });
    if (!el) {
      if (!optional) console.warn('[atlasDemo] not interactable:', selector);
      return null;
    }
    await this.point(el);
    this.fireClick(el);
    await this._settle({ expect, gone });
    await this.dwell(dwell);
    return el;
  }

  async clickText(selector, text, opts = {}) {
    const { nth = 0, timeout = 9000, optional = false, expect, gone, dwell = BEAT.beat } = opts;
    const el = await this.waitFor(
      () => {
        const hit = this.byText(selector, text, { nth });
        return hit && isInteractable(hit) ? hit : null;
      },
      { timeout }
    );
    if (!el) {
      if (!optional) console.warn('[atlasDemo] text not interactable:', selector, text);
      return null;
    }
    await this.point(el);
    this.fireClick(el);
    await this._settle({ expect, gone });
    await this.dwell(dwell);
    return el;
  }

  async type(selector, value, opts = {}) {
    const { nth = 0, timeout = 9000, optional = false, expect, gone, dwell = BEAT.tick } = opts;
    const el = await this.waitForInteractable(selector, { nth, timeout });
    if (!el) {
      if (!optional) console.warn('[atlasDemo] input not interactable:', selector);
      return null;
    }
    await this.point(el);
    this.setNativeValue(el, String(value));
    await this._settle({ expect, gone });
    await this.dwell(dwell);
    return el;
  }

  /**
   * Drive a c-picklist to `optionLabel`. The trigger is preferably found
   * by its accessible-label (`label`), which is stable regardless of how
   * many picklists share the scope; falls back to positional `nth`.
   *
   * The sequence is fully UI-gated (this is where dropdowns used to
   * fail): open the trigger → WAIT for the listbox options to render →
   * pick the option → WAIT for the listbox to close. Because fireClick
   * now activates once, the open click no longer immediately re-closes
   * the menu.
   */
  async picklist(optionLabel, { label = null, nth = 0, timeout = 9000, optional = false } = {}) {
    const triggerSel = label
      ? `button[role="combobox"][aria-label="${label}"]`
      : 'c-picklist button[role="combobox"], .picklist__trigger';
    const trigger = await this.waitForInteractable(triggerSel, {
      nth: label ? 0 : nth,
      timeout
    });
    if (!trigger) {
      if (!optional) console.warn('[atlasDemo] picklist trigger not ready', label || nth, optionLabel);
      return false;
    }
    // Already showing the wanted value? Skip to avoid a needless churn.
    if (norm(trigger.textContent).includes(norm(optionLabel))) {
      await this.point(trigger);
      return true;
    }
    await this.point(trigger);
    this.fireClick(trigger);
    // Gate on the menu actually opening.
    const ready = await this.waitFor(() => this.all('li[role="option"]').length > 0, {
      timeout: 4000
    });
    if (!ready) {
      if (!optional) console.warn('[atlasDemo] picklist menu never opened', label || nth);
      return false;
    }
    let opt = this.byText('li[role="option"]', optionLabel);
    if (!opt) {
      opt = this.all('li[role="option"]')[0] || null;
      if (opt) console.warn('[atlasDemo] picklist option fallback →', norm(opt.textContent));
    }
    if (opt) {
      await this.point(opt);
      this.fireClick(opt);
      // Gate on the menu closing so the next step doesn't race the DOM.
      await this.waitForGone('li[role="option"]', { timeout: 3000 });
    }
    await this.dwell(BEAT.beat);
    return true;
  }

  /**
   * Toggle the given tier ids in the EB rate-plan multi-select. The real
   * <input type=checkbox>es carry `data-id` (employeeOnly / employeeSpouse
   * / employeeChildren / employeeFamily) and sit behind a faux SLDS glyph,
   * so we reach them with deepAll (unfiltered by visibility) and tick each
   * with a single native click (fires onchange once). The visible <li> is
   * used for the cursor glow.
   */
  async multiPick(triggerSel, ids, { timeout = 9000 } = {}) {
    const trigger = await this.waitForInteractable(triggerSel, { timeout });
    if (!trigger) {
      console.warn('[atlasDemo] multi trigger not ready', triggerSel);
      return;
    }
    await this.point(trigger);
    this.fireClick(trigger);
    // Gate on the popover's checkboxes existing before we tick.
    const ready = await this.waitFor(
      () => this.deepAll('input.eb-rate__multi-input[data-id]').length > 0,
      { timeout: 4000 }
    );
    if (!ready) {
      console.warn('[atlasDemo] tier menu never opened', triggerSel);
      return;
    }
    for (const id of ids) {
      const box = this.deepOne(`input.eb-rate__multi-input[data-id="${id}"]`);
      if (!box) {
        console.warn('[atlasDemo] tier option not found', id);
        continue;
      }
      const li = box.closest('li') || box;
      await this.point(li);
      this.setChecked(box, true);
      await this.dwell(BEAT.tick);
    }
    // Close the popover.
    this.fireClick(trigger);
    await this.dwell(BEAT.beat);
  }

  // Scope helpers ------------------------------------------------------
  async scopeToModal() {
    const c = await this.waitFor(() => this.openModal(), { timeout: 6000 });
    this.scopeEl = c;
    return c;
  }

  clearScope() {
    this.scopeEl = null;
  }

  // Public API surface handed to a script -----------------------------
  api() {
    return {
      step: (t, p) => this.step(t, p),
      say: (t) => this.say(t),
      // Cosmetic pause (scaled by demoSpeed). `sleep` kept as an alias.
      dwell: (ms) => this.dwell(ms),
      sleep: (ms) => this.dwell(ms),
      beats: BEAT,
      click: (...a) => this.click(...a),
      clickText: (...a) => this.clickText(...a),
      type: (...a) => this.type(...a),
      picklist: (...a) => this.picklist(...a),
      multiPick: (...a) => this.multiPick(...a),
      // Readiness-driven synchronization primitives.
      waitFor: (...a) => this.waitFor(...a),
      waitForVisible: (...a) => this.waitForVisible(...a),
      waitForGone: (...a) => this.waitForGone(...a),
      waitForInteractable: (...a) => this.waitForInteractable(...a),
      one: (...a) => this.one(...a),
      all: (...a) => this.all(...a),
      deepAll: (...a) => this.deepAll(...a),
      deepOne: (...a) => this.deepOne(...a),
      byText: (...a) => this.byText(...a),
      setNativeValue: (el, v) => this.setNativeValue(el, v),
      setChecked: (el, c) => this.setChecked(el, c),
      fireClick: (el) => this.fireClick(el),
      point: (el) => this.point(el),
      openModal: () => this.openModal(),
      scopeToModal: () => this.scopeToModal(),
      clearScope: () => this.clearScope()
    };
  }

  async run() {
    const script = SCRIPTS[this.name] || SCRIPTS['1'];
    // Let the app mount + first paint settle before we grab the wheel.
    await this.waitFor(() => this.all('c-app, .sf-page, [data-atlas-app]').length > 0, {
      timeout: 12000
    });
    await this.sleep(700);
    try {
      await script(this.api());
      await this.step('Demo complete. Thanks for watching!', 2600);
      this.teardown();
    } catch (err) {
      if (err instanceof DemoAborted) return;
      console.error('[atlasDemo] script error:', err);
      this.say('Demo paused - see console for details.');
    }
  }
}

export function startDemoIfRequested() {
  const name = readDemoName();
  if (!name) return;
  const boot = () => {
    const engine = new DemoEngine(name);
    // Expose a manual kill switch for anyone debugging in the console.
    window.__atlasDemo = engine;
    engine.run();
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 400);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(boot, 400));
  }
}

export default startDemoIfRequested;
