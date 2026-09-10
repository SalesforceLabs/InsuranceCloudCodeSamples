import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Icon, type IconName } from '@/components/ui';
import { openSetupAssistant } from '@/components/shell/setup-assistant-store';
import {
  buildAssistantContext,
  type AssistantSubject,
} from '@/components/shell/setup-assistant-scripts';
import './ThreePanelHub.css';

export interface HubSubcategoryInfo {
  /**
   * Subject key for the Setup Assistant. Drives both the per-section
   * `Ask` button and the empty-state "Show step-by-step" CTA — the
   * assistant looks up its title + intro script by subject.
   */
  subject: AssistantSubject;
  /**
   * Optional scope label (e.g. an LOB name) prefixed to the assistant
   * panel's title for context. Doesn't affect the script itself.
   */
  scope?: string;
  /**
   * When true, the editor body is replaced with the empty-state
   * illustration + "Show step-by-step process" button. The caller computes
   * this flag against the live config (e.g. "no rules created yet").
   */
  isEmpty?: boolean;
  /**
   * Optional override for the empty-state button label.
   */
  emptyButtonLabel?: string;
  /**
   * When true, an "Upload CSV" button is rendered to the left of the Ask
   * button in the detail header — used by sections that support bulk import
   * (Attribute Categories, Line Definitions).
   */
  uploadCsv?: boolean;
}

export interface HubSubcategory {
  key: string;
  label: string;
  /** Optional icon glyph rendered in the leading slot of the card. */
  icon?: IconName;
  /** One-line summary shown under the label in the section card. */
  description?: string;
  /** Optional editor body for when this subcategory is selected. */
  render?: () => ReactNode;
  /**
   * Optional group label. Consecutive subcategories sharing the same group
   * are visually grouped under a non-clickable heading in the master nav.
   */
  group?: string;
  /**
   * Long-form description + emptiness signal for the subcategory's editor
   * pane. When present, the hub renders an info header with a per-section
   * Ask button (opens the Setup Assistant) above the body.
   */
  info?: HubSubcategoryInfo;
}

/**
 * Optional "+" tile rendered after the regular landing cards. Use this to
 * surface an inline create action (e.g. "Add LOB") without polluting the
 * categories list itself.
 */
export interface HubAddCard {
  key: string;
  label: string;
  description?: string;
  onClick: () => void;
}

export interface HubCategory {
  key: string;
  label: string;
  /** Optional icon glyph rendered in the leading slot of the card. */
  icon?: IconName;
  /** One-line summary shown under the label in the category card. */
  description?: string;
  subcategories: HubSubcategory[];
  /**
   * Optional content rendered in the top-right corner of the landing card
   * (e.g. an inline kebab menu). Suppresses click-through so menu actions
   * don't also activate the card.
   */
  cardActions?: ReactNode;
}

/**
 * Jump the enclosing ThreePanelHub to another category/subcategory. Fired by a
 * rendered section (e.g. a guided-setup step) that wants to deep-link to the
 * section it walks the user through. No-op when no hub is mounted.
 */
export function navigateHub(categoryKey: string, subcategoryKey?: string) {
  window.dispatchEvent(
    new CustomEvent('tph:navigate', { detail: { categoryKey, subcategoryKey } }),
  );
}

export interface ThreePanelHubProps {
  /** Title above the leftmost column (e.g. "General Setup", "Personas"). */
  categoriesTitle: string;
  /** Title above the middle column. Defaults to "Sections". */
  subcategoriesTitle?: string;
  categories: HubCategory[];
  /** Optional create-card appended after the landing grid. */
  addCard?: HubAddCard;
  /**
   * Optional text-button action rendered above the categories column while
   * in working (master/detail) mode. Used e.g. for "New Line of Business".
   */
  categoriesAction?: { label: string; icon?: IconName; onClick: () => void };
  /**
   * Optional initial focus state. When provided, the hub mounts directly
   * in working mode on the named category (and subcategory, if given)
   * instead of starting on the landing grid. Useful for deep-linking from
   * a child route (e.g. returning from a detail page).
   */
  initialFocus?: { categoryKey: string; subcategoryKey?: string } | null;
}

