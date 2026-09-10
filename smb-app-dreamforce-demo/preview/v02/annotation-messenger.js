/**
 * annotation-messenger.js
 *
 * Drop into any prototype (<script> before </body>).
 * Activate by visiting <prototype-url>?annotate
 *
 * Self-contained: topbar (top), right drawer, auth, pins, popovers.
 * No iframe wrapper. No parent page.
 *
 * Placeholders filled by skill at deploy time:
 *   anamitra-dasgupta       repo owner (e.g. rmanoharan)
 *   SMB-app        repo name  (e.g. ccv0)
 *   SMB App Prototype  display name in the topbar
 */
(function () {
  'use strict';

  const C = {
    owner:    'anamitra-dasgupta',
    repo:     'SMB-app',
    title:    'SMB App Prototype',
    api:      'https://git.soma.salesforce.com/api/v3',
    label:    'annotation',
    clientId: '1463686671c99e285d6b',
  };

  // Check search params, hash params, and raw href — Salesforce pages use hash routing
  // so ?annotate ends up as #/path?annotate or #app/foo?annotate
  const _hasAnnotate = new URLSearchParams(location.search).has('annotate') ||
    location.hash.includes('annotate') ||
    location.href.includes('annotate');
  if (!_hasAnnotate) return;

  // Stable identifier for the current SPA "page" — used to scope pins to the
  // route they were created on. Strips ?annotate so toggling the flag doesn't
  // make pins disappear, and strips trailing slashes so /foo and /foo/ match.
  function currentRoute() {
    const hash = (location.hash || '').replace(/[?&]annotate(=[^&]*)?/g, '').replace(/[?&]$/, '');
    const path = location.pathname.replace(/\/$/, '');
    return (hash || path || '/');
  }
  function matchesRoute(ann) {
    // Backwards-compat: annotations saved before this field existed have no
    // element.route — treat them as global so old data still renders.
    const r = ann.element && ann.element.route;
    return !r || r === currentRoute();
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let token      = localStorage.getItem('ann_token')    || null;
  let username   = localStorage.getItem('ann_username') || null;
  let annotations = [];
  let annotating  = false;
  let highlighted = null;
  let overlay     = null;
  let popoverEl   = null;
  let popoverData = null;
  let connectorEl = null;
  let spotlightEl = null;
  let pollTimer   = null;
  let openPopoverNumber = null;
  let _toastTimer = null;
  let drawerOpen  = false;
  let _labelEnsured = false;

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    /* ── Topbar (top) ── */
    #__ann-bar {
      position: fixed; top: 0; left: 0; right: 0; height: 44px;
      background: #1a1a1a; border-bottom: 1px solid #2e2e2e;
      display: flex; align-items: center; gap: 6px; padding: 0 14px;
      z-index: 2147483645;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px; color: #ccc;
      box-shadow: 0 2px 12px rgba(0,0,0,.3);
    }
    #__ann-bar-title { font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
    #__ann-bar-spacer { flex: 1; }
    .__ann-sep { width: 1px; height: 18px; background: #2e2e2e; flex-shrink: 0; }
    .__ann-bar-btn {
      height: 28px; padding: 0 10px; border-radius: 5px;
      border: 1px solid #333; background: transparent;
      color: #bbb; font-size: 11px; font-family: inherit;
      cursor: pointer; display: flex; align-items: center; gap: 5px;
      white-space: nowrap; transition: background .12s, color .12s, border-color .12s;
    }
    .__ann-bar-btn:hover { background: #2a2a2a; color: #fff; border-color: #444; }
    .__ann-bar-btn.active { background: #066AFE; border-color: #066AFE; color: #fff; }
    .__ann-bar-btn kbd {
      padding: 1px 4px; border-radius: 3px; border: 1px solid #444;
      font-size: 9px; font-family: inherit; background: #111; color: #666;
    }
    .__ann-bar-btn.active kbd { border-color: rgba(255,255,255,.3); background: rgba(0,0,0,.2); color: rgba(255,255,255,.6); }

    /* Count button — badge-style, always visible */
    #__ann-btn-count {
      height: 28px; padding: 0 10px; border-radius: 5px;
      border: 1px solid #333; background: transparent;
      color: #bbb; font-size: 11px; font-family: inherit;
      cursor: pointer; display: flex; align-items: center; gap: 6px;
      white-space: nowrap; transition: background .12s, color .12s, border-color .12s;
    }
    #__ann-btn-count:hover { background: #2a2a2a; color: #fff; border-color: #444; }
    #__ann-btn-count.active { background: #2a2a2a; border-color: #555; color: #fff; }
    #__ann-btn-count .badge {
      min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
      background: #066AFE; color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      line-height: 1;
    }
    #__ann-btn-count .badge.empty { background: #333; color: #666; }

    /* ── Right drawer ── */
    #__ann-drawer {
      position: fixed; top: 44px; right: 0; bottom: 0; width: 320px;
      background: #fff; border-left: 1px solid #e8e8e8;
      box-shadow: -4px 0 20px rgba(0,0,0,.1);
      z-index: 2147483644;
      display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      transform: translateX(100%);
      transition: transform .22s cubic-bezier(.4,0,.2,1);
      pointer-events: none;
    }
    #__ann-drawer.open { transform: translateX(0); pointer-events: auto; }
    #__ann-drawer-header {
      display: flex; align-items: center; padding: 14px 16px 12px;
      border-bottom: 1px solid #f0f0f0; flex-shrink: 0;
    }
    #__ann-drawer-title { font-size: 13px; font-weight: 600; color: #1e1e1e; flex: 1; }
    #__ann-drawer-close {
      width: 26px; height: 26px; border-radius: 5px; border: none;
      background: transparent; cursor: pointer; color: #999; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
    }
    #__ann-drawer-close:hover { background: #f5f5f5; color: #1e1e1e; }
    #__ann-drawer-list { flex: 1; overflow-y: auto; padding: 10px 12px; }
    #__ann-drawer-empty {
      padding: 40px 16px; text-align: center;
      font-size: 13px; color: #b3b3b3; line-height: 1.6;
    }

    /* Drawer annotation card */
    .__ann-card {
      border: 1px solid #ebebeb; border-radius: 8px; margin-bottom: 8px;
      overflow: hidden; cursor: pointer;
      transition: box-shadow .12s, border-color .12s;
    }
    .__ann-card:hover { border-color: #d0d0d0; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
    .__ann-card.highlighted { border-color: #066AFE; box-shadow: 0 0 0 2px rgba(6,106,254,.15); }
    .__ann-card-head {
      display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px 8px;
    }
    .__ann-card-num {
      width: 22px; height: 22px; border-radius: 50%; background: #1e1e1e;
      color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 1px;
    }
    .__ann-card-body { flex: 1; min-width: 0; }
    .__ann-card-selector {
      font-size: 10px; font-family: monospace; color: #b3b3b3;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 3px;
    }
    .__ann-card-preview {
      font-size: 12px; color: #333; line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .__ann-card-meta {
      padding: 0 12px 8px 44px;
      display: flex; align-items: center; gap: 8px;
    }
    .__ann-card-author { font-size: 11px; color: #888; }
    .__ann-card-date   { font-size: 11px; color: #c0c0c0; }
    .__ann-card-reply-count { font-size: 11px; color: #066AFE; margin-left: auto; }
    .__ann-card-actions {
      display: flex; gap: 6px; padding: 8px 10px;
      border-top: 1px solid #f5f5f5;
    }
    .__ann-card-btn {
      flex: 1; height: 28px; border-radius: 6px;
      border: 1px solid #e0e0e0; background: #fff;
      font-size: 11px; font-family: inherit; color: #555; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 5px;
      transition: background .1s, border-color .1s;
    }
    .__ann-card-btn:hover { background: #f5f5f5; border-color: #d0d0d0; }
    .__ann-card-btn.resolve:hover { background: #f0faf8; border-color: #0B827C; color: #0B827C; }
    .__ann-card-btn.reopen:hover  { background: #f0f5ff; border-color: #066AFE; color: #066AFE; }
    .__ann-card-btn.copy:hover    { background: #f0f5ff; border-color: #066AFE; color: #066AFE; }

    /* ── Pin overlay (fallback for annotations with no element reference) ── */
    #__ann-overlay {
      position: fixed; top: 0; left: 0; width: 0; height: 0;
      overflow: visible; z-index: 2147483640; pointer-events: none;
    }
    /* Base pin style — element-attached pins use inline styles to cross shadow boundaries */
    .__ann-pin {
      position: absolute; width: 26px; height: 26px; border-radius: 50%;
      top: 4px; right: 4px;
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto; cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px; font-weight: 700; color: #fff;
      user-select: none; transition: transform .12s;
      box-shadow: 0 2px 8px rgba(0,0,0,.35);
      background: #1e1e1e;
    }
    .__ann-pin:hover { transform: scale(1.15); }
    .__ann-pin-pending { opacity: .45; pointer-events: none; }

    /* ── Popover ── */
    #__ann-popover {
      position: fixed; width: 300px; display: none;
      background: #fff; border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,.18), 0 1px 4px rgba(0,0,0,.08);
      z-index: 2147483647; pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px; color: #1e1e1e; overflow: hidden;
    }
    #__ann-popover.visible { display: block; }
    .__ann-pop-header {
      display: flex; align-items: center; gap: 4px;
      padding: 11px 8px 11px 14px; border-bottom: 1px solid #ebebeb;
    }
    .__ann-pop-title { font-weight: 600; font-size: 13px; flex: 1; }
    .__ann-pop-close {
      width: 26px; height: 26px; border-radius: 5px; border: none;
      background: transparent; cursor: pointer; color: #888; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: background .1s;
    }
    .__ann-pop-close:hover { background: #f0f0f0; color: #1e1e1e; }
    .__ann-pop-element {
      display: block; padding: 5px 14px;
      font-size: 10px; font-family: monospace; color: #aaa;
      border-bottom: 1px solid #f2f2f2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      background: #fafafa;
    }
    .__ann-pop-missing {
      display: block; padding: 6px 14px;
      font-size: 11px; color: #8a4b02;
      background: #fff8e6; border-bottom: 1px solid #f2e0b7;
    }

    /* ── Drawer sections + off-page cards ────────────────────────────── */
    .__ann-drawer-section-title {
      font-size: 11px; font-weight: 600; color: #5c5c5c;
      text-transform: uppercase; letter-spacing: .05em;
      padding: 12px 14px 6px 14px;
      border-top: 1px solid #ebebeb;
    }
    .__ann-drawer-section-title.away { color: #757575; }
    .__ann-drawer-section-title.elsewhere { color: #8C4B02; }
    .__ann-drawer-section-title.resolved { color: #0B827C; }

    /* Sweep banner — appears at the top of the drawer when there are
       legacy annotations without a stored URL. Amber tint so it reads as
       "here's a task you can do", not an error. During an active sweep
       we swap the CTA for a progress line + cancel affordance. */
    .__ann-sweep-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px;
      background: #fff8e6;
      border-bottom: 1px solid #f2e0b7;
      font-size: 12px; color: #8C4B02;
    }
    .__ann-sweep-banner.active {
      background: #f0f5ff; border-bottom-color: #cfe0ff; color: #0250D9;
    }
    .__ann-sweep-label, .__ann-sweep-progress { flex: 1 1 auto; }
    .__ann-sweep-start, .__ann-sweep-cancel {
      flex: 0 0 auto;
      padding: 4px 10px; font-size: 12px; font-weight: 600;
      background: #066AFE; color: #fff; border: none; border-radius: 4px;
      cursor: pointer;
    }
    .__ann-sweep-start:hover, .__ann-sweep-cancel:hover { background: #0250D9; }
    .__ann-sweep-cancel { background: #757575; }
    .__ann-sweep-cancel:hover { background: #444; }
    .__ann-drawer-section-title:first-child { border-top: none; }
    /* Resolved cards: dimmed with a subtle green tint so they read as
       "done" without becoming invisible. Author + comment preview stay
       legible; the number badge fades. Cards remain clickable for context
       + Reopen. */
    .__ann-card.resolved {
      opacity: .7;
      background: #f5faf9;
    }
    .__ann-card.resolved:hover { opacity: 1; background: #eefaf6; cursor: pointer; }
    .__ann-card.resolved .__ann-card-num {
      background: #0B827C;
    }
    .__ann-card.resolved .__ann-card-preview {
      text-decoration: line-through;
      text-decoration-color: rgba(11, 130, 124, 0.4);
    }
    .__ann-drawer-empty-inline {
      padding: 4px 14px 8px 14px; font-size: 12px; color: #939393;
    }
    .__ann-card.off-page { opacity: .82; }
    .__ann-card.off-page:hover { opacity: 1; background: #f7f9fc; cursor: pointer; }
    .__ann-card-route-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: #eef2ff; color: #3a49da;
      font-size: 10px; font-family: monospace; padding: 2px 6px;
      border-radius: 4px; margin-left: auto;
    }
    .__ann-card.off-page .__ann-card-route-badge {
      background: #f3f3f3; color: #5c5c5c;
    }
    /* "Elsewhere on this page" cards: target isn't in current DOM, so no
       pin got drawn. Amber tint on the route chip signals the difference
       from off-page (grey) and on-view (blue) siblings. */
    .__ann-card.elsewhere-here {
      background: #fffbf1;
    }
    .__ann-card.elsewhere-here:hover { background: #fff5df; cursor: pointer; }
    .__ann-card-route-badge.elsewhere {
      background: #fff2d9; color: #8C4B02;
    }
    /* ── Off-page card: "Go to page" CTA + destination URL banner ─────
       Off-page cards keep the full comment view but replace passive
       location chips with an actionable "Go to page" button. The banner
       above the actions row shows the exact destination URL so reviewers
       know where they're jumping to. */
    .__ann-card-page-banner {
      display: flex; align-items: center; gap: 6px;
      margin: 6px 12px 8px;
      padding: 6px 8px;
      background: #f0f5ff;
      border-left: 3px solid #066AFE;
      border-radius: 3px;
      font-size: 11px; color: #1e1e1e;
      overflow: hidden;
    }
    .__ann-card-page-banner-label {
      flex: 0 0 auto;
      color: #5c5c5c; font-weight: 600;
      text-transform: uppercase; letter-spacing: .04em; font-size: 10px;
    }
    .__ann-card-page-banner-url {
      flex: 1 1 auto;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", monospace;
      color: #066AFE;
    }
    /* Missing-URL variant: legacy annotations without a captured href.
       Amber tint to signal "unsaved state" — reviewer knows there's no
       navigation target. Browsing the prototype will auto-heal these. */
    .__ann-card-page-banner.missing {
      background: #fff8e6;
      border-left-color: #DD7A01;
      cursor: help;
    }
    .__ann-card-page-banner.missing .__ann-card-page-banner-url {
      color: #8C4B02; font-style: italic;
    }
    /* Manual "Tag as this URL" affordance on legacy off-page cards.
       Minimal link styling (not a button) so it doesn't compete with
       Resolve/Copy/Go-to-page. Visible only when the reviewer might be
       standing on the state where the pin belongs. */
    .__ann-card-tag-here {
      display: block; width: 100%;
      margin: 0 12px 8px 12px; padding: 6px 0;
      background: transparent; border: none;
      color: #0250D9; font: inherit; font-size: 11px;
      text-align: left; cursor: pointer;
      text-decoration: underline; text-underline-offset: 2px;
    }
    .__ann-card-tag-here:hover { color: #022AC0; }
    .__ann-card-tag-here:disabled { color: #939393; cursor: default; text-decoration: none; }
    .__ann-card-btn.goto {
      background: #066AFE; color: #fff; border-color: #066AFE;
    }
    .__ann-card-btn.goto:hover {
      background: #0250D9; border-color: #0250D9;
    }
    .__ann-comments { max-height: 260px; overflow-y: auto; }
    .__ann-comment { display: flex; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #f2f2f2; }
    .__ann-comment:last-child { border-bottom: none; }
    .__ann-c-avatar {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: #fff; margin-top: 1px;
    }
    .__ann-c-content { flex: 1; min-width: 0; }
    .__ann-comment-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .__ann-c-author { font-size: 12px; font-weight: 600; color: #1e1e1e; flex: 1; }
    .__ann-c-date   { font-size: 11px; color: #b3b3b3; }
    .__ann-c-body   { font-size: 13px; color: #333; line-height: 1.55; white-space: pre-wrap; }
    .__ann-reply {
      display: flex; gap: 8px; align-items: flex-end;
      padding: 10px 10px 10px 14px; border-top: 1px solid #ebebeb;
    }
    .__ann-reply-avatar {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: #fff; margin-bottom: 2px;
    }
    .__ann-reply-input {
      flex: 1; height: 32px; min-height: 32px; max-height: 120px;
      resize: none; overflow-y: hidden;
      background: #f5f5f5; border: 1px solid transparent; border-radius: 16px;
      color: #1e1e1e; font-size: 13px; padding: 7px 14px;
      font-family: inherit; line-height: 1.4; outline: none; box-sizing: border-box;
    }
    .__ann-reply-input::placeholder { color: #c0c0c0; }
    .__ann-reply-input:focus { border-color: #18a0fb; background: #fff; }
    .__ann-reply-send {
      width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%;
      background: #1e1e1e; border: none; color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      align-self: flex-end; transition: background .12s;
    }
    .__ann-reply-send:hover    { background: #18a0fb; }
    .__ann-reply-send:disabled { background: #e6e6e6; cursor: default; color: #c0c0c0; }
    .__ann-signin-hint { padding: 10px 14px; font-size: 11px; color: #b3b3b3; border-top: 1px solid #ebebeb; }

    /* ── Composer ── */
    #__ann-composer {
      position: fixed; z-index: 2147483646;
      background: #fff; border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,.18), 0 1px 4px rgba(0,0,0,.08);
      width: 260px; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #__ann-composer textarea {
      width: 100%; min-height: 72px; resize: none; border: none; outline: none;
      padding: 12px 14px; font-size: 13px; font-family: inherit;
      color: #1e1e1e; line-height: 1.5; box-sizing: border-box;
    }
    #__ann-composer textarea::placeholder { color: #c0c0c0; }
    .__ann-comp-btns {
      display: flex; justify-content: flex-end; gap: 6px;
      padding: 8px 10px; border-top: 1px solid #f2f2f2;
    }
    .__ann-comp-btn {
      height: 28px; padding: 0 12px; border-radius: 6px;
      border: 1px solid #e0e0e0; background: #fff;
      font-size: 12px; font-family: inherit; color: #555; cursor: pointer;
    }
    .__ann-comp-btn:hover { background: #f5f5f5; }
    .__ann-comp-btn.primary { background: #1e1e1e; border-color: #1e1e1e; color: #fff; }
    .__ann-comp-btn.primary:hover { background: #333; }
    .__ann-comp-elem {
      padding: 6px 14px; font-size: 10px; font-family: monospace;
      color: #aaa; border-bottom: 1px solid #f2f2f2; background: #fafafa;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ── Auth modal ── */
    #__ann-auth-modal {
      display: none; position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0,0,0,.5); align-items: center; justify-content: center;
    }
    #__ann-auth-modal.visible { display: flex; }
    #__ann-auth-box {
      background: #fff; border-radius: 12px; padding: 28px 24px; width: 340px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
    }
    #__ann-auth-box h2 { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #1e1e1e; }
    #__ann-auth-box p  { font-size: 13px; color: #555; margin: 0 0 16px; line-height: 1.5; }
    #__ann-dcode-wrap { display: none; text-align: center; margin-bottom: 16px; }
    #__ann-dcode-wrap.visible { display: block; }
    #__ann-dcode {
      font-size: 24px; font-weight: 700; letter-spacing: 4px;
      font-family: monospace; color: #1e1e1e; background: #f5f5f5;
      padding: 10px 16px; border-radius: 8px; display: inline-block;
      margin-bottom: 6px;
    }
    #__ann-dcode-wrap small { font-size: 11px; color: #888; display: block; }
    .__ann-auth-btns { display: flex; gap: 8px; justify-content: flex-end; }
    .__ann-auth-btn {
      height: 32px; padding: 0 16px; border-radius: 6px; border: 1px solid #e0e0e0;
      background: #fff; font-size: 13px; font-family: inherit; color: #555; cursor: pointer;
    }
    .__ann-auth-btn:hover { background: #f5f5f5; }
    .__ann-auth-btn.primary { background: #1e1e1e; border-color: #1e1e1e; color: #fff; }
    .__ann-auth-btn.primary:hover { background: #333; }

    /* ── Toast ── */
    #__ann-toast {
      position: fixed; top: 56px; left: 50%; transform: translateX(-50%);
      background: #1e1e1e; color: #fff; font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 8px 16px; border-radius: 20px;
      box-shadow: 0 4px 16px rgba(0,0,0,.3);
      z-index: 2147483647; pointer-events: none;
      opacity: 0; transition: opacity .2s;
      white-space: nowrap;
    }
    #__ann-toast.show { opacity: 1; }

    /* ── Highlight ── */
    .__ann-highlight {
      outline: 2px solid #18a0fb !important;
      outline-offset: 2px !important;
      background-color: rgba(24,160,251,.06) !important;
      cursor: crosshair !important;
    }
    .__ann-highlight * { cursor: crosshair !important; }

    /* ── Spotlight overlay — a floating box positioned over the tagged
       element. Renders as a bold outline+glow+wash regardless of whether
       the target is an inline span, a button, a card, or anything else.
       Position is updated by the RAF loop each frame so it tracks scrolling
       and layout shifts. Not applied to the target itself → no CSS conflict
       with the target's own styling. */
    #__ann-spotlight {
      position: fixed; pointer-events: none;
      display: none; box-sizing: border-box;
      z-index: 2147483644;
      background: rgba(6, 106, 254, 0.14);
      border-radius: 6px;
      box-shadow:
        0 0 0 5px rgba(6, 106, 254, .25),
        0 0 30px 8px rgba(6, 106, 254, .55);
    }
    #__ann-spotlight.visible {
      display: block;
      animation: __ann-spotlight-pulse 1.3s ease-in-out 3;
    }
    @keyframes __ann-spotlight-pulse {
      0%, 100% {
        background: rgba(6, 106, 254, 0.14);
        box-shadow:
          0 0 0 5px rgba(6, 106, 254, .25),
          0 0 30px 8px rgba(6, 106, 254, .55);
        transform: scale(1);
      }
      50% {
        background: rgba(6, 106, 254, 0.30);
        box-shadow:
          0 0 0 10px rgba(6, 106, 254, .40),
          0 0 50px 14px rgba(6, 106, 254, .80);
        transform: scale(1.04);
      }
    }

    /* ── SVG connector: dashed line from popover to the annotated element ── */
    #__ann-connector {
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      pointer-events: none; z-index: 2147483645;
      overflow: visible;
    }
    #__ann-connector .__ann-conn-line {
      stroke: #066AFE; stroke-width: 2; stroke-dasharray: 5 4;
      opacity: .9; fill: none;
    }
    #__ann-connector .__ann-conn-dot {
      fill: #066AFE;
    }
  `;
  document.head.appendChild(css);

  // ── DOM ───────────────────────────────────────────────────────────────────
  // Topbar
  const bar = document.createElement('div');
  bar.id = '__ann-bar';
  bar.innerHTML = `
    <span id="__ann-bar-title">${esc(C.title || document.title || 'Prototype')}</span>
    <div id="__ann-bar-spacer"></div>
    <button class="__ann-bar-btn" id="__ann-btn-share">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/>
        <path d="M10.3 5l-4.6 2M10.3 11l-4.6-2" stroke="currentColor" stroke-width="1.4"/>
      </svg>
      Share
    </button>
    <div class="__ann-sep"></div>
    <button class="__ann-bar-btn" id="__ann-btn-add">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
        <line x1="8" y1="5" x2="8" y2="11" stroke="currentColor" stroke-width="1.5"/>
        <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      Add annotation
      <kbd>A</kbd>
    </button>
    <div class="__ann-sep"></div>
    <button id="__ann-btn-count">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h8M2 12h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span id="__ann-count-label">Annotations</span>
      <span class="badge empty" id="__ann-count-badge">0</span>
    </button>
    <div class="__ann-sep"></div>
    <button class="__ann-bar-btn" id="__ann-btn-auth">Sign in</button>
  `;
  document.body.appendChild(bar);

  // Right drawer
  const drawer = document.createElement('div');
  drawer.id = '__ann-drawer';
  drawer.innerHTML = `
    <div id="__ann-drawer-header">
      <span id="__ann-drawer-title">Annotations</span>
      <button id="__ann-drawer-close">×</button>
    </div>
    <div id="__ann-drawer-list"></div>
  `;
  document.body.appendChild(drawer);

  // Auth modal
  const authModal = document.createElement('div');
  authModal.id = '__ann-auth-modal';
  authModal.innerHTML = `
    <div id="__ann-auth-box">
      <h2>Sign in to annotate</h2>
      <p id="__ann-auth-msg">Uses your Soma account. A code appears — paste it at the Soma page that opens. One click if you're already logged in.</p>
      <div id="__ann-dcode-wrap">
        <div id="__ann-dcode"></div>
        <small>Enter at git.soma.salesforce.com/login/device</small>
      </div>
      <div class="__ann-auth-btns">
        <button class="__ann-auth-btn" id="__ann-auth-cancel">Cancel</button>
        <button class="__ann-auth-btn primary" id="__ann-auth-go">Sign in with Soma</button>
      </div>
    </div>`;
  document.body.appendChild(authModal);

  // Toast
  const toast = document.createElement('div');
  toast.id = '__ann-toast';
  document.body.appendChild(toast);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const btnAdd        = document.getElementById('__ann-btn-add');
  const btnAuth       = document.getElementById('__ann-btn-auth');
  const btnShare      = document.getElementById('__ann-btn-share');
  const btnCount      = document.getElementById('__ann-btn-count');
  const countBadge    = document.getElementById('__ann-count-badge');
  const drawerList    = document.getElementById('__ann-drawer-list');
  const drawerTitle   = document.getElementById('__ann-drawer-title');
  const btnDrawerClose = document.getElementById('__ann-drawer-close');

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function avatarColor(author) {
    const colors = ['#18a0fb','#9747ff','#f24e1e','#0acf83','#ff7262','#1abcfe'];
    let h = 0;
    for (let i = 0; i < (author || '').length; i++) h = (h * 31 + author.charCodeAt(i)) & 0xffff;
    return colors[h % colors.length];
  }
  function apiHeaders() {
    const h = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) h.Authorization = `token ${token}`;
    return h;
  }
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(_toastTimer); _toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }
  function buildClaudeText(ann) {
    const lines = [
      `Annotation on \`${ann.element?.selector || 'screen'}\`${ann.element?.label ? ` ("${ann.element.label}")` : ''}`,
      '', 'Thread:',
      ...ann.comments.map(c => `- @${c.author}: ${c.body}`),
      '', `Prototype: ${location.href}`,
      'Please suggest specific code changes to address this feedback.',
    ];
    return lines.join('\n');
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  function toggleDrawer() {
    drawerOpen = !drawerOpen;
    drawer.classList.toggle('open', drawerOpen);
    btnCount.classList.toggle('active', drawerOpen);
    if (drawerOpen) renderDrawer();
  }

  function openDrawer() {
    if (!drawerOpen) toggleDrawer();
  }

  btnCount.addEventListener('click', toggleDrawer);
  btnDrawerClose.addEventListener('click', () => {
    drawerOpen = false; drawer.classList.remove('open'); btnCount.classList.remove('active');
  });

  // Short human label for a stored route. Strips the common Pages prefix so
  // "/pages/anamitra-dasgupta/SMB-app/preview/v02/setup-135753.html" becomes
  // "setup-135753.html". Empty / index paths become "index".
  function routeShortLabel(route) {
    if (!route) return '';
    const seg = route.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() || '';
    return seg || 'index';
  }

  // True when the annotation's tagged element is in the current DOM (either
  // via _liveTarget still connected, or shadowQuery of its selector resolves).
  // If the annotation has no selector at all it's a whole-page pin and is
  // always considered "visible here". Used by renderDrawer to distinguish
  // actionable annotations from ones stranded on a different app state.
  function annotationTargetVisible(ann) {
    if (!ann.element?.selector) return true;
    if (ann._liveTarget && document.body.contains(ann._liveTarget)) return true;
    try { return !!shadowQuery(ann.element.selector); } catch { return false; }
  }

  // Current URL as an annotation-comparable key: pathname + search + hash,
  // with the transient ?annotate flag stripped so toggling it doesn't move
  // annotations between "on this page" and "other pages".
  function currentPageHref() {
    try {
      const u = new URL(location.href);
      u.searchParams.delete('annotate');
      return u.pathname + (u.search || '') + (u.hash || '');
    } catch { return location.pathname; }
  }

  // Bucket key for grouping annotations by "page". Preferred order:
  //   1. captured href (new annotations) — most precise state pointer
  //   2. captured route (legacy annotations) — pathname only
  //   3. '(unknown)' — no route at all (whole-page pins without context)
  function annotationPageKey(ann) {
    return ann.element?.href || ann.element?.route || '(unknown)';
  }

  // True when the annotation belongs to the *current* page. Two ways to
  // qualify:
  //   1. href match — the annotation was pinned on this exact URL state
  //      (new annotations always have href).
  //   2. Legacy fallback — no href stored, but the target element is
  //      currently visible in the DOM (so effectively "here right now").
  function annotationOnCurrentPage(ann) {
    if (ann.element?.href) return ann.element.href === currentPageHref();
    return annotationTargetVisible(ann);
  }

  // Short human label for a page key, for the "Other pages" list.
  //   "/pages/.../preview/v02/setup-135753.html" → "setup-135753.html"
  //   "/pages/.../preview/v02/?tab=account-acme" → "?tab=account-acme"
  //   "/pages/.../preview/v02" → "index"
  function pageKeyLabel(key) {
    if (!key || key === '(unknown)') return 'state unknown';
    try {
      // Full URL-shaped key
      const u = new URL(key, location.origin);
      const seg = u.pathname.replace(/\/$/, '').split('/').filter(Boolean).pop() || 'index';
      const q = u.search || '';
      const h = u.hash || '';
      if (q || h) return (seg === 'index' ? '' : seg + ' ') + (q + h);
      return seg;
    } catch {
      // Not a full URL — treat as pathname
      const seg = key.replace(/[?#].*$/, '').replace(/\/$/, '').split('/').filter(Boolean).pop() || 'index';
      const qi = key.search(/[?#]/);
      return qi >= 0 ? `${seg === 'index' ? '' : seg + ' '}${key.slice(qi)}` : seg;
    }
  }

  function renderDrawer() {
    const real = annotations.filter(a => !a._pending);
    // Grouping model (Figma-style):
    // - "On this page" = the ONLY section that renders full comment cards.
    //   Contains open annotations whose captured href matches the current
    //   URL, or (for legacy annotations without href) whose target is
    //   currently visible in the DOM.
    // - "Other pages" = a compact list of clickable page links, one per
    //   unique page key that has at least one open annotation not on the
    //   current page. Clicking navigates. No comment cards shown here —
    //   this keeps focus on the current page's actionable feedback.
    // - "Resolved" = closed annotations that DO belong to the current
    //   page (same qualification rule as On this page). Preserved for
    //   context + Reopen. Off-page resolved annotations are folded into
    //   their respective "Other pages" link count.
    const openAnns   = real.filter(a => a.state !== 'closed');
    const closedAnns = real.filter(a => a.state === 'closed');
    const openHere   = openAnns.filter(annotationOnCurrentPage);
    const openAway   = openAnns.filter(a => !annotationOnCurrentPage(a));
    const closedHere = closedAnns.filter(annotationOnCurrentPage);
    const closedAway = closedAnns.filter(a => !annotationOnCurrentPage(a));

    drawerTitle.textContent = `Annotations (${real.length})`;

    if (!real.length) {
      drawerList.innerHTML = `<div id="__ann-drawer-empty">No annotations yet.<br>Press <strong>A</strong> or click "Add annotation" to pin a comment on any element.</div>`;
      return;
    }

    const renderCard = (ann, i, offPage) => {
      const idx = i + 1;
      const first = ann.comments[0];
      const replyCount = ann.comments.length - 1;
      const isResolved = ann.state === 'closed';
      const pageKey = annotationPageKey(ann);
      const selectorLabel = ann.element?.selector
        ? `<div class="__ann-card-selector">${esc(ann.element.selector)}</div>`
        : '';
      const replyBadge = replyCount > 0
        ? `<span class="__ann-card-reply-count">${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}</span>`
        : '';
      // A pageKey is "navigable" only when it carries query/hash state OR
      // maps to a different pathname than we're on now. For legacy
      // annotations that stored just a bare pathname matching ours, the
      // destination would land on the same URL we're already on — so we
      // can't meaningfully "go" anywhere. In that case we skip the button
      // and show a plain "URL not saved" note instead.
      const hasNavigableKey = (() => {
        if (!pageKey || pageKey === '(unknown)') return false;
        try {
          const dest = new URL(pageKey, location.origin);
          const cur = new URL(currentPageHref(), location.origin);
          if (dest.pathname !== cur.pathname) return true;
          if (dest.search && dest.search !== cur.search) return true;
          if (dest.hash && dest.hash !== cur.hash) return true;
          return false;
        } catch { return false; }
      })();
      // "Go to page" CTA — appears only on off-page, OPEN cards WITH a
      // navigable pageKey. Suppressed on resolved cards because the comment
      // is already closed; the strikethrough + Reopen buttons should be the
      // dominant signal, not a "jump there" action.
      const goToPageBtn = (offPage && hasNavigableKey && !isResolved)
        ? `<button class="__ann-card-btn goto" data-page-key="${esc(pageKey)}" title="${esc(pageKey)}">
             <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M6 3.5H3.5v7h7V8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 2h4.5v4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 7l5.5-5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
             Go to page
           </button>`
        : '';
      // Resolve/Reopen work from ANY card (on-page or off-page) — Figma
      // sidebar behavior. For off-page Resolve, the click handler shows a
      // confirm() dialog since the pin isn't visible and it's easy to
      // misclick. Reopen has no confirm — it's non-destructive.
      let stateBtn = '';
      if (token) {
        if (isResolved) {
          stateBtn = `<button class="__ann-card-btn reopen" data-num="${ann.number}">
             <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 0 1 8.5-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10.5 1.5v2.5h-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7a5 5 0 0 1-8.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3.5 12.5v-2.5h2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
             Reopen
           </button>`;
        } else {
          stateBtn = `<button class="__ann-card-btn resolve" data-num="${ann.number}" data-off-page="${offPage ? '1' : '0'}">
             <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 7l1.8 1.8 3.2-3.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
             Resolve
           </button>`;
        }
      }
      // Page-URL banner strip under the meta line — shows the destination
      // URL (or "URL not saved" for legacy annotations without a
      // navigable page key). Only rendered on off-page cards.
      const pageBanner = offPage
        ? (hasNavigableKey
            ? `<div class="__ann-card-page-banner" title="${esc(pageKey)}"><span class="__ann-card-page-banner-label">Page:</span> <span class="__ann-card-page-banner-url">${esc(pageKeyLabel(pageKey))}</span></div>`
            : `<div class="__ann-card-page-banner missing" title="This comment's exact page URL wasn't captured — browse the app and the messenger will auto-tag it when the pinned element becomes visible."><span class="__ann-card-page-banner-label">Page:</span> <span class="__ann-card-page-banner-url">URL not saved</span></div>`)
        : '';
      // Manual "Tag as this URL" fallback for legacy annotations pinned
      // inside modal/dynamic-tab states that no URL sweep can reach. Shown
      // when the annotation lacks href AND the current user is signed in
      // AND the annotation is still open — no point re-tagging a resolved
      // comment (it's already closed and the URL association no longer
      // gates any future workflow).
      const tagHereLink = (offPage && token && !ann.element?.href && !isResolved)
        ? `<button type="button" class="__ann-card-tag-here" data-num="${ann.number}" title="Save the URL you're viewing right now as this comment's page — useful when the pin lives inside a modal or click-driven state a sweep can't reach.">Pinned here? Tag as this URL</button>`
        : '';
      const classes = [
        '__ann-card',
        offPage ? 'off-page' : '',
        isResolved ? 'resolved' : ''
      ].filter(Boolean).join(' ');
      return `
        <div class="${classes}" data-num="${ann.number}" data-page-key="${esc(pageKey)}">
          <div class="__ann-card-head">
            <div class="__ann-card-num">${idx}</div>
            <div class="__ann-card-body">
              ${selectorLabel}
              <div class="__ann-card-preview">${esc(first.body)}</div>
            </div>
          </div>
          <div class="__ann-card-meta">
            <span class="__ann-card-author">@${esc(first.author)}</span>
            <span class="__ann-card-date">${fmtDate(first.date)}</span>
            ${replyBadge}
          </div>
          ${pageBanner}
          ${tagHereLink}
          <div class="__ann-card-actions">
            ${goToPageBtn}
            ${stateBtn}
            <button class="__ann-card-btn copy" data-num="${ann.number}">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="4" width="8" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M4 4V3a1.5 1.5 0 0 1 1.5-1.5H11A1.5 1.5 0 0 1 12.5 3v7A1.5 1.5 0 0 1 11 11.5h-1" stroke="currentColor" stroke-width="1.3"/></svg>
              Copy for Claude
            </button>
          </div>
        </div>`;
    };

    const hereHtml = openHere.length
      ? `<div class="__ann-drawer-section-title">On this page (${openHere.length})</div>` + openHere.map((a, i) => renderCard(a, i, false)).join('')
      : `<div class="__ann-drawer-section-title">On this page (0)</div><div class="__ann-drawer-empty-inline">No comments on this page. Cards below have a Go to page button to jump.</div>`;

    // "Other pages" — full comment cards for annotations pinned elsewhere,
    // each with a "Go to page" CTA that shows the destination URL and
    // navigates on click. Reviewers see WHAT the comment says and WHERE it
    // belongs in the same view.
    const awayHtml = openAway.length
      ? `<div class="__ann-drawer-section-title away">Other pages (${openAway.length})</div>`
        + openAway.map((a, i) => renderCard(a, i, true)).join('')
      : '';

    const resolvedCount = closedHere.length + closedAway.length;
    const resolvedHtml = resolvedCount
      ? `<div class="__ann-drawer-section-title resolved">Resolved (${resolvedCount})</div>`
        + closedHere.map((a, i) => renderCard(a, i, false)).join('')
        + closedAway.map((a, i) => renderCard(a, i, true)).join('')
      : '';

    // Sweep banner: shown only when at least one open annotation lacks
    // href. During an active sweep we show a progress line + cancel
    // button; otherwise a plain "Locate N legacy comments" CTA.
    const legacyOpen = openAnns.filter(
      a => a.element?.selector && !a.element?.href
    );
    let sweepHtml = '';
    if (_sweepActive) {
      sweepHtml = `<div class="__ann-sweep-banner active">
        <span class="__ann-sweep-progress">Locating comment ${_sweepDone} of ${_sweepTotal}… (${_sweepHealed} matched)</span>
        <button type="button" class="__ann-sweep-cancel">Cancel</button>
      </div>`;
    } else if (legacyOpen.length) {
      sweepHtml = `<div class="__ann-sweep-banner">
        <span class="__ann-sweep-label">${legacyOpen.length} legacy comment${legacyOpen.length === 1 ? '' : 's'} without a saved URL.</span>
        <button type="button" class="__ann-sweep-start">Locate</button>
      </div>`;
    }

    drawerList.innerHTML = sweepHtml + hereHtml + awayHtml + resolvedHtml;

    // Wire sweep controls.
    const startBtn = drawerList.querySelector('.__ann-sweep-start');
    if (startBtn) startBtn.addEventListener('click', () => { sweepLegacyAnnotations(); });
    const cancelBtn = drawerList.querySelector('.__ann-sweep-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { _sweepCancelled = true; });

    // Wire per-card "Tag as this URL" links. Manual escape hatch for
    // annotations pinned inside modal/dynamic-tab states — the reviewer
    // navigates to where the comment belongs, then clicks this on that
    // card to stamp the current URL as the annotation's href.
    drawerList.querySelectorAll('.__ann-card-tag-here').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const num = parseInt(btn.dataset.num, 10);
        const ann = annotations.find(a => a.number === num);
        if (!ann) return;
        const label = ann.element?.label || ann.element?.selector || ('#' + num);
        const ok = window.confirm(
          `Tag "${label}" as pinned on this URL?\n\nAny reviewer clicking Go to page on this comment will be brought here.`
        );
        if (!ok) return;
        btn.disabled = true;
        btn.textContent = 'Tagging…';
        const success = await healAnnotationHrefIfNeeded(ann, { force: true });
        if (success) {
          showToast('✅ Tagged with current URL');
          renderDrawer();
        } else {
          showToast("❌ Couldn't tag — check console");
          btn.disabled = false;
          btn.textContent = 'Pinned here? Tag as this URL';
        }
      });
    });

    // Wire the "Go to page" CTAs — click navigates to the annotation's
    // page URL, preserving ?annotate=1 so the destination opens in
    // annotate mode. Also stashes the annotation number in sessionStorage
    // so the destination page auto-opens this comment's popover on
    // landing (see fetchAnnotations' reopen handoff).
    drawerList.querySelectorAll('.__ann-card-btn.goto').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const key = btn.dataset.pageKey || '';
        if (!key || key === '(unknown)') return;
        const card = btn.closest('.__ann-card');
        const num = card ? parseInt(card.dataset.num, 10) : null;
        if (num) { try { sessionStorage.setItem('__ann_reopen', String(num)); } catch {} }
        try {
          const dest = new URL(key, location.origin);
          dest.searchParams.set('annotate', '1');
          const destStr = dest.toString();
          // eslint-disable-next-line no-console
          console.log('[annotation] Go to page →', destStr);
          if (destStr === location.href) {
            // Same URL — force a reload so the SPA re-renders and the
            // handoff auto-opens the popover.
            location.reload();
          } else {
            location.href = destStr;
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[annotation] Go to page navigation failed:', err);
          // Last-resort raw navigation
          location.href = key + (key.includes('?') ? '&' : '?') + 'annotate=1';
        }
      });
    });

    // Card click → scroll to the pin's element (if attached to DOM) and open
    // the popover. Off-page navigation is handled by the "Other pages" link
    // list further down, not by cards — every rendered card is on the
    // current page by construction.
    drawerList.querySelectorAll('.__ann-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.__ann-card-btn')) return;
        const num = parseInt(card.dataset.num, 10);
        const ann = annotations.find(a => a.number === num);
        if (!ann) return;
        const scrollTarget = ann._pinHost || ann._el;
        if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (ann._el) {
          ann._el.style.transform = 'scale(1.4)';
          setTimeout(() => { ann._el.style.transform = ''; }, 400);
        }
        const pinRect = ann._el?.getBoundingClientRect();
        openPopoverNumber = ann.number;
        renderPopover(ann, ann._idx, pinRect || { right: window.innerWidth - 340, top: 60, left: window.innerWidth - 650, bottom: 100 });
      });
    });

    // Resolve buttons (open → closed). For off-page resolves the pin
    // isn't visible on the canvas so it's easy to misclick — guard with a
    // confirm() dialog. Reopen from the Resolved section is one click, so
    // this is a soft safeguard, not a hard block.
    drawerList.querySelectorAll('.__ann-card-btn.resolve').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const num = parseInt(btn.dataset.num, 10);
        const isOffPage = btn.dataset.offPage === '1';
        if (isOffPage) {
          const ok = window.confirm(
            "Resolve this comment? The pin isn't visible on this view — you'll be able to Reopen it from the Resolved section if needed."
          );
          if (!ok) return;
        }
        await setAnnotationState(num, 'closed');
      });
    });

    // Reopen buttons (closed → open)
    drawerList.querySelectorAll('.__ann-card-btn.reopen').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const num = parseInt(btn.dataset.num, 10);
        await setAnnotationState(num, 'open');
      });
    });

    // Copy for Claude buttons
    drawerList.querySelectorAll('.__ann-card-btn.copy').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const num = parseInt(btn.dataset.num, 10);
        const ann = annotations.find(a => a.number === num);
        if (!ann) return;
        navigator.clipboard?.writeText(buildClaudeText(ann))
          .then(() => showToast('✅ Thread copied — paste into Claude'))
          .catch(() => showToast('Select + copy manually'));
      });
    });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  function syncAuthBtn() {
    btnAuth.textContent = username ? username : 'Sign in';
    btnAuth.classList.toggle('active', !!username);
  }

  function openAuthModal() {
    document.getElementById('__ann-dcode-wrap').classList.remove('visible');
    const go = document.getElementById('__ann-auth-go');
    go.textContent = 'Sign in with Soma'; go.disabled = false;
    document.getElementById('__ann-auth-msg').textContent =
      "Click below — a code appears, Soma opens. You're already logged in so it's one click.";
    authModal.classList.add('visible');
  }

  document.getElementById('__ann-auth-cancel').addEventListener('click', () => {
    clearTimeout(pollTimer);
    authModal.classList.remove('visible');
  });

  document.getElementById('__ann-auth-go').addEventListener('click', async () => {
    const go = document.getElementById('__ann-auth-go');
    go.textContent = 'Requesting…'; go.disabled = true;
    try {
      const r = await fetch('https://git.soma.salesforce.com/login/device/code', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: C.clientId, scope: 'repo' }),
      });
      const d = await r.json();
      if (!d.user_code) throw new Error('no user_code');
      document.getElementById('__ann-dcode').textContent = d.user_code;
      document.getElementById('__ann-dcode-wrap').classList.add('visible');
      document.getElementById('__ann-auth-msg').textContent =
        'Copy this code and paste it at the Soma page that just opened.';
      window.open('https://git.soma.salesforce.com/login/device', '_blank');
      pollDevice(d.device_code, (d.interval || 5) * 1000, Date.now() + (d.expires_in || 900) * 1000);
    } catch {
      showToast('❌ Could not start sign-in');
      go.textContent = 'Sign in with Soma'; go.disabled = false;
    }
  });

  async function pollDevice(dc, interval, exp) {
    if (Date.now() > exp) {
      showToast('Sign-in expired'); authModal.classList.remove('visible'); return;
    }
    try {
      const r = await fetch('https://git.soma.salesforce.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: C.clientId, device_code: dc, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
      });
      const d = await r.json();
      if (d.access_token) {
        token = d.access_token;
        const u = await (await fetch(`${C.api}/user`, { headers: apiHeaders() })).json();
        username = u.login;
        localStorage.setItem('ann_token', token);
        localStorage.setItem('ann_username', username);
        authModal.classList.remove('visible');
        syncAuthBtn();
        showToast(`✅ Signed in as ${username}`);
        fetchAnnotations();
        return;
      }
      const wait = d.error === 'slow_down' ? interval + 5000 : interval;
      pollTimer = setTimeout(() => pollDevice(dc, wait, exp), wait);
    } catch {
      pollTimer = setTimeout(() => pollDevice(dc, interval, exp), interval);
    }
  }

  btnAuth.addEventListener('click', () => {
    if (username) {
      token = username = null;
      localStorage.removeItem('ann_token'); localStorage.removeItem('ann_username');
      syncAuthBtn(); showToast('Signed out');
    } else {
      openAuthModal();
    }
  });

  // ── Share ─────────────────────────────────────────────────────────────────
  btnShare.addEventListener('click', () => {
    const url = location.href.includes('?annotate') || location.href.includes('&annotate')
      ? location.href
      : location.href + (location.search ? '&annotate' : '?annotate');
    navigator.clipboard?.writeText(url)
      .then(() => showToast('✅ Link copied — share with your team'))
      .catch(() => { fallbackCopy(url); });
  });

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('✅ Link copied — share with your team'); } catch {}
    ta.remove();
  }

  // ── Fetch annotations ─────────────────────────────────────────────────────
  async function fetchAnnotations() {
    try {
      // Fetch ALL issues on the repo (state=all — surfaces open AND resolved
      // annotations so reviewers can see the full history and Reopen any that
      // got resolved by mistake).
      //
      // We intentionally do NOT filter by the `annotation` label at the API
      // level. Reason: the label is created via `ensureLabel()` on first save,
      // but if a user has issue-write permission without label-management
      // permission (common on Soma teams), Soma silently drops the label from
      // their POSTed issues. Their annotations save fine but the label filter
      // hides them from everyone. Instead, we identify annotations by the
      // JSON metadata block in the issue body (which every annotation posts
      // via createAnnotation) — that's the ground truth.
      const res = await fetch(
        `${C.api}/repos/${C.owner}/${C.repo}/issues?state=all&per_page=100`,
        { headers: apiHeaders() }
      );
      if (res.status === 401) { updateCount(); return; }
      if (!res.ok) throw new Error(res.status);
      const rawIssues = await res.json();
      if (!Array.isArray(rawIssues)) throw new Error('unexpected');

      // Client-side filter: only issues with our JSON metadata block are
      // annotations. This safely ignores any regular GitHub issues that
      // might exist in the same repo.
      const issues = rawIssues.filter(
        issue => issue && !issue.pull_request &&
                 typeof issue.body === 'string' &&
                 /```json\n[\s\S]*?"element"[\s\S]*?\n```/.test(issue.body)
      );

      annotations = await Promise.all(issues.map(async issue => {
        let meta = {};
        try {
          const m = issue.body && issue.body.match(/```json\n([\s\S]*?)\n```/);
          if (m) meta = JSON.parse(m[1]);
        } catch {}
        const firstComment = {
          id: `i${issue.number}`, author: issue.user.login,
          body: meta.comment || issue.title, date: issue.created_at,
        };
        let replies = [];
        try {
          const cr = await fetch(`${C.api}/repos/${C.owner}/${C.repo}/issues/${issue.number}/comments`, { headers: apiHeaders() });
          if (cr.ok) replies = (await cr.json()).map(c => ({ id: c.id, author: c.user.login, body: c.body, date: c.created_at }));
        } catch {}
        return {
          number:  issue.number,
          state:   issue.state === 'closed' ? 'closed' : 'open',
          element: meta.element || null,
          comments: [firstComment, ...replies],
        };
      }));

      annotations.sort((a, b) => a.number - b.number);
      updateCount();
      // LWC may not have rendered yet — retry attaching pins at increasing delays
      // until all loaded annotations find their host element.
      renderPinsWithRetry();
      if (drawerOpen) renderDrawer();

      // Cross-page handoff: if the user clicked an off-page card in the drawer
      // on another page, we navigated here with a stored annotation number.
      // Open that pin's popover now (deferred so pin hosts get a chance to
      // resolve via renderPinsWithRetry's later ticks).
      let reopen = null;
      try { reopen = sessionStorage.getItem('__ann_reopen'); } catch {}
      if (reopen) {
        try { sessionStorage.removeItem('__ann_reopen'); } catch {}
        const num = parseInt(reopen, 10);
        // Try a few times to let pins attach; open the drawer + popover.
        let tries = 0;
        const tick = () => {
          const ann = annotations.find(a => a.number === num);
          if (ann && matchesRoute(ann)) {
            openDrawer();
            const pinRect = ann._el?.getBoundingClientRect();
            if (ann._el) ann._el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            openPopoverNumber = ann.number;
            renderPopover(ann, ann._idx, pinRect || { right: window.innerWidth - 340, top: 60, left: window.innerWidth - 650, bottom: 100 });
            return;
          }
          if (tries++ < 8) setTimeout(tick, 200);
        };
        setTimeout(tick, 200);
      }
    } catch (e) {
      console.error('[annotation] fetchAnnotations:', e);
    }
  }

  // Attempt to attach loaded annotations to their DOM elements, retrying if LWC hasn't
  // rendered yet. Stops retrying once every annotation with a selector has a host, or
  // after ~10 seconds total.
  const RETRY_DELAYS = [100, 300, 600, 1000, 1500, 2000, 3000, 5000];
  function renderPinsWithRetry(attempt) {
    attempt = attempt || 0;
    renderPins();
    // Check if any annotation on the current route with a selector is still unhosted
    const needsRetry = annotations.some(a => !a._pending && matchesRoute(a) && a.element?.selector && !a._pinHost);
    if (needsRetry && attempt < RETRY_DELAYS.length) {
      setTimeout(() => renderPinsWithRetry(attempt + 1), RETRY_DELAYS[attempt]);
    }
  }

  function updateCount() {
    // Count only OPEN, non-pending annotations on the current route. Resolved
    // ones show in the drawer (grouped under a "Resolved" section) but don't
    // add to the topbar count — that badge should reflect actionable feedback.
    const n = annotations.filter(
      a => !a._pending && matchesRoute(a) && a.state !== 'closed'
    ).length;
    countBadge.textContent = n;
    countBadge.classList.toggle('empty', n === 0);
  }

  // ── Element selector builder ──────────────────────────────────────────────
  // Count matches for a selector across the full shadow-piercing tree.
  function shadowCount(selector) {
    try {
      let count = 0;
      function countIn(root) {
        try { count += root.querySelectorAll(selector).length; } catch {}
        const all = (root === document ? document.body : root).querySelectorAll('*');
        for (const node of all) {
          if (node.shadowRoot) countIn(node.shadowRoot);
        }
      }
      countIn(document);
      return count;
    } catch { return 0; }
  }

  function getSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    // Exclude annotation UI elements and any injected pin nodes
    try { if (el.closest('#__ann-bar,#__ann-drawer,#__ann-overlay,#__ann-popover,#__ann-composer,#__ann-auth-modal,#__ann-toast')) return null; } catch {}
    if (el.classList && el.classList.contains('__ann-pin')) return null;
    if (el.id) return '#' + CSS.escape(el.id);

    function seg(node, withNth) {
      const tag = node.tagName.toLowerCase();
      const cls = [...node.classList]
        .filter(c => !c.startsWith('__ann') && c.length > 1)
        .slice(0, 3).map(c => '.' + CSS.escape(c)).join('');
      if (withNth) {
        const nth = [...(node.parentElement?.children || [])].indexOf(node) + 1;
        return `${tag}${cls}:nth-child(${nth})`;
      }
      return tag + cls;
    }

    const parts = [];
    let node = el;
    for (let depth = 0; depth < 8 && node && node !== document.body; depth++) {
      const withClass = seg(node, false);
      parts.unshift(withClass);
      const selector = parts.join(' > ');
      // Use shadow-piercing count so LWC elements get unique selectors too
      if (shadowCount(selector) === 1) return selector;

      parts[0] = seg(node, true);
      const selectorNth = parts.join(' > ');
      if (shadowCount(selectorNth) === 1) return selectorNth;

      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function getLabel(el) {
    return (el.getAttribute('aria-label') || el.getAttribute('placeholder') ||
            el.getAttribute('title') || (el.textContent || '').replace(/\s+/g, ' ').trim()
    ).slice(0, 80);
  }

  // ── Overlay + pins ────────────────────────────────────────────────────────
  function ensureOverlay() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '__ann-overlay';
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  // Return the nearest ancestor in the light DOM tree (walks out of shadow roots).
  // We inject pins there so the browser handles scroll/layout natively.
  // If the element is already in light DOM, returns it directly.
  function lightDomAnchor(el) {
    let node = el;
    while (node) {
      // If node is in the normal document tree and not inside annotation UI, use it
      if (document.body.contains(node)) {
        const id = node.id || '';
        if (id.startsWith('__ann-')) return null; // annotation UI itself
        return node;
      }
      // node is inside a shadow root — climb to the shadow host
      const root = node.getRootNode();
      if (root instanceof ShadowRoot) {
        node = root.host;
      } else {
        break;
      }
    }
    return null;
  }

  // Inject a pin DOM node as a direct child of the target element.
  // The pin uses position:absolute so it rides with the element through all scrolling.
  // We save & restore 'position' and 'overflow' so pins are visible and correctly placed.
  // _annPinCount tracks how many pins are currently attached so we only restore styles
  // when the last pin leaves (multiple annotations can share one host element).
  function attachPinToElement(pinEl, host) {
    if (!host._annPinCount) {
      host._annPinCount = 0;
      const cs = window.getComputedStyle(host);
      // Make host a positioned container for absolute children
      const pos = cs.position;
      host._annOrigPos = pos || 'static';
      if (pos === 'static' || !pos) {
        host.style.position = 'relative';
        host._annSetPos = true;
      }
      // Ensure overflow:visible so pins aren't clipped
      const ov = cs.overflow;
      host._annOrigOverflow = ov || '';
      if (ov === 'hidden' || ov === 'clip') {
        host.style.overflow = 'visible';
        host._annSetOverflow = true;
      }
    }
    host._annPinCount++;
    host.appendChild(pinEl);
  }

  function detachPinFromElement(pinEl, host) {
    pinEl.remove();
    if (!host) return;
    host._annPinCount = Math.max(0, (host._annPinCount || 1) - 1);
    if (host._annPinCount === 0) {
      if (host._annSetPos)      { host.style.position = host._annOrigPos || ''; host._annSetPos = false; }
      if (host._annSetOverflow) { host.style.overflow = host._annOrigOverflow || ''; host._annSetOverflow = false; }
      host._annOrigPos = null;
      host._annOrigOverflow = null;
    }
  }

  function renderPins() {
    // Remove all previously placed pins from wherever they live
    annotations.forEach(ann => {
      if (ann._el) {
        // Only restore host styles if the host is still in the document —
        // if LWC re-rendered the page the old host is detached; don't touch it.
        const hostConnected = ann._pinHost && document.body.contains(ann._pinHost);
        detachPinFromElement(ann._el, hostConnected ? ann._pinHost : null);
        ann._el = null;
        ann._pinHost = null;
      }
    });

    ensureOverlay();

    // Only render pins for OPEN annotations created on the current route.
    // Off-route pins were already detached above; they reappear when the user
    // navigates back. Resolved (closed) annotations stay visible in the drawer
    // but do NOT get a pin on the page — keeps the canvas focused on actionable
    // feedback.
    const visible = annotations.filter(
      a => matchesRoute(a) && a.state !== 'closed'
    );

    visible.forEach((ann, i) => {
      const idx = i + 1;
      const el = document.createElement('div');
      el.className = `__ann-pin${ann._pending ? ' __ann-pin-pending' : ''}`;
      el.innerHTML = `<span>${ann._pending ? '…' : idx}</span>`;

      // Inline all critical styles — CSS can't cross shadow root boundaries
      el.style.cssText = [
        'position:absolute',
        'width:26px', 'height:26px',
        'border-radius:50%',
        'top:4px', 'right:4px',
        'display:flex', 'align-items:center', 'justify-content:center',
        'pointer-events:auto', 'cursor:pointer',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'font-size:11px', 'font-weight:700', 'color:#fff',
        'user-select:none',
        'box-shadow:0 2px 8px rgba(0,0,0,.35)',
        `background:${ann._pending ? 'rgba(30,30,30,.45)' : '#1e1e1e'}`,
        `z-index:${ann._pending ? '2147483639' : '2147483640'}`,
        ann._pending ? 'pointer-events:none' : '',
      ].filter(Boolean).join(';');

      if (!ann._pending) {
        el.addEventListener('click', e => {
          e.stopPropagation(); e.preventDefault();
          togglePopover(ann, idx, el);
        });
      }

      // Resolve the host element: priority = _liveTarget > selector query.
      // If neither resolves, DO NOT render a pin — the annotation was made
      // on a different app state (different tab/modal/route with same
      // pathname), so any coordinate-based fallback pin would appear in a
      // meaningless position. The annotation still shows in the drawer
      // (under "Elsewhere on this page") so reviewers can find it.
      let host = null;
      if (ann._liveTarget) {
        host = lightDomAnchor(ann._liveTarget);
      }
      if (!host && ann.element?.selector) {
        const found = shadowQuery(ann.element.selector);
        if (found) host = lightDomAnchor(found);
      }

      if (!host) {
        // Skip this pin entirely — no meaningful place to anchor it. Clean
        // up any half-created element and mark the annotation as unrendered.
        ann._el = null;
        ann._pinHost = null;
        return; // continue with next annotation in visible.forEach
      }

      attachPinToElement(el, host);
      ann._pinHost = host;
      ann._el  = el;
      ann._idx = idx;
      // Opportunistically PATCH the issue to add `href` for legacy
      // annotations that were saved without it. Fire-and-forget; runs once
      // per session per annotation. This is what makes clicking a
      // never-visited annotation from another state navigate correctly
      // going forward (Figma-style).
      healAnnotationHrefIfNeeded(ann);
    });
  }

  // querySelector that recurses through shadow roots (needed for LWC/Aura pages)
  function shadowQuery(selector, root) {
    if (!selector) return null;
    root = root || document;
    try {
      const el = root.querySelector(selector);
      if (el) return el;
    } catch {}
    const all = (root === document ? document.body : root).querySelectorAll('*');
    for (const node of all) {
      if (node.shadowRoot) {
        const found = shadowQuery(selector, node.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  function getElemRect(selector) {
    if (!selector) return null;
    try {
      const target = shadowQuery(selector);
      if (!target) return null;
      const r = target.getBoundingClientRect();
      if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return null;
      return r;
    } catch { return null; }
  }

  // Track current URL so we can hide the annotation layer when the SPA navigates away
  let _lastHref = location.href;
  let _lastRoute = currentRoute();

  (function rafLoop() {
    // Hide everything when the SPA navigates to a page without ?annotate
    const currentHref = location.href;
    const hasAnnotate = currentHref.includes('annotate');
    if (currentHref !== _lastHref) {
      const wasAnnotate = _lastHref.includes('annotate');
      _lastHref = currentHref;
      const hide = !hasAnnotate;
      bar.style.display    = hide ? 'none' : '';
      drawer.style.display = hide ? 'none' : '';
      if (overlay) overlay.style.display = hide ? 'none' : '';
      if (!hasAnnotate) {
        hidePopover();
      } else {
        // Route may have changed (or we just returned from a non-annotate page).
        // Re-render unconditionally on annotate pages so pins/drawer/count stay scoped
        // to the current route.
        const route = currentRoute();
        if (!wasAnnotate || route !== _lastRoute) {
          _lastRoute = route;
          hidePopover();
          updateCount();
          renderPinsWithRetry();
          if (drawerOpen) renderDrawer();
        }
      }
    }

    // Re-attach UI elements if the page framework replaced document.body children
    if (hasAnnotate) {
      if (overlay && !document.body.contains(overlay)) document.body.appendChild(overlay);
      if (!document.body.contains(bar)) document.body.appendChild(bar);
      if (!document.body.contains(drawer)) document.body.appendChild(drawer);
    }

    const drawerWidth = drawerOpen ? 320 : 0;

    // Only overlay-fallback pins (those with no host element) need RAF positioning.
    // Element-attached pins move naturally with their host — no RAF needed.
    annotations.forEach(ann => {
      const el = ann._el;
      if (!el || ann._pinHost) return; // element-attached: browser handles it

      // Overlay fallback: position via stored coordinates
      if (ann.element?.pageX != null) {
        el.style.display = 'flex';
        el.style.left = Math.min(ann.element.pageX - window.scrollX, window.innerWidth - drawerWidth - 4) + 'px';
        el.style.top  = (ann.element.pageY - window.scrollY) + 'px';
      } else if (ann.element?.xPct != null) {
        el.style.display = 'flex';
        el.style.left = (ann.element.xPct * (window.innerWidth - drawerWidth)) + 'px';
        el.style.top  = (ann.element.yPct * window.innerHeight) + 'px';
      } else {
        el.style.display = 'none';
      }
    });

    if (popoverEl?.classList.contains('visible') && popoverData) {
      // RULE: connector always anchors to the exact tagged element.
      // If the tagged element isn't in the DOM right now, we still position
      // the popover near the pin, but we DO NOT draw a connector line
      // (drawing one to a fallback anchor would mislead reviewers about
      // which element the comment refers to).
      const targetEl = popoverData._hlTarget;
      const targetRect = (targetEl && targetEl.getBoundingClientRect)
        ? targetEl.getBoundingClientRect()
        : null;
      const anchor = targetRect
        || popoverData._el?.getBoundingClientRect()
        || popoverData._pinRect;

      if (anchor) {
        const pw = 300, ph = popoverEl.offsetHeight || 280;
        const gap = 24;                            // clear space between popover and target
        const vw = window.innerWidth - drawerWidth;
        const vh = window.innerHeight - 44;

        // Space available on each side of the target
        const spaceRight  = vw - anchor.right;
        const spaceLeft   = anchor.left;
        const spaceBelow  = vh - anchor.bottom;
        const spaceAbove  = anchor.top - 52;

        let side = 'right', x, y;
        if (spaceRight >= pw + gap + 8) {
          side = 'right';
          x = anchor.right + gap;
          y = Math.max(52, Math.min(anchor.top, vh - ph - 8));
        } else if (spaceLeft >= pw + gap + 8) {
          side = 'left';
          x = anchor.left - pw - gap;
          y = Math.max(52, Math.min(anchor.top, vh - ph - 8));
        } else if (spaceBelow >= ph + gap + 8) {
          side = 'below';
          x = Math.max(8, Math.min(anchor.left, vw - pw - 8));
          y = anchor.bottom + gap;
        } else if (spaceAbove >= ph + gap + 8) {
          side = 'above';
          x = Math.max(8, Math.min(anchor.left, vw - pw - 8));
          y = anchor.top - ph - gap;
        } else {
          // No side has enough room — put it in the biggest gap and let the line still
          // point at the target.
          const best = Math.max(spaceRight, spaceLeft, spaceBelow, spaceAbove);
          if (best === spaceRight)       { side='right'; x = anchor.right + gap;  y = Math.max(52, Math.min(anchor.top, vh - ph - 8)); }
          else if (best === spaceLeft)   { side='left';  x = anchor.left - pw - gap; y = Math.max(52, Math.min(anchor.top, vh - ph - 8)); }
          else if (best === spaceBelow)  { side='below'; x = Math.max(8, Math.min(anchor.left, vw - pw - 8)); y = anchor.bottom + gap; }
          else                            { side='above'; x = Math.max(8, Math.min(anchor.left, vw - pw - 8)); y = Math.max(52, anchor.top - ph - gap); }
        }
        popoverEl.style.left = Math.max(8, x) + 'px';
        popoverEl.style.top  = y + 'px';

        // ── Spotlight overlay: bold outline+glow+wash positioned over the
        // exact tagged element. Grown by 6 px on each side so it wraps
        // around inline text/spans with breathing room. Hidden when the
        // target is not currently in the DOM (avoids misleading anchor).
        if (spotlightEl) {
          if (targetRect && targetRect.width && targetRect.height) {
            const pad = 6;
            spotlightEl.style.left   = (targetRect.left  - pad) + 'px';
            spotlightEl.style.top    = (targetRect.top   - pad) + 'px';
            spotlightEl.style.width  = (targetRect.width  + pad * 2) + 'px';
            spotlightEl.style.height = (targetRect.height + pad * 2) + 'px';
            spotlightEl.classList.add('visible');
          } else {
            spotlightEl.classList.remove('visible');
          }
        }

        // ── Connector line ONLY when the exact tagged element is in DOM ──
        // Anchoring the line to a fallback (pin/parent) would be misleading,
        // so we simply hide the connector in that case.
        if (connectorEl) {
          if (targetRect) {
            const popL = Math.max(8, x), popT = y, popR = popL + pw, popB = popT + ph;
            const tCX = targetRect.left + targetRect.width / 2;
            const tCY = targetRect.top  + targetRect.height / 2;
            let sx, sy, ex, ey;
            if (side === 'right')      { sx = popL;                     sy = popT + Math.min(24, ph/2); ex = targetRect.left;   ey = tCY; }
            else if (side === 'left')  { sx = popR;                     sy = popT + Math.min(24, ph/2); ex = targetRect.right;  ey = tCY; }
            else if (side === 'below') { sx = popL + Math.min(28, pw/2); sy = popT;                     ex = tCX;                ey = targetRect.bottom; }
            else                       { sx = popL + Math.min(28, pw/2); sy = popB;                     ex = tCX;                ey = targetRect.top; }

            const line = connectorEl.querySelector('.__ann-conn-line');
            const dots = connectorEl.querySelectorAll('.__ann-conn-dot');
            if (line) { line.setAttribute('x1', sx); line.setAttribute('y1', sy); line.setAttribute('x2', ex); line.setAttribute('y2', ey); }
            if (dots[0]) { dots[0].setAttribute('cx', sx); dots[0].setAttribute('cy', sy); }
            if (dots[1]) { dots[1].setAttribute('cx', ex); dots[1].setAttribute('cy', ey); }
            connectorEl.style.display = 'block';
          } else {
            connectorEl.style.display = 'none';
          }
        }
      }
    } else {
      if (connectorEl) connectorEl.style.display = 'none';
      if (spotlightEl) spotlightEl.classList.remove('visible');
    }

    requestAnimationFrame(rafLoop);
  })();

  // ── Popover ───────────────────────────────────────────────────────────────
  function ensurePopover() {
    if (!popoverEl) {
      popoverEl = document.createElement('div');
      popoverEl.id = '__ann-popover';
      document.body.appendChild(popoverEl);
    }
    if (!connectorEl) {
      const svgNS = 'http://www.w3.org/2000/svg';
      connectorEl = document.createElementNS(svgNS, 'svg');
      connectorEl.id = '__ann-connector';
      connectorEl.setAttribute('xmlns', svgNS);
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('class', '__ann-conn-line');
      const dot1 = document.createElementNS(svgNS, 'circle');
      dot1.setAttribute('class', '__ann-conn-dot');
      dot1.setAttribute('r', '3');
      const dot2 = document.createElementNS(svgNS, 'circle');
      dot2.setAttribute('class', '__ann-conn-dot');
      dot2.setAttribute('r', '4');
      connectorEl.append(line, dot1, dot2);
      connectorEl.style.display = 'none';
      document.body.appendChild(connectorEl);
    }
    if (!spotlightEl) {
      spotlightEl = document.createElement('div');
      spotlightEl.id = '__ann-spotlight';
      document.body.appendChild(spotlightEl);
    }
    return popoverEl;
  }

  function togglePopover(ann, idx, pinEl) {
    if (openPopoverNumber === ann.number) { hidePopover(); return; }
    const pinRect = pinEl?.getBoundingClientRect ? pinEl.getBoundingClientRect() : pinEl;
    openPopoverNumber = ann.number;
    renderPopover(ann, idx, pinRect);
  }

  function renderPopover(ann, idx, pinRect) {
    popoverData = { ...ann, _pinRect: pinRect, _el: ann._el };
    const pop = ensurePopover();

    // RULE: highlight + connector always anchor to the EXACT tagged element
    // (ann.element.selector). We do NOT fall back to the pin's host / a parent
    // element — that used to hide the "target not currently in DOM" case behind
    // a misleading highlight. If the selector doesn't resolve, we surface an
    // explicit "target not visible on this screen" hint instead.
    //
    // Highlight approach: floating "spotlight" overlay div positioned over
    // the target's bounding rect. Independent of the target's own CSS, so
    // inline spans, thin labels, and buttons all get the same bold visual.
    let hlTarget = null;
    if (ann.element?.selector) {
      try { hlTarget = shadowQuery(ann.element.selector); } catch {}
    }
    if (hlTarget && hlTarget.scrollIntoView) {
      const r = hlTarget.getBoundingClientRect && hlTarget.getBoundingClientRect();
      if (r && (r.top < 60 || r.bottom > window.innerHeight - 20)) {
        hlTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    // Re-trigger the pulse animation on every open by removing → reflow → adding
    // the .visible class. RAF loop handles positioning + show/hide.
    if (spotlightEl) {
      spotlightEl.classList.remove('visible');
      // eslint-disable-next-line no-void
      void spotlightEl.offsetWidth;
    }
    // Expose to RAF loop so popover placement can dodge the target and the
    // connector/spotlight can anchor to the actual annotated element. May be
    // null if the selector no longer resolves — RAF loop reads this and
    // skips both the connector and the spotlight when it's null.
    popoverData._hlTarget = hlTarget;
    popoverData._targetMissing = !hlTarget && !!(ann.element && ann.element.selector);

    const commentsHtml = ann.comments.map(c => `
      <div class="__ann-comment">
        <div class="__ann-c-avatar" style="background:${avatarColor(c.author)}">${esc((c.author||'?')[0]).toUpperCase()}</div>
        <div class="__ann-c-content">
          <div class="__ann-comment-meta">
            <span class="__ann-c-author">${esc(c.author)}</span>
            <span class="__ann-c-date">${fmtDate(c.date)}</span>
          </div>
          <div class="__ann-c-body">${esc(c.body)}</div>
        </div>
      </div>`).join('');

    const missingHint = popoverData._targetMissing
      ? `<span class="__ann-pop-missing" role="note">⚠ Tagged element isn't on this screen — no highlight or line drawn.</span>`
      : '';
    const elementRow = ann.element
      ? `<span class="__ann-pop-element">${esc(ann.element.selector)}${ann.element.label ? ` — "${esc(ann.element.label.slice(0,40))}"` : ''}</span>${missingHint}`
      : '';

    const replyArea = token
      ? `<div class="__ann-reply">
           <div class="__ann-reply-avatar" style="background:${avatarColor(username)}">${esc((username||'?')[0]).toUpperCase()}</div>
           <textarea class="__ann-reply-input" placeholder="Reply…"></textarea>
           <button class="__ann-reply-send" disabled>
             <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M2 6l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
           </button>
         </div>`
      : `<div class="__ann-signin-hint">Sign in to reply</div>`;

    // idx is the drawer-order number for pins on the current page; falls
    // back to the GitHub issue number for off-page annotations whose pin
    // never rendered (so _idx was never assigned).
    const titleIdx = (idx != null && idx !== '') ? idx : ('#' + ann.number);
    pop.innerHTML = `
      <div class="__ann-pop-header">
        <span class="__ann-pop-title">Comment ${titleIdx}</span>
        <button class="__ann-pop-close">×</button>
      </div>
      ${elementRow}
      <div class="__ann-comments">${commentsHtml}</div>
      ${replyArea}`;

    pop.querySelector('.__ann-pop-close').addEventListener('click', hidePopover);

    const input = pop.querySelector('.__ann-reply-input');
    const send  = pop.querySelector('.__ann-reply-send');
    if (input) {
      function autoGrow() {
        input.style.height = '32px'; input.style.overflowY = 'hidden';
        if (input.scrollHeight > 32) {
          input.style.height = Math.min(input.scrollHeight, 120) + 'px';
          input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden';
        }
      }
      input.addEventListener('input', () => { send.disabled = !input.value.trim(); autoGrow(); });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.value.trim()) submitReply(ann, input, send); }
      });
      send.addEventListener('click', () => submitReply(ann, input, send));
    }

    pop.classList.add('visible');
  }

  async function submitReply(ann, input, send) {
    const text = input.value.trim(); if (!text) return;
    send.disabled = true; input.disabled = true;
    try {
      const r = await fetch(`${C.api}/repos/${C.owner}/${C.repo}/issues/${ann.number}/comments`, {
        method: 'POST', headers: apiHeaders(), body: JSON.stringify({ body: text }),
      });
      if (!r.ok) throw new Error(await r.text());
      const c = await r.json();
      ann.comments.push({ id: c.id, author: c.user.login, body: c.body, date: c.created_at });
      renderPopover(ann, ann._idx, popoverData._pinRect);
      if (drawerOpen) renderDrawer();
    } catch { showToast('❌ Could not post reply'); input.disabled = false; send.disabled = false; }
  }

  function hidePopover() {
    openPopoverNumber = null; popoverData = null;
    if (popoverEl) { popoverEl.classList.remove('visible'); popoverEl.innerHTML = ''; }
    if (connectorEl) { connectorEl.style.display = 'none'; }
    if (spotlightEl) { spotlightEl.classList.remove('visible'); }
  }

  // ── Href healing ─────────────────────────────────────────────────────────
  // Legacy annotations (pre-href) only stored `route` (pathname). When their
  // target becomes visible in the current DOM — meaning the user is on the
  // exact app state where the pin was made — we opportunistically PATCH the
  // issue to add `href = <current URL>`. Once healed, clicking that
  // annotation from any other state navigates precisely, Figma-style.
  //
  // Fires from renderPins right after a successful attach. Fire-and-forget;
  // network errors are silent. Each annotation is healed at most once per
  // session via the `_healAttempted` flag to avoid API spam.
  async function healAnnotationHrefIfNeeded(ann, opts) {
    opts = opts || {};
    if (!token) return false;
    if (!ann || !ann.number) return false;
    // Sweep-driven calls pass { force: true } to bypass the once-per-session
    // guard so a single Locate action can try every candidate URL.
    if (!opts.force && ann._healAttempted) return false;
    if (ann.element?.href) return false;             // already has href
    if (!ann.element?.selector) return false;        // whole-page pin, no need
    if (!opts.force) ann._healAttempted = true;
    // Sweep can override the URL to store; otherwise use current location.
    let capturedHref = opts.hrefOverride || null;
    if (!capturedHref) {
      try {
        const u = new URL(location.href);
        u.searchParams.delete('annotate');
        capturedHref = u.pathname + (u.search || '') + (u.hash || '');
      } catch { return false; }
    }
    if (!capturedHref) return false;
    try {
      // 1) Fetch full issue body (list endpoint truncates or omits body in
      //    some GHE versions; issue endpoint is authoritative).
      const iRes = await fetch(
        `${C.api}/repos/${C.owner}/${C.repo}/issues/${ann.number}`,
        { headers: apiHeaders() }
      );
      if (!iRes.ok) return false;
      const issue = await iRes.json();
      const body  = issue.body || '';
      const m = body.match(/```json\n([\s\S]*?)\n```/);
      if (!m) return false;
      const meta = JSON.parse(m[1]);
      // 2) Skip if someone else already healed while we were fetching.
      if (meta.element && meta.element.href) {
        ann.element = { ...(ann.element || {}), href: meta.element.href };
        return false;
      }
      meta.element = { ...(meta.element || {}), href: capturedHref };
      const newBody = body.replace(m[0], '```json\n' + JSON.stringify(meta, null, 2) + '\n```');
      // 3) Patch the issue body with the healed href.
      const pRes = await fetch(
        `${C.api}/repos/${C.owner}/${C.repo}/issues/${ann.number}`,
        {
          method: 'PATCH',
          headers: apiHeaders(),
          body: JSON.stringify({ body: newBody })
        }
      );
      if (!pRes.ok) return false;
      // 4) Reflect locally.
      ann.element = { ...(ann.element || {}), href: capturedHref };
      // eslint-disable-next-line no-console
      console.log(`[annotation] healed href for issue #${ann.number} → ${capturedHref}`);
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[annotation] href heal failed for #${ann.number}:`, e);
      return false;
    }
  }

  // ── URL sweep for legacy annotations ─────────────────────────────────────
  // Small Cartesian product of the top-level params `app.js` persists to the
  // URL (see PERSISTABLE_TAB_IDS + readInitial* in cumulus-app/src/modules/c/app/app.js).
  // Nested wizard state (?view=/?step=) is skipped — it only applies inside
  // an already-open RFQ workspace tab and would blow up the matrix.
  const SWEEP_ROUTES   = ['account-record-page', 'run-my-day', 'meeting-center', 'rfq-workspace', 'eb-policy-record-page'];
  const SWEEP_TABS     = ['account-mavericks', 'account-acme', 'tab-setup'];
  const SWEEP_CONTEXTS = ['', 'mavericks-pa-2026', 'acme-eb-2026', 'nova-eb-2026'];
  const SWEEP_COMPARES = ['', 'open', 'nova'];
  const SWEEP_FLOWS    = ['', 'pa', 'eb'];
  const SWEEP_SLACKS   = ['', 'open'];

  // Build the URL list. We are aggressive about pruning — a full Cartesian
  // of every param would be 600 URLs and cause both rate-limit blowback
  // and a very long sweep. Instead we sweep only the state combinations
  // reviewers actually pin from in this prototype:
  //  1. Base grid: route × tab (15 URLs) — covers almost every landing.
  //  2. Renewal contexts only on the account-record-page + each tab (9 URLs).
  //  3. Quote comparison compare×flow only under rfq-workspace + each tab
  //     (12 URLs) — the only route where compare is meaningful.
  // Slack drawer is skipped — it doesn't gate any selectors we've seen.
  // ~36 URLs total. If a legacy annotation isn't found, the manual
  // "Tag as this URL" fallback handles it.
  function buildSweepUrls(basePathname) {
    const urls = new Map(); // key → URL string
    const push = (params) => {
      const u = new URL(basePathname, location.origin);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== '' && v != null) u.searchParams.set(k, v);
      });
      const key = u.pathname + u.search;
      if (!urls.has(key)) urls.set(key, u.toString());
    };
    // 1) Base route × tab grid
    for (const route of SWEEP_ROUTES) {
      for (const tab of SWEEP_TABS) {
        push({ route, tab });
      }
    }
    // 2) Renewal-alert contexts on account-record-page only
    for (const context of SWEEP_CONTEXTS) {
      if (!context) continue;
      for (const tab of SWEEP_TABS) {
        push({ route: 'account-record-page', tab, context });
      }
    }
    // 3) Quote comparison modal — only meaningful under rfq-workspace
    for (const compare of ['open', 'nova']) {
      for (const flow of ['pa', 'eb']) {
        for (const tab of SWEEP_TABS) {
          push({ route: 'rfq-workspace', tab, compare, flow });
        }
      }
    }
    return Array.from(urls.values());
  }

  // Sweep state — module-scoped so the UI can reflect progress + a Cancel
  // button can abort mid-flight.
  let _sweepActive     = false;
  let _sweepCancelled  = false;
  let _sweepDone       = 0;
  let _sweepTotal      = 0;
  let _sweepHealed     = 0;

  // Cheap helper: check every unhealed legacy annotation against current DOM.
  // Returns array of annotations that just matched (had their target appear).
  function detectNewlyResolvedLegacy() {
    return annotations.filter(a =>
      !a._pending && a.number
      && a.state !== 'closed'
      && !a.element?.href
      && a.element?.selector
      && (() => { try { return !!shadowQuery(a.element.selector); } catch { return false; } })()
    );
  }

  async function sweepLegacyAnnotations() {
    if (_sweepActive) return;
    if (!token) { showToast('Sign in to locate legacy comments'); return; }
    _sweepActive = true; _sweepCancelled = false;
    _sweepDone = 0; _sweepHealed = 0;

    // Snapshot original URL so we can restore it when done.
    const originalUrl = location.href;
    const originalPath = location.pathname;

    const urls = buildSweepUrls(originalPath);
    _sweepTotal = urls.length;
    if (drawerOpen) renderDrawer();

    try {
      for (const url of urls) {
        if (_sweepCancelled) break;
        _sweepDone += 1;
        // Advance the URL without a reload — the SPA reacts via its own
        // URL watcher (readInitial* + popstate handling in app.js).
        try {
          history.replaceState({}, '', url);
          // Nudge frameworks that only re-read on popstate.
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch {}
        // Give the SPA a beat to render.
        await new Promise(r => setTimeout(r, 350));
        // Every legacy annotation whose selector now resolves gets its
        // href stamped with THIS specific URL (the one we just swept to).
        // Small inter-PATCH delay keeps us well under GitHub Enterprise's
        // per-user rate limit even on repos with many legacy annotations.
        const matches = detectNewlyResolvedLegacy();
        for (const ann of matches) {
          if (_sweepCancelled) break;
          // Compute href value without ?annotate (matches new-annotation format).
          const stamp = (() => {
            try {
              const u = new URL(url);
              u.searchParams.delete('annotate');
              return u.pathname + (u.search || '') + (u.hash || '');
            } catch { return url; }
          })();
          const ok = await healAnnotationHrefIfNeeded(ann, { force: true, hrefOverride: stamp });
          if (ok) {
            _sweepHealed += 1;
            await new Promise(r => setTimeout(r, 120));
          }
        }
        if (drawerOpen) renderDrawerProgress();
      }
    } finally {
      // Restore original URL (best-effort — same reload-free hop).
      try {
        history.replaceState({}, '', originalUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch {}
      const summary = _sweepCancelled
        ? `Sweep cancelled after ${_sweepHealed} matches.`
        : `Located ${_sweepHealed} of ${_sweepDone} URLs swept.`;
      _sweepActive = false;
      _sweepCancelled = false;
      if (drawerOpen) renderDrawer();
      showToast(summary);
    }
  }

  // Light in-place update of the progress line so we don't re-render every
  // card during the sweep (that would cause layout thrash).
  function renderDrawerProgress() {
    const el = drawerList.querySelector('.__ann-sweep-progress');
    if (!el) return;
    el.textContent = `Locating comment ${_sweepDone} of ${_sweepTotal}… (${_sweepHealed} matched)`;
  }

  // ── Resolve / Reopen ─────────────────────────────────────────────────────
  // Single toggle for both directions. Resolved annotations stay in the
  // local `annotations` array (so the drawer's Resolved section can still
  // show them and offer Reopen); renderPins() filters them out of the page.
  async function setAnnotationState(number, newState) {
    const verb = newState === 'closed' ? 'resolve' : 'reopen';
    const done = newState === 'closed' ? 'Resolved' : 'Reopened';
    try {
      await fetch(`${C.api}/repos/${C.owner}/${C.repo}/issues/${number}`, {
        method: 'PATCH', headers: apiHeaders(),
        body: JSON.stringify({ state: newState }),
      });
      const idx = annotations.findIndex(a => a.number === number);
      if (idx >= 0) annotations[idx] = { ...annotations[idx], state: newState };
      if (newState === 'closed' && openPopoverNumber === number) hidePopover();
      updateCount();
      renderPins();
      if (drawerOpen) renderDrawer();
      showToast(`✅ ${done}`);
    } catch { showToast(`❌ Could not ${verb}`); }
  }
  // Back-compat alias — kept in case anything else in the codebase calls it.
  async function resolveAnnotation(number) {
    return setAnnotationState(number, 'closed');
  }

  // ── Annotation mode (hover + click) ──────────────────────────────────────
  function setAnnotating(on) {
    annotating = on;
    btnAdd.classList.toggle('active', on);
    btnAdd.innerHTML = on
      ? '× Cancel'
      : `<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="5" x2="8" y2="11" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1.5"/></svg> Add annotation <kbd>A</kbd>`;
    if (on) {
      document.addEventListener('mousemove', onMousemove, true);
    } else {
      document.removeEventListener('mousemove', onMousemove, true);
      clearHighlight();
      removeComposer();
    }
  }

  // Recursively pierce nested shadow roots (LWC stacks multiple shadow hosts)
  function deepElementFromPoint(x, y, root) {
    root = root || document;
    const el = root.elementFromPoint(x, y);
    if (!el) return null;
    if (el.shadowRoot) {
      const deeper = deepElementFromPoint(x, y, el.shadowRoot);
      if (deeper && deeper !== el) return deeper;
    }
    return el;
  }

  const ANN_IDS = '#__ann-bar,#__ann-drawer,#__ann-overlay,#__ann-popover,#__ann-composer,#__ann-auth-modal';

  function onMousemove(e) {
    if (e.target.closest && e.target.closest(ANN_IDS)) return;
    const el = deepElementFromPoint(e.clientX, e.clientY);
    if (!el || el === highlighted) return;
    try { if (el.closest && el.closest(ANN_IDS)) return; } catch {}
    // Skip pin nodes injected directly into elements
    if (el.classList && el.classList.contains('__ann-pin')) return;
    clearHighlight();
    if (el === document.body || el === document.documentElement) return;
    highlighted = el;
    // Use inline style — CSS class can't cross shadow root boundaries
    highlighted._annOutline = highlighted.style.outline;
    highlighted._annBg      = highlighted.style.backgroundColor;
    highlighted._annCursor  = highlighted.style.cursor;
    highlighted.style.outline         = '2px solid #18a0fb';
    highlighted.style.backgroundColor = 'rgba(24,160,251,.06)';
    highlighted.style.cursor          = 'crosshair';
  }

  function clearHighlight() {
    if (highlighted) {
      highlighted.style.outline         = highlighted._annOutline || '';
      highlighted.style.backgroundColor = highlighted._annBg      || '';
      highlighted.style.cursor          = highlighted._annCursor  || '';
      highlighted = null;
    }
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#__ann-bar,#__ann-drawer,#__ann-overlay,#__ann-popover,#__ann-composer,#__ann-auth-modal')) return;
    if (popoverEl?.classList.contains('visible')) { hidePopover(); return; }
    if (annotating) {
      e.preventDefault(); e.stopImmediatePropagation();
      const target = highlighted || deepElementFromPoint(e.clientX, e.clientY) || e.target;
      const selector = getSelector(target);
      const label    = getLabel(target);
      const rect     = target.getBoundingClientRect();
      const xPct = e.clientX / window.innerWidth;
      const yPct = e.clientY / window.innerHeight;
      const pageX = e.clientX + window.scrollX;
      const pageY = e.clientY + window.scrollY;
      openComposer(selector, label, rect, xPct, yPct, pageX, pageY, target);
    }
  }, true);

  // ── Composer ──────────────────────────────────────────────────────────────
  function openComposer(selector, label, rect, xPct, yPct, pageX, pageY, liveTarget) {
    removeComposer();
    clearHighlight();

    const comp = document.createElement('div');
    comp.id = '__ann-composer';

    const elemLine = selector
      ? `<div class="__ann-comp-elem">${esc(selector)}${label ? ` — "${esc(label.slice(0,30))}"` : ''}</div>`
      : '';
    comp.innerHTML = `${elemLine}<textarea placeholder="Add a comment…"></textarea><div class="__ann-comp-btns"><button class="__ann-comp-btn" id="__ann-comp-cancel">Cancel</button><button class="__ann-comp-btn primary" id="__ann-comp-post">Post</button></div>`;

    const pw = 260, ph = elemLine ? 160 : 135;
    const drawerWidth = drawerOpen ? 320 : 0;
    const vw = window.innerWidth - drawerWidth, vh = window.innerHeight - 44;
    let x = rect.right + 8, y = rect.top;
    if (x + pw > vw) x = rect.left - pw - 8;
    if (y + ph > vh) y = vh - ph - 8;
    comp.style.left = Math.max(8, x) + 'px';
    comp.style.top  = Math.max(52, y) + 'px';

    document.body.appendChild(comp);
    const ta = comp.querySelector('textarea');
    setTimeout(() => ta.focus(), 30);

    comp.querySelector('#__ann-comp-cancel').addEventListener('click', () => { removeComposer(); setAnnotating(false); });
    comp.querySelector('#__ann-comp-post').addEventListener('click', () => postAnnotation(selector, label, ta, xPct, yPct, pageX, pageY, liveTarget));
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postAnnotation(selector, label, ta, xPct, yPct, pageX, pageY, liveTarget); }
      if (e.key === 'Escape') { removeComposer(); setAnnotating(false); }
    });
  }

  function removeComposer() { document.getElementById('__ann-composer')?.remove(); }

  async function ensureLabel() {
    if (_labelEnsured) return;
    try {
      await fetch(`${C.api}/repos/${C.owner}/${C.repo}/labels`, {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({ name: C.label, color: '066AFE' }),
      });
      // 201 = created, 422 = already exists — both are fine
    } catch {}
    _labelEnsured = true;
  }

  async function postAnnotation(selector, label, textarea, xPct, yPct, pageX, pageY, liveTarget) {
    const comment = textarea.value.trim(); if (!comment) return;

    // Capture the exact URL state (pathname + query + hash) at pin time,
    // stripped of ?annotate. `route` remains just the pathname for backwards
    // compatibility with existing annotations; `href` is the new precise
    // pointer that lets click-to-navigate restore the same tab/modal/state.
    const capturedHref = (() => {
      try {
        const u = new URL(location.href);
        u.searchParams.delete('annotate');
        return u.pathname + (u.search || '') + (u.hash || '');
      } catch { return null; }
    })();
    const element = {
      selector: selector || null,
      label: label || null,
      xPct, yPct,
      pageX: pageX ?? null, pageY: pageY ?? null,
      route: currentRoute(),
      href: capturedHref
    };
    const ann = {
      number: null, state: 'open', _pending: true,
      element,
      _liveTarget: liveTarget || null, // live DOM ref — tracks element position without any coordinate math
      comments: [{ id: 'opt', author: username || '?', body: comment, date: new Date().toISOString() }],
    };
    annotations.push(ann);
    removeComposer(); setAnnotating(false);
    updateCount(); renderPins();
    if (drawerOpen) renderDrawer();

    const meta = { comment };
    if (ann.element) meta.element = ann.element;
    const issueBody = `${comment}\n\n\`\`\`json\n${JSON.stringify(meta, null, 2)}\n\`\`\``;
    try {
      await ensureLabel();
      const r = await fetch(`${C.api}/repos/${C.owner}/${C.repo}/issues`, {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({ title: comment.slice(0, 80), body: issueBody, labels: [C.label] }),
      });
      if (!r.ok) throw new Error(await r.text());
      const issue = await r.json();
      ann.number = issue.number; ann._pending = false;
      updateCount(); renderPins();
      if (drawerOpen) renderDrawer();
    } catch (e) {
      console.error('[annotation] post failed:', e);
      showToast('❌ Could not save annotation');
      annotations.splice(annotations.indexOf(ann), 1);
      updateCount(); renderPins();
      if (drawerOpen) renderDrawer();
    }
  }

  // ── Hotkey A ──────────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key !== 'a' && e.key !== 'A') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!token) { openAuthModal(); return; }
    setAnnotating(!annotating);
  });

  btnAdd.addEventListener('click', () => {
    if (!token) { openAuthModal(); return; }
    setAnnotating(!annotating);
  });

  // ── DOM mutation watcher — reattach pins when LWC re-renders ─────────────
  // When Salesforce navigation replaces page content, element-attached pins are
  // removed with the old DOM. We debounce heavily (300ms) to avoid firing during
  // a live dashboard's continuous data updates — we only care about navigation-level
  // DOM replacements, not individual row/metric updates.
  // The check is deferred into the callback, not inline, to avoid blocking mutations.
  let _mutationDebounce = null;
  const _mutationObserver = new MutationObserver(() => {
    if (!location.href.includes('annotate')) return;
    clearTimeout(_mutationDebounce);
    _mutationDebounce = setTimeout(() => {
      const hasOrphans = annotations.some(
        a => !a._pending && a.element?.selector && a._pinHost && !document.body.contains(a._pinHost)
      );
      if (hasOrphans) renderPinsWithRetry();
    }, 300);
  });
  _mutationObserver.observe(document.body, { childList: true, subtree: true });

  // ── DOM change watcher ────────────────────────────────────────────────────
  // As the SPA renders new content (opens a modal, switches tabs, mounts a
  // new record page), previously unresolvable annotation targets may
  // suddenly appear in the DOM. Re-run renderPins so those annotations get
  // pinned + their href gets healed. Debounced to avoid thrashing during
  // rapid DOM updates.
  let _domCheckTimer = null;
  const _domObserver = new MutationObserver(() => {
    clearTimeout(_domCheckTimer);
    _domCheckTimer = setTimeout(() => {
      // Cheap gate: only re-render if any annotation on this route is
      // still unhosted AND has a selector to try (skip whole-page pins
      // and already-attached ones).
      const anyUnhosted = annotations.some(
        a => !a._pending && matchesRoute(a) && a.state !== 'closed'
              && a.element?.selector && !a._pinHost
      );
      if (anyUnhosted) renderPins();
    }, 400);
  });
  try {
    _domObserver.observe(document.body, { childList: true, subtree: true });
  } catch {}

  // ── Init ──────────────────────────────────────────────────────────────────
  syncAuthBtn();
  fetchAnnotations();

})();