/**
 * Three-column navigation hub mirroring the Enrichment Fields editor pattern:
 *   • Column 1 — categories (focus follows clicks; click-to-toggle does not
 *     apply here, the click commits the focus). Always shows focus tint.
 *   • Column 2 — subcategories of the focused category. Click toggles the
 *     editor on the right. Selected subcategory gets the accent stroke.
 *   • Column 3 — render() output of the selected subcategory, or a
 *     placeholder when no subcategory is selected.
 */
/**
 * One-way duration for the landing↔working push transition. Must match the
 * CSS keyframes (tph-push-out / tph-push-in) — keep in sync.
 */
const PUSH_MS = 280;

type Phase = 'idle' | 'leaving-landing' | 'leaving-working';

export function ThreePanelHub({
  categoriesTitle,
  subcategoriesTitle = 'Sections',
  categories,
  addCard,
  categoriesAction,
  initialFocus,
}: ThreePanelHubProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // Read once-on-mount focus from either an `initialFocus` prop or the URL
  // query (cat=…&sub=…). Falling back to the URL means a back-nav from a
  // child detail page restores the hub's previous category/subcategory
  // without the parent panel having to opt in.
  const initialFromUrl = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const cat = p.get('cat');
    if (!cat) return null;
    const sub = p.get('sub');
    return { categoryKey: cat, subcategoryKey: sub ?? undefined };
    // We only want this on first render; URL changes during the session
    // happen via setFocusedCat below which writes back to the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const seed = initialFocus ?? initialFromUrl;
  const [focusedCat, setFocusedCat] = useState<string | null>(
    () => seed?.categoryKey ?? null,
  );
  const [selectedSub, setSelectedSub] = useState<string | null>(
    () => seed?.subcategoryKey ?? null,
  );


  // Mirror focus to the URL so a child detail page's back-nav restores it.
  // Use replace so we don't grow the history stack with each click inside
  // the hub — only landing → working and working → landing add real
  // history entries via the consumer's existing navigation.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const currCat = p.get('cat');
    const currSub = p.get('sub');
    const nextCat = focusedCat ?? null;
    const nextSub = selectedSub ?? null;
    if (currCat === nextCat && currSub === nextSub) return;
    if (nextCat) p.set('cat', nextCat);
    else p.delete('cat');
    if (nextSub) p.set('sub', nextSub);
    else p.delete('sub');
    const qs = p.toString();
    navigate(
      { pathname: location.pathname, search: qs ? `?${qs}` : '' },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedCat, selectedSub]);
  // Transition state — `phase` controls which animation class plays; the
  // pendingFocus carries the category key while the exit animation is in
  // flight so we can commit it once the leaving view has cleared.
  const [phase, setPhase] = useState<Phase>('idle');
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  // After a working→landing close, the next landing render should fall in
  // from above (reverse direction) instead of rising from below. Cleared on
  // the following render once it's served its purpose.
  const [reverseEnter, setReverseEnter] = useState(false);

  // Re-anchor when the categories list changes underneath us.
  useEffect(() => {
    if (focusedCat != null && !categories.find((c) => c.key === focusedCat)) {
      setFocusedCat(null);
      setSelectedSub(null);
    }
  }, [categories, focusedCat]);

  // Allow a rendered section to jump the hub to another category/subcategory
  // (e.g. a guided-setup step linking to the section it configures). The
  // section dispatches a `tph:navigate` CustomEvent rather than prop-drilling.
  useEffect(() => {
    const onNavigate = (ev: Event) => {
      const detail = (ev as CustomEvent<{ categoryKey: string; subcategoryKey?: string }>)
        .detail;
      if (!detail?.categoryKey) return;
      setPhase('idle');
      setPendingFocus(null);
      setFocusedCat(detail.categoryKey);
      setSelectedSub(detail.subcategoryKey ?? null);
    };
    window.addEventListener('tph:navigate', onNavigate as EventListener);
    return () => window.removeEventListener('tph:navigate', onNavigate as EventListener);
  }, []);

  const focusedCategory = useMemo(
    () => (focusedCat != null ? categories.find((c) => c.key === focusedCat) ?? null : null),
    [categories, focusedCat],
  );

  // Whenever the focused category changes (or its subcategory list shifts
  // underneath us), default the selected subcategory to the first one. The
  // master/detail body is never empty in working mode — picking a category
  // immediately commits to its first section. If the previously selected
  // subcategory still exists under the new category, leave it alone.
  useEffect(() => {
    if (!focusedCategory) return;
    const subs = focusedCategory.subcategories;
    if (subs.length === 0) {
      if (selectedSub != null) setSelectedSub(null);
      return;
    }
    if (!selectedSub || !subs.find((s) => s.key === selectedSub)) {
      setSelectedSub(subs[0].key);
    }
  }, [focusedCategory, selectedSub]);

  // Drive the transition timeline.
  useEffect(() => {
    if (phase === 'idle') return;
    const t = window.setTimeout(() => {
      if (phase === 'leaving-landing' && pendingFocus) {
        setFocusedCat(pendingFocus);
        setSelectedSub(null);
      }
      if (phase === 'leaving-working') {
        setFocusedCat(null);
        setSelectedSub(null);
        setReverseEnter(true);
      }
      setPendingFocus(null);
      setPhase('idle');
    }, PUSH_MS);
    return () => window.clearTimeout(t);
  }, [phase, pendingFocus]);

  const onClickCategory = (key: string) => {
    if (focusedCat == null) {
      // Landing → working: animate landing out, then mount working.
      setPendingFocus(key);
      setPhase('leaving-landing');
      return;
    }
    // Already in working mode: switch focus instantly (no transition).
    if (focusedCat !== key) {
      setSelectedSub(null);
      setFocusedCat(key);
    }
  };

  const onClickSubcategory = (key: string) => {
    // Clicking a subcategory always selects it — no toggle-off, since the
    // master/detail body should never be left empty in working mode.
    setSelectedSub(key);
  };

  const onCloseSections = () => {
    if (focusedCat == null) return;
    // Working → landing: animate working out, then unmount.
    setPhase('leaving-working');
  };

  const selectedSubObj = focusedCategory?.subcategories.find((s) => s.key === selectedSub) ?? null;
  // The currently mounted view is determined by focusedCat; the phase only
  // adjusts which animation class plays on top.
  const showLanding = focusedCat == null;

  if (showLanding) {
    let cls = 'tph-landing tph-landing--enter';
    if (phase === 'leaving-landing') cls = 'tph-landing tph-landing--leaving';
    else if (reverseEnter) cls = 'tph-landing tph-landing--enter-down';
    return (
      <div
        className={cls}
        aria-label={categoriesTitle}
        onAnimationEnd={() => {
          if (reverseEnter) setReverseEnter(false);
        }}
      >
        <div className="tph-landing__grid">
          {categories.map((c) => (
            <div
              key={c.key}
              className="tph-card-large"
              role="button"
              tabIndex={0}
              onClick={() => onClickCategory(c.key)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  onClickCategory(c.key);
                }
              }}
            >
              {c.cardActions && (
                <div
                  className="tph-card-large__actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.cardActions}
                </div>
              )}
              <span className="tph-card-large__preview" aria-hidden="true">
                {c.icon && (
                  <span className="tph-card-large__preview-icon">
                    <Icon name={c.icon} size={48} />
                  </span>
                )}
              </span>
              <span className="tph-card-large__title">{c.label}</span>
              {c.description && (
                <span className="tph-card-large__desc">{c.description}</span>
              )}
            </div>
          ))}
          {addCard && (
            <button
              key={addCard.key}
              type="button"
              className="tph-card-large tph-card-large--add"
              onClick={addCard.onClick}
            >
              <span className="tph-card-large__preview tph-card-large__preview--add" aria-hidden="true">
                <span className="tph-card-large__preview-icon tph-card-large__preview-icon--add">
                  <Icon name="plus" size={48} />
                </span>
              </span>
              <span className="tph-card-large__title">{addCard.label}</span>
              {addCard.description && (
                <span className="tph-card-large__desc">{addCard.description}</span>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  const workingCls =
    phase === 'leaving-working' ? 'tph tph--working tph--leaving' : 'tph tph--working tph--enter';
  return (
    <div className={workingCls}>
      {categoriesAction && (
        <div className="tph__toolbar">
          <Button
            variant="brand"
            iconLeading={<Icon name={categoriesAction.icon ?? 'plus'} size={14} />}
            onClick={categoriesAction.onClick}
          >
            {categoriesAction.label}
          </Button>
        </div>
      )}
      <div className="tph__row">
      <div className="tph__col tph__col--cat" aria-label={categoriesTitle}>
        {categories.map((c) => {
          const focused = focusedCat === c.key;
          return (
            <div
              key={c.key}
              className={`tph__card${focused ? ' tph__card--focus' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onClickCategory(c.key)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  onClickCategory(c.key);
                }
              }}
            >
              {c.icon && (
                <span className="tph__card-icon" aria-hidden="true">
                  <Icon name={c.icon} size={20} />
                </span>
              )}
              <span className="tph__card-body">
                <span className="tph__card-title">{c.label}</span>
                {c.description && <span className="tph__card-desc">{c.description}</span>}
              </span>
              {c.cardActions && (
                <span
                  className="tph__card-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.cardActions}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <section className="tph__md" aria-label={focusedCategory?.label ?? subcategoriesTitle}>
        <header className="tph__md-header">
          <h4 className="tph__md-title">{focusedCategory?.label ?? subcategoriesTitle}</h4>
          <button
            type="button"
            className="tph__col-close"
            onClick={onCloseSections}
            aria-label="Close"
            title="Close"
          >
            <Icon name="close" size={14} />
          </button>
        </header>
        {/* When the focused category has only one subcategory the inner
         * master nav is redundant — collapse the body to a single column
         * and render the section directly. */}
        {focusedCategory && focusedCategory.subcategories.length === 1 ? (
          <div className="tph__md-body tph__md-body--single">
            <div className="tph__md-detail">
              <SubcategoryDetail sub={focusedCategory.subcategories[0]} />
            </div>
          </div>
        ) : (
          <div className="tph__md-body">
            <nav className="tph__md-master" aria-label={subcategoriesTitle}>
              {focusedCategory && focusedCategory.subcategories.length === 0 ? (
                <div className="tph__empty">No sections yet.</div>
              ) : (
                focusedCategory?.subcategories.map((s, i, arr) => {
                  const selected = selectedSub === s.key;
                  const prev = i > 0 ? arr[i - 1] : null;
                  const showGroupHeading = !!s.group && s.group !== prev?.group;
                  return (
                    <div key={s.key} className="tph__md-master-cell">
                      {showGroupHeading && (
                        <div className="tph__md-master-group">{s.group}</div>
                      )}
                      <button
                        type="button"
                        className={`tph__md-master-item${selected ? ' tph__md-master-item--selected' : ''}`}
                        onClick={() => onClickSubcategory(s.key)}
                      >
                        <span className="tph__md-master-item-label">{s.label}</span>
                        {s.description && (
                          <span className="tph__md-master-item-desc">{s.description}</span>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </nav>
            <div className="tph__md-detail">
              {selectedSubObj ? (
                <SubcategoryDetail sub={selectedSubObj} />
              ) : (
                <div className="tph__editor-empty">
                  <span className="tph__editor-empty-icon">
                    <Icon name="settings" size={32} />
                  </span>
                  <div className="tph__editor-empty-title">
                    {focusedCategory
                      ? `Pick a section in ${focusedCategory.label}`
                      : 'Pick a section'}
                  </div>
                  <div className="tph__editor-empty-sub">
                    Select a section on the left to open its configuration here.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

/**
 * Inline "Ask" button — text label + agent_astro glyph. Opens the global
 * Setup Assistant slide-in with the section's contextual script.
 */
function AskButton({
  subject,
  scope,
}: {
  subject: AssistantSubject;
  scope?: string;
}) {
  return (
    <button
      type="button"
      className="tph__ask-btn"
      onClick={() =>
        openSetupAssistant(buildAssistantContext({ subject, scope, mode: 'ask' }))
      }
      aria-label="Ask the Setup Assistant"
      title="Ask the Setup Assistant"
    >
      <svg
        viewBox="0 0 1000 1000"
        aria-hidden="true"
        focusable="false"
        className="tph__ask-icon"
      >
        <path
          fill="currentColor"
          d="M569 521c-10 0-20 2-27 5l-29 6-13 1h-2a96 96 0 01-12-1c-18-3-29-7-29-7q-12-4.5-27-6c-56-6-81 16-82 20s5 57 9 65a35 35 0 0018 16c6 3 57 8 74 5s20-8 25-17c3-6 11-35 16-52 1-3 1-10 9-10 8 1 8 7 9 11a588 588 0 0015 52c5 9 7 15 24 17 18 3 69-1 75-4 6-2 13-7 18-15 4-8 11-61 10-65s-25-26-81-22zm175-166a282 282 0 00-54-54 46 46 0 0037-45 46 46 0 00-46-46 46 46 0 00-42 61 320 320 0 00-105-30 321 321 0 00-172 29 46 46 0 00-43-60 46 46 0 00-46 46c0 23 16 41 37 45-58 44-99 108-108 181a258 258 0 0054 192 307 307 0 00245 116c150 0 279-103 297-243a258 258 0 00-54-192M500 711c-113 0-204-76-204-170 0-28 8-56 24-80a81 81 0 006 22 21 21 0 0029 10 22 22 0 0010-29c-3-6-10-25 7-39a185 185 0 0064 40c48 15 84 6 85 6a22 22 0 0015-15c3-7 1-15-4-20-24-29-35-49-40-62 97 14 116 93 117 97a21 21 0 0025 16c12-2 19-14 17-26-3-14-11-34-25-54 48 31 79 80 79 134 0 94-92 170-205 170"
        />
      </svg>
      Ask
    </button>
  );
}

/**
 * Inline "Upload CSV" split button — sits to the left of the Ask button.
 * The primary segment opens the native file picker filtered to `.csv`; the
 * adjoining chevron opens an overflow menu whose sole action downloads a CSV
 * template. Import/download handling is not yet wired to a backend; the
 * control surfaces the actions so bulk-import sections have a consistent entry
 * point. Follows the SLDS button-group split-button pattern.
 */
function UploadCsvButton() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  return (
    <div
      className="tph__btn-group"
      onClick={(e) => e.stopPropagation()}
    >
      <label className="tph__upload-btn tph__btn-group-primary" title="Upload a CSV to bulk import">
        <Icon name="upload" size={14} />
        Upload CSV
        <input
          type="file"
          accept=".csv,text/csv"
          className="tph__upload-input"
          onChange={(e) => {
            e.currentTarget.value = '';
          }}
        />
      </label>
      <button
        type="button"
        className="tph__upload-btn tph__btn-group-trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="More actions"
        title="More actions"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <Icon name="chevron-down" size={14} />
      </button>
      {menuOpen && (
        <div className="tph__btn-group-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="tph__btn-group-menu-item"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="download" size={14} />
            Download CSV template
          </button>
        </div>
      )}
    </div>
  );
}

interface SubcategoryDetailProps {
  sub: HubSubcategory;
}

/**
 * Renders the editor body for a subcategory along with the optional info
 * header (description + Ask button) above it. When `info.isEmpty === true`,
 * the body is replaced with a single CTA that hands off to the Setup
 * Assistant for a step-by-step walkthrough — the description still shows so
 * the user has context before clicking.
 */
function SubcategoryDetail({ sub }: SubcategoryDetailProps) {
  const { info } = sub;
  return (
    <div className="tph__detail">
      {info && (
        <header className="tph__detail-header">
          {info.uploadCsv && <UploadCsvButton />}
          <AskButton subject={info.subject} scope={info.scope} />
        </header>
      )}
      {info?.isEmpty ? (
        <div className="tph__detail-empty">
          <EmptyIllustration />
          <Button
            variant="brand"
            iconLeading={<Icon name="sparkles" size={14} />}
            onClick={() =>
              openSetupAssistant(
                buildAssistantContext({
                  subject: info.subject,
                  scope: info.scope,
                  mode: 'steps',
                }),
              )
            }
          >
            {info.emptyButtonLabel ?? 'Show step-by-step process to create'}
          </Button>
        </div>
      ) : sub.render ? (
        sub.render()
      ) : (
        <div className="tph__editor-empty">
          <span className="tph__editor-empty-icon">
            <Icon name="settings" size={32} />
          </span>
          <div className="tph__editor-empty-title">{sub.label}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Empty-state illustration — a flat SLDS-style scene of a stack of cards
 * with a sparkle, signaling "nothing here yet, the assistant can help."
 * Pure SVG so it scales and themes via currentColor.
 */
function EmptyIllustration() {
  return (
    <svg
      className="tph__empty-illustration"
      viewBox="0 0 240 160"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Soft halo behind the stack */}
      <ellipse
        cx="120"
        cy="138"
        rx="84"
        ry="10"
        fill="var(--slds-g-color-brand-base-95)"
      />
      {/* Back card (offset right + up) */}
      <g transform="translate(86 26)">
        <rect
          x="0"
          y="0"
          width="120"
          height="78"
          rx="10"
          fill="var(--slds-g-color-surface-container-2)"
          stroke="var(--slds-g-color-border-1)"
        />
        <rect x="14" y="18" width="64" height="6" rx="3" fill="var(--slds-g-color-border-2)" />
        <rect x="14" y="34" width="92" height="4" rx="2" fill="var(--slds-g-color-border-1)" />
        <rect x="14" y="46" width="76" height="4" rx="2" fill="var(--slds-g-color-border-1)" />
        <rect x="14" y="58" width="58" height="4" rx="2" fill="var(--slds-g-color-border-1)" />
      </g>
      {/* Front card */}
      <g transform="translate(40 50)">
        <rect
          x="0"
          y="0"
          width="140"
          height="84"
          rx="10"
          fill="var(--slds-g-color-surface-1)"
          stroke="var(--slds-g-color-accent-1)"
        />
        <rect x="16" y="18" width="86" height="8" rx="4" fill="var(--slds-g-color-accent-1)" />
        <rect
          x="16"
          y="36"
          width="108"
          height="4"
          rx="2"
          fill="var(--slds-g-color-border-2)"
        />
        <rect
          x="16"
          y="48"
          width="92"
          height="4"
          rx="2"
          fill="var(--slds-g-color-border-2)"
        />
        <rect
          x="16"
          y="60"
          width="68"
          height="4"
          rx="2"
          fill="var(--slds-g-color-border-2)"
        />
      </g>
      {/* Sparkle in the corner */}
      <g
        transform="translate(174 32)"
        fill="var(--slds-g-color-accent-1)"
      >
        <path d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5 Z" />
      </g>
      <g
        transform="translate(28 96)"
        fill="var(--slds-g-color-accent-3)"
        opacity="0.7"
      >
        <path d="M6 0 L7.5 4.5 L12 6 L7.5 7.5 L6 12 L4.5 7.5 L0 6 L4.5 4.5 Z" />
      </g>
    </svg>
  );
}
