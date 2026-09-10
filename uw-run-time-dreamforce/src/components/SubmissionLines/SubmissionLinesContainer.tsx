import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { Button, Icon, Modal } from '@salesforce/design-system-react';
import { mockSubmissionLines, applyLineOverrides, getMergedSubmissionLine } from '@/data/mockSubmissionLines';
import { InsuranceSubmissionLine } from '@/types/InsuranceSubmission';
import { locationCoordinates } from '@/data/mockLocationCoordinates';
import { stepConfigurations } from '@/data/demoStepData';

const LocationsMap = dynamic(() => import('@/components/Map/LocationsMap'), { ssr: false });

// ── Module-level helpers copied verbatim from the LOB page ──────────────────
const ASSET_PREFIX = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || '';

// Static, extraction-independent file overviews. Generated as soon as a document
// arrives and never change based on downstream extraction/reconciliation.
const STATIC_DOCUMENT_SUMMARIES: Record<string, string> = {
  'doc-1': 'This file contains two ACORD forms — ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section) — covering the applicant and property information for the submission.',
  'doc-3': 'This file contains one ACORD form — ACORD 126 (Commercial General Liability Section) — covering the general liability portion of the submission.',
};
const DEFAULT_DOCUMENT_SUMMARY = 'This file contains the submitted document along with a high-level overview of its contents.';

// Cross-LOB discrepancies — demo only.
// Hardcoded set of submission-line ids (in this LOB) that have at least one
// canonical attribute whose value diverges from the same physical entity in another LOB.
type CrossLobRow = {
  attribute: string;
  currentValue: string;
  currentSource: string;
  newValue: string;
  newValueLob: string;
  newSource: string;
};
const crossLobDiscrepancies: Record<string, CrossLobRow[]> = {
  // L1-B2 - Loading Dock Annex
  'a01SB00001p8BGXYA2': [
    {
      attribute: 'Building Value',
      currentValue: '$4,200,000',
      currentSource: 'ACORD 140',
      newValue: '$4,500,000',
      newValueLob: 'General Liability',
      newSource: 'ACORD 126',
    },
    {
      attribute: 'Roof Type',
      currentValue: 'TPO Membrane',
      currentSource: 'ACORD 140',
      newValue: 'Modified Bitumen',
      newValueLob: 'General Liability',
      newSource: 'ACORD 126',
    },
  ],
  // L2-B1 - HQ Tower
  'a01SB00001p8BObYAM': [
    {
      attribute: 'Construction Type',
      currentValue: 'Fire Resistive',
      currentSource: 'ACORD 140',
      newValue: 'Modified Fire Resistive',
      newValueLob: 'General Liability',
      newSource: 'ACORD 126',
    },
    {
      attribute: 'Year Built',
      currentValue: '2005',
      currentSource: 'ACORD 140',
      newValue: '2007',
      newValueLob: 'General Liability',
      newSource: 'ACORD 126',
    },
  ],
  // L2-B2 - R&D Lab Building
  'a01SB00001p8BTRYA2': [
    {
      attribute: 'Square Footage',
      currentValue: '52,000',
      currentSource: 'ACORD 140',
      newValue: '54,800',
      newValueLob: 'General Liability',
      newSource: 'Broker Email',
    },
    {
      attribute: 'Occupancy Type',
      currentValue: 'Laboratory',
      currentSource: 'ACORD 140',
      newValue: 'Research Laboratory',
      newValueLob: 'General Liability',
      newSource: 'Broker Email',
    },
  ],
  // L1-B1 - Business Personal Property
  'a01SB00001p8BEvYAM': [
    {
      attribute: 'Contents Value',
      currentValue: '$2,800,000',
      currentSource: 'ACORD 140',
      newValue: '$3,150,000',
      newValueLob: 'General Liability',
      newSource: 'ACORD 126',
    },
    {
      attribute: 'Equipment Coverage',
      currentValue: 'Replacement Cost',
      currentSource: 'ACORD 140',
      newValue: 'Actual Cash Value',
      newValueLob: 'General Liability',
      newSource: 'ACORD 126',
    },
  ],
};

// AI extraction confidence — deterministic per (line, attribute, value, source)
// triad so a value keeps the same score across every render and both views.
// ~10% of triads land below the 90 threshold (80–89); the rest are 90–100.
const CONFIDENCE_THRESHOLD = 90;
function confidenceFor(lineId: string, attrKey: string, value: string, source: string): number {
  const key = `${lineId}|${attrKey}|${value}|${source}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bucket = ((h >>> 0) % 1000) / 1000; // [0,1)
  const spread = ((h >>> 9) % 1000) / 1000; // [0,1)
  // Force a few Chicago Warehouse extractions low so the worked example shows them.
  const chicagoLow = lineId === 'a01SB00001p8B6rYAE' && (attrKey === 'State' || attrKey === 'Fire Alarm');
  if (chicagoLow || bucket < 0.1) return 80 + Math.floor(spread * 10); // 80–89
  return 90 + Math.floor(spread * 11); // 90–100
}

// Enrichment-API vendors — sources that arrive from a data-enrichment call rather than a
// document or email. Used to gate the enrichment lifecycle line steps (see lineStep).
const ENRICHMENT_SOURCES = new Set(['Verisk 360', 'CoreLogic', 'ISO', 'RMS CatModel', 'FEMA NFIP', 'USGS', 'D&B', 'LexisNexis CLUE', 'NCCI']);
const isEnrichmentSourceName = (src: string): boolean => ENRICHMENT_SOURCES.has(src);
// The LOB submission-line page walks an enrichment lifecycle: 1 = enrichment not yet run,
// 2/3 = intake & clearance / data enrichment in progress (no external-service extractions visible
// yet), 4 = pricing & quoting — enrichment values appear and map alongside the existing sources.
const TOTAL_LINE_STEPS = 4;
const LINE_STEP_LABELS: Record<number, string> = {
  1: 'Enrichment Pending',
  2: 'Enrichment Retrieved',
  3: 'Enriched & Mapped',
  4: 'Pricing & Quoting',
};

// SLDS "dirty state" cell fill — a light-yellow wash applied to a table cell that carries an
// unsaved edit (matches Salesforce's standard data-table dirty-row treatment). Kept as a shared
// constant so every edited cell across the detail-panel tables reads identically.
const DIRTY_CELL_STYLE: React.CSSProperties = {
  backgroundColor: '#fdf6e3',
  boxShadow: 'inset 3px 0 0 #B85C00',
  borderRadius: '2px',
};

// Active-edit cell treatment (matches the Salesforce inline-edit affordance): the cell being
// hovered/edited gets a white fill with a thin border and the pencil anchored right, while the
// rest of that row goes light grey (see ROW_DIM_STYLE) so focus lands on the editable cell.
const EDIT_CELL_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: 'inset 0 0 0 1px #c9c9c9',
  borderRadius: '2px',
};
const ROW_DIM_STYLE: React.CSSProperties = { backgroundColor: '#f3f3f3' };

// Format an enrichment-response ISO timestamp (e.g. "2026-06-02T14:20:11Z") into a
// readable "June 2, 2026" for the doc-canvas "enriched via" message. Deterministic in the
// value string, so safe to call during render.
function formatEnrichmentDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Low-confidence warning badge shown beside a value when its AI confidence
// score falls below the threshold.
function ConfidenceBadge({ score }: { score: number }) {
  if (score >= CONFIDENCE_THRESHOLD) return null;
  return (
    <span
      title={`Low Extraction Confidence (${score}%)`}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      <Icon category="utility" name="document_preview" size="xx-small" style={{ fill: '#B85C00' }} />
    </span>
  );
}


export interface SubmissionLinesContainerProps {
  /** Submission whose lines are shown (replaces the LOB page's `line.insuranceSubmissionId`). */
  submissionId: string;
  /**
   * Line-of-business scope. A single LOB (e.g. `'Property'`) mirrors the LOB page's
   * single-LOB view; `null`/omitted shows every LOB for the submission (Submission record tab).
   */
  lobFilter?: string | string[] | null;
  /** Show the Reconcile / Resolve-Duplicates / Cross-LOB resolution cards above the tree. */
  showResolutionCards?: boolean;
  /** Enrichment lifecycle step (LOB page 1..3). Defaults to fully-enriched terminal state. */
  lineStep?: number;
  /** Full-screen standalone mode (navy builder chrome on the shared modal). */
  vsStandalone?: boolean;
  setVsStandalone?: (v: boolean) => void;
  /** Reports unsaved-edit state up to the parent (with a revert fn) so a page-level
   *  tab switch can guard against discarding this container's dirty cells. */
  onDirtyChange?: (dirty: boolean, cancel: () => void) => void;
}

// Descriptive helper text shown under a tab bar. Clamps to a single line and
// only reveals a "More" / "Less" toggle when the text actually overflows.
function ClampOneLine({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflows(el.scrollWidth > el.clientWidth + 1);
  }, [text]);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '6px',
      fontSize: '12px',
      color: '#5c5c5c',
      lineHeight: '17px',
      margin: '0 0 12px',
    }}>
      <span
        ref={ref}
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: expanded ? 'normal' : 'nowrap',
        }}
      >
        {text}
      </span>
      {(overflows || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            flexShrink: 0,
            border: 'none',
            background: 'none',
            padding: 0,
            color: '#0176D3',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  );
}

export default function SubmissionLinesContainer(props: SubmissionLinesContainerProps) {
  const { submissionId, lobFilter = null, lineStep = 3, showResolutionCards = true } = props;
  const router = useRouter();
  const { id } = router.query;
  const [mounted, setMounted] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedSubmissionLineId, setSelectedSubmissionLineId] = useState<string | null>(null);
  // Detail panel that stays mounted through its slide-out animation: `panelLineId` is the line
  // currently rendered in the panel (held during close so the exit transition can play), while
  // `panelOpen` drives the enter/exit CSS transform. `treeWidth` is the draggable width of the
  // left hierarchy pane when the panel is open.
  const [panelLineId, setPanelLineId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  // Once the slide-in transition finishes we drop the panel's transform to `none`. A non-`none`
  // transform makes descendant position:fixed popovers (e.g. the Unmapped "Map" term picker)
  // resolve against the panel instead of the viewport, mispositioning them.
  const [panelSettled, setPanelSettled] = useState(false);
  const panelSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [treeWidth, setTreeWidth] = useState(320);
  const panelCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  // Detail (right) pane element — the save/cancel footer is width-matched to it and pinned to the
  // viewport bottom (position:fixed) so it stays visible while scrolling, then rides up with the
  // pane's bottom edge once that edge scrolls into view.
  const detailPaneRef = useRef<HTMLDivElement | null>(null);
  const [footerMetrics, setFooterMetrics] = useState<{ left: number; width: number; bottom: number } | null>(null);
  const treeResizeRef = useRef(false);
  // Drag the separator between the hierarchy pane and the detail panel to resize the tree.
  const startTreeResize = (e: React.MouseEvent) => {
    e.preventDefault();
    treeResizeRef.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!treeResizeRef.current || !treeContainerRef.current) return;
      const rect = treeContainerRef.current.getBoundingClientRect();
      const next = ev.clientX - rect.left;
      const max = rect.width - 360;
      setTreeWidth(Math.max(240, Math.min(next, Math.max(240, max))));
    };
    const onUp = () => {
      treeResizeRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  // Reconcile / View Sources modal: draggable width of the left submission-line queue column.
  const [reconcileQueueWidth, setReconcileQueueWidth] = useState(260);
  const reconcileQueueRef = useRef<HTMLDivElement | null>(null);
  const reconcileQueueResizeRef = useRef(false);
  const startReconcileQueueResize = (e: React.MouseEvent) => {
    e.preventDefault();
    reconcileQueueResizeRef.current = true;
    const startX = e.clientX;
    const startW = reconcileQueueRef.current
      ? reconcileQueueRef.current.getBoundingClientRect().width
      : reconcileQueueWidth;
    const onMove = (ev: MouseEvent) => {
      if (!reconcileQueueResizeRef.current) return;
      const next = startW + (ev.clientX - startX);
      setReconcileQueueWidth(Math.max(200, Math.min(next, 560)));
    };
    const onUp = () => {
      reconcileQueueResizeRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  // Per-line per-attribute edits made by the user. Keyed by `${lineId}::${attrKey}`.
  const [submissionLineEdits, setSubmissionLineEdits] = useState<Record<string, { value: string; source: string }>>({});
  // Per-line per-attribute index of the currently-selected candidate source (for unedited attributes)
  const [submissionLineSourceIdx, setSubmissionLineSourceIdx] = useState<Record<string, number>>({});
  // Open source-picker modal anchor: { lineId, attrKey } | null
  const [sourcePickerAnchor, setSourcePickerAnchor] = useState<{ lineId: string; attrKey: string } | null>(null);
  const [sourcePickerActiveTab, setSourcePickerActiveTab] = useState<number>(0);
  // Per-candidate manual override entered inside the source picker.
  // Key: `${lineId}::${attrKey}::${candidateIdx}`. If non-empty, this value
  // is used (instead of cand.value) when that candidate is the active source.
  const [manualCorrections, setManualCorrections] = useState<Record<string, string>>({});
  // Tree-grid detail-panel field edits — demo-local, keyed `${lineId}::${fieldName}`.
  // Layered over the merged submission line so any node in the tree can be edited inline.
  const [panelFieldEdits, setPanelFieldEdits] = useState<Record<string, any>>({});
  // Field currently being inline-edited in the tree-grid detail panel, `${lineId}::${fieldName}` or null.
  const [panelEditingField, setPanelEditingField] = useState<string | null>(null);
  // ── Explicit-save (dirty-state) model for the main detail-panel tables ──────────────
  // Edits still commit live into their state maps so the rest of the UI stays in sync, but the
  // edited cell is registered here so it renders in the SLDS "dirty" yellow fill and a sticky
  // Save/Cancel footer appears. Save clears the registry (accepting the live values); Cancel runs
  // each cell's revert closure to restore the pre-edit value. `dirtyCells` is a render-driving set
  // of cell keys; `dirtyReverts` holds the matching restore closures (a ref so re-renders don't drop
  // them). The View Sources / Reconcile / Source-picker modals share this same dirty model: their
  // editable cells (Override Value, manual value) go yellow until Save / Save & Next / Mark as
  // Resolved commits, and close/Cancel reverts.
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const dirtyReverts = useRef<Record<string, () => void>>({});
  const isDirty = dirtyCells.size > 0;
  // Register a cell edit. Captures the revert closure only on the FIRST edit of a cell so Cancel
  // always restores the value as it was before this dirty session (repeated edits don't overwrite it).
  const markDirty = (cellKey: string, revert: () => void) => {
    if (!dirtyReverts.current[cellKey]) dirtyReverts.current[cellKey] = revert;
    setDirtyCells((prev) => {
      if (prev.has(cellKey)) return prev;
      const next = new Set(prev);
      next.add(cellKey);
      return next;
    });
  };
  const saveDirty = () => {
    dirtyReverts.current = {};
    setDirtyCells(new Set());
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };
  const cancelDirty = () => {
    Object.values(dirtyReverts.current).forEach((fn) => { try { fn(); } catch { /* revert best-effort */ } });
    dirtyReverts.current = {};
    setDirtyCells(new Set());
  };
  // Nav-away guard: when the user tries to switch line or detail-tab with unsaved edits, stash the
  // intended action here and show a confirm modal. Confirm → cancelDirty() + run the action.
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);
  const guardNav = (action: () => void) => {
    if (isDirty) setPendingNavAction(() => action);
    else action();
  };
  // Bubble dirty state up so a page-level tab switch can guard this container's unsaved edits.
  const onDirtyChange = props.onDirtyChange;
  useEffect(() => {
    onDirtyChange?.(isDirty, cancelDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the fixed footer aligned to the detail pane: match its horizontal extent, pin to the
  // viewport bottom, and clamp to the pane's bottom edge when it scrolls into view.
  useEffect(() => {
    if (!isDirty) { setFooterMetrics(null); return; }
    const measure = () => {
      const el = detailPaneRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const bottom = Math.max(0, vh - r.bottom);
      setFooterMetrics({ left: r.left, width: r.width, bottom });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [isDirty, treeWidth, panelLineId]);
  // Line-level source viewer (opened from the byline below the active line title).
  // `activeIdx` is the currently-selected source index (drives document tab + highlight).
  const [lineSourceViewer, setLineSourceViewer] = useState<{ lineId: string; sources: string[]; activeIdx: number; mode?: 'view' | 'reconcile'; term?: string } | null>(null);
  // Currently-expanded canonical-term card inside the View Sources modal
  const [viewSourcesExpandedAttr, setViewSourcesExpandedAttr] = useState<string | null>(null);
  // Active row inside the expanded card: { attrKey, candidateIdx } — drives document highlight
  const [viewSourcesActiveRow, setViewSourcesActiveRow] = useState<{ attrKey: string; candidateIdx: number } | null>(null);
  // Card currently hovered in the View Sources right pane — lights up its doc-rail marker
  const [viewSourcesHoveredAttr, setViewSourcesHoveredAttr] = useState<string | null>(null);
  // When on, the View Sources right pane lists only cards whose selected value is in the doc in focus
  const [viewSourcesOnlyActiveDoc, setViewSourcesOnlyActiveDoc] = useState<boolean>(false);
  // Right-pane tab inside the View Sources view: 'mapped' | 'unmapped' | 'discrepancies'
  const [viewSourcesTab, setViewSourcesTab] = useState<'mapped' | 'unmapped' | 'discrepancies'>('mapped');
  // Currently-selected unmapped attribute in the Unmapped tab — drives the doc highlight
  const [viewSourcesUnmappedAttr, setViewSourcesUnmappedAttr] = useState<string | null>(null);
  // Currently-expanded source group in the Unmapped tab
  const [viewSourcesUnmappedGroup, setViewSourcesUnmappedGroup] = useState<string | null>(null);
  // Currently-expanded canonical-term box in the Mapped tab
  const [viewSourcesMappedGroup, setViewSourcesMappedGroup] = useState<string | null>(null);
  // Attribute key whose canonical-term picker popover is open in the Unmapped tab (null = closed)
  const [viewSourcesMapPickerAttr, setViewSourcesMapPickerAttr] = useState<string | null>(null);
  // Search text inside the open canonical-term picker
  const [viewSourcesMapPickerSearch, setViewSourcesMapPickerSearch] = useState<string>('');
  // Anchor rect for the canonical-term picker — fixed-positioned so it escapes the group box's overflow clip
  const [viewSourcesMapPickerRect, setViewSourcesMapPickerRect] = useState<{ top: number; left: number } | null>(null);
  // Pool model for View Sources: each extraction row (lineId::attrKey::candidateIdx) is an atomic item
  // that is either mapped to a canonical term or sits in the unmapped pool — never deleted. This is a
  // row-level override layered over the attribute-level `canonicalTermMappings`: a value of '' means the
  // row was explicitly returned to the pool; a term string means explicitly mapped; absent = inherit the
  // attribute's default mapping.
  const [viewSourcesRowMap, setViewSourcesRowMap] = useState<Record<string, string>>({
    // Chicago Warehouse — "Unable to resolve source" seed: all three Zip extractions are
    // mapped to the ZIP Code canonical term (ACORD 140 / Email / ACORD 125). The Email
    // candidate disagrees (60612 vs 60607), so with no confirmed pick the detector flags the
    // term as an unresolved-source conflict rather than a single low-confidence value.
    // (Candidate 0 already inherits the mapping via canonicalTermMappings; 1 and 2 are explicit.)
    'a01SB00001p8B6rYAE::Zip::1': 'ZIP Code',
    'a01SB00001p8B6rYAE::Zip::2': 'ZIP Code',
  });
  // Multi-association layer: an extraction row can additionally belong to canonical terms beyond its
  // primary (`viewSourcesRowMap`) term. Keyed lineId::attrKey::candidateIdx → extra term list. The primary
  // term and this list are disjoint; every term-grouping site unions primary + extras so an attribute can
  // sit in several Canonical term boxes at once. Empty/absent = no extra associations (identical to before).
  const [viewSourcesExtraTerms, setViewSourcesExtraTerms] = useState<Record<string, string[]>>({});
  // Preferred (winning) extraction row per canonical term: lineId::term → itemId (attrKey::candidateIdx),
  // or the sentinel '__manual__' when the term's manually-entered value is the winner.
  // No seeded picks: enrichment candidates are listed LAST in demoStepData, so the non-enrichment
  // (doc/SoV) candidate sits at index 0 and becomes the term's default winner (items[0]). At line
  // step 4 the enrichment candidate maps to the same term as an additional source without displacing
  // that existing winner (see rowTermFor).
  const [viewSourcesTermPref, setViewSourcesTermPref] = useState<Record<string, string>>({});
  // Manually-entered value per canonical term: lineId::term → value. Independent of the extraction pool;
  // when selected (viewSourcesTermPref === '__manual__') it becomes the term's preferred value.
  const [viewSourcesTermManual, setViewSourcesTermManual] = useState<Record<string, string>>({});
  // Canonical term (lineId::term) whose manual value is currently being inline-edited, or null.
  const [viewSourcesEditingManual, setViewSourcesEditingManual] = useState<string | null>(null);
  // Per-row manual override in View Sources: lineId::attrKey::candidateIdx → value. When non-empty this
  // replaces the extracted value for that row (attribute name + source stay intact); empty = use extracted.
  const [viewSourcesOverride, setViewSourcesOverride] = useState<Record<string, string>>({});
  // Row (rowKey) whose override value is currently being inline-edited, or null.
  const [viewSourcesEditingRow, setViewSourcesEditingRow] = useState<string | null>(null);
  // Row (rowKey) whose override cell is hovered — reveals the SLDS-style inline-edit pencil.
  const [viewSourcesHoverRow, setViewSourcesHoverRow] = useState<string | null>(null);
  // When a manual-value row is clicked, the doc canvas swaps to a light-grey
  // "manually updated" message instead of a source document. Null = show docs.
  const [viewSourcesManualActive, setViewSourcesManualActive] = useState<boolean>(false);
  // Extracted Data tab — status pill popover (which canonical terms a pool item is
  // associated with / selected in). Keyed per row; null = closed. Shared by the
  // record-view panel and the View Sources modal (only one is open at a time).
  const [statusPopover, setStatusPopover] = useState<{ key: string; top: number; left: number; associated: string[]; selected: string[] } | null>(null);
  // Reconcile-mode document dropdown open/closed.
  const [reconcileDocMenuOpen, setReconcileDocMenuOpen] = useState(false);
  // Reconcile-mode left hierarchy: node ids explicitly collapsed by the user (default expanded).
  const [reconcileTreeCollapsed, setReconcileTreeCollapsed] = useState<Set<string>>(new Set());
  // Scroll container ref + computed marker positions for the View Sources doc viewer
  const docScrollRef = useRef<HTMLDivElement | null>(null);
  // Spreadsheet (Statement of Values) scroll container + a guard tracking the last value we
  // auto-scrolled to, so clicking an attribute row scrolls that cell into view exactly once.
  const sovScrollRef = useRef<HTMLDivElement | null>(null);
  const sovScrolledValueRef = useRef<string>('');
  // Right-pane (canonical-term list) scroll container + a per-row ref map keyed by
  // `${attrKey}::${candidateIdx}`, so clicking a doc hotspot can scroll the matching
  // right-pane row into view (expanding its collapsed term box first).
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [markerPositions, setMarkerPositions] = useState<Array<{ fraction: number; top: number; attrKey: string | null }>>([]);
  // Doc-canvas zoom (0.5x–2x). Shared by every file type in the View Sources / Select Source viewer.
  const [docZoom, setDocZoom] = useState(1);
  // Inline-edit state for the value cell: { lineId, attrKey } | null
  const [editingAttribute, setEditingAttribute] = useState<{ lineId: string; attrKey: string } | null>(null);
  const [editingDraftValue, setEditingDraftValue] = useState<string>('');
  // Resolve Duplicates modal state
  const [isResolveDuplicatesOpen, setIsResolveDuplicatesOpen] = useState(false);
  const [duplicateCategory, setDuplicateCategory] = useState<'Location' | 'Building' | 'Equipment / Contents'>('Location');
  const [comparisonIdx, setComparisonIdx] = useState(0);
  // Manual-merge mode: when non-null, the Resolve Duplicates modal is driven by these
  // hand-picked ids from the tree toolbar rather than the detected duplicate carousel.
  const [mergeGroupIds, setMergeGroupIds] = useState<string[] | null>(null);
  // Warning shown when a manual merge selection spans more than one line type.
  const [mergeTypeWarning, setMergeTypeWarning] = useState<string | null>(null);
  // All / Matches / Differences filter for the Resolve Duplicates comparison table
  const [comparisonFilter, setComparisonFilter] = useState<'all' | 'matches' | 'differences'>('all');
  // Tree row-action menu (id of the row whose menu is currently open, or null)
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  // Tree-toolbar overflow menu (used in panel view to host all bulk actions)
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false);
  // Cross-LOB discrepancies modal state
  const [isCrossLobOpen, setIsCrossLobOpen] = useState(false);
  const [crossLobLineIdx, setCrossLobLineIdx] = useState(0);
  const [crossLobResolvedLines, setCrossLobResolvedLines] = useState<Set<string>>(new Set());
  // Per-row "Use New Value" checkbox state. Key = `${lineId}::${attrKey}`. Pure UI state for the demo.
  const [crossLobUseNewValue, setCrossLobUseNewValue] = useState<Record<string, boolean>>({});
  // Map of comparison key (sorted ids joined) → resolution: 'merged' | 'not-merged' | 'skipped'
  const [duplicateResolutions, setDuplicateResolutions] = useState<Record<string, 'merged' | 'not-merged' | 'skipped'>>({});
  // Map of submission line id → boolean (selected for merge in current comparison)
  const [duplicateSelections, setDuplicateSelections] = useState<Record<string, boolean>>({});
  // Reconcile Discrepancies — resolved-lines set (drives the queue + tree discrepancy clearing).
  // Parent-clean / child-error case in Reconcile Attributes: Location 2 (Austin Office Campus)
  // is seeded as resolved so it carries no discrepancy count of its own, yet its errored children
  // (L2-B1 HQ Tower, L2-B2 R&D Lab) keep it visible as a non-selectable ancestor in the reconcile
  // tree. Without this seed the parent's unmapped core terms would surface it as its own error line.
  const [reconcileResolvedLines, setReconcileResolvedLines] = useState<Set<string>>(
    () => new Set(['a01SB00001p85SsYAI'])
  );
  // Per-box resolution in the Discrepancies tab — keyed `${lineId}::${term}`; a resolved term
  // drops its box from that tab without touching the underlying mapping.
  const [reconcileResolvedTerms, setReconcileResolvedTerms] = useState<Set<string>>(new Set());
  // Submission line tree multi-select
  const [treeSelectedIds, setTreeSelectedIds] = useState<Set<string>>(new Set());
  // Left submission-line tree search box
  const [treeSearch, setTreeSearch] = useState('');
  // "View on map" modal — holds the launching location id (pre-selected in the map)
  const [mapModalLineId, setMapModalLineId] = useState<string | null>(null);
  // Inner tab inside the right-side line detail panel
  const [linePanelTab, setLinePanelTab] = useState<'attributes' | 'details' | 'unmapped'>('attributes');
  // Enriched Data tab — collapsed/expanded state per category id
  const [expandedEnrichmentCats, setExpandedEnrichmentCats] = useState<Set<string>>(new Set());
  // Canonical-attribute category sections (shared by the record-view Attributes table and the
  // View Sources modal). A category defaults open when it holds data; these two sets record the
  // user's explicit open/close overrides on top of that default.
  const [canonicalCatOpened, setCanonicalCatOpened] = useState<Set<string>>(new Set());
  const [canonicalCatClosed, setCanonicalCatClosed] = useState<Set<string>>(new Set());
  // Record-view Attributes tab: when on, filter Canonical + Unmapped lists to enrichment-API rows only.
  // Detail-panel Attributes tab filters (independent of the Unmapped tab)
  const [attrSearch, setAttrSearch] = useState('');
  const [attrSourceFilter, setAttrSourceFilter] = useState<Set<string>>(new Set());
  const [attrSourceMenuOpen, setAttrSourceMenuOpen] = useState(false);
  const [attrUnmappedOnly, setAttrUnmappedOnly] = useState(false);
  // Detail-panel Unmapped tab filters (independent of the Attributes tab)
  const [unmappedSearch, setUnmappedSearch] = useState('');
  const [unmappedSourceFilter, setUnmappedSourceFilter] = useState<Set<string>>(new Set());
  const [unmappedSourceMenuOpen, setUnmappedSourceMenuOpen] = useState(false);
  const [unmappedStatusFilter, setUnmappedStatusFilter] = useState<Set<string>>(new Set());
  const [unmappedStatusMenuOpen, setUnmappedStatusMenuOpen] = useState(false);
  // Enrichment lifecycle line step (local to this page, independent of the global demo step
  // which stays capped at 9). 1 = enrichment pending, 2 = retrieved (unmapped), 3 = enriched & mapped.
  // manual state (mirrors the Data Completion Check task in Submission step 4).
  const [runEnrichmentTaskIds, setRunEnrichmentTaskIds] = useState<Set<string>>(new Set());
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  // Move modal: search box + which target-tree nodes are expanded
  const [moveSearch, setMoveSearch] = useState('');
  const [moveExpanded, setMoveExpanded] = useState<Set<string>>(new Set());
  // Lines the Move modal operates on. `null` = mass move (use the checkbox selection); a non-null
  // array = a single-row Move launched from a row action menu.
  const [moveSourceIds, setMoveSourceIds] = useState<string[] | null>(null);
  // Local reparent overrides (demo only): { childId: newParentId }
  const [movedParentOverrides, setMovedParentOverrides] = useState<Record<string, string>>({});
  // Create Submission Line modal (demo only — no persistence). `createLineParentId` prefills the
  // Parent Record field when launched via "Add Child"; null when launched from the toolbar "Add".
  const [isCreateLineOpen, setIsCreateLineOpen] = useState(false);
  // When non-null the create modal is in Edit mode for this line id (title/footer change, no "Save & New").
  const [createLineEditId, setCreateLineEditId] = useState<string | null>(null);
  const [createLineParentId, setCreateLineParentId] = useState<string | null>(null);
  // When true (launched from "Add Child") the Parent Record is fixed; when false ("Add") it's a picker.
  const [createLineParentLocked, setCreateLineParentLocked] = useState(false);
  const emptyCreateLineForm = {
    name: '',
    lineType: 'Location',
    lineOfBusiness: 'Property',
    status: 'Active',
    owner: '',
    insuredValue: '',
    coverageLimit: '',
    deductible: '',
    premiumAllocation: '',
  };
  const [createLineForm, setCreateLineForm] = useState<Record<string, string>>(emptyCreateLineForm);
  // Parent Record lookup (Add mode): typeahead text + whether the results dropdown is open.
  const [parentLookupQuery, setParentLookupQuery] = useState('');
  const [parentLookupOpen, setParentLookupOpen] = useState(false);
  // Demo-local set of deleted line ids (a delete also removes descendants). Resets on reload.
  const [deletedLineIds, setDeletedLineIds] = useState<Set<string>>(new Set());
  // Delete confirmation: the line id pending deletion (drives the confirm modal), or null.
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[] | null>(null);
  // Canonical term mappings per line per attribute: { "lineId::attrKey": "Location" | "Building" | ... | null }
  const [canonicalTermMappings, setCanonicalTermMappings] = useState<Record<string, string | null>>(() => ({
    // L1-B1 - Main Warehouse (Property Building)
    'a01SB00001p8BA5YAM::Construction Type': 'Construction Type',
    'a01SB00001p8BA5YAM::Year Built': 'Year Built',
    'a01SB00001p8BA5YAM::Square Footage': 'Square Footage',
    // Leave Stories unmapped intentionally
    'a01SB00001p8BA5YAM::Roof Type': 'Roof Type',
    'a01SB00001p8BA5YAM::Roof Year': 'Roof Age',
    'a01SB00001p8BA5YAM::Occupancy': 'Occupancy Type',

    // Location 1 - Chicago Warehouse
    'a01SB00001p8B6rYAE::Address': 'Street Address',
    'a01SB00001p8B6rYAE::City': 'City',
    'a01SB00001p8B6rYAE::State': 'State',
    'a01SB00001p8B6rYAE::Zip': 'ZIP Code',
    'a01SB00001p8B6rYAE::Sprinklered': 'Sprinkler System',
    'a01SB00001p8B6rYAE::Fire Alarm': 'Fire Alarm',
    'a01SB00001p8B6rYAE::Protection Class': 'Protection Class',
    // Leave Security unmapped intentionally

    // Chicago Warehouse — Verisk 360 enrichment reconciliation (line step 3). Roughly two-thirds
    // of the enriched attributes map cleanly to canonical terms; the remainder stay in the unmapped
    // pool to show a partial post-reconciliation state.
    'a01SB00001p8B6rYAE::Construction Type': 'Construction Type',
    'a01SB00001p8B6rYAE::Year Built': 'Year Built',
    'a01SB00001p8B6rYAE::Total Building Area': 'Square Footage',
    'a01SB00001p8B6rYAE::Number of Stories': 'Number of Stories',
    'a01SB00001p8B6rYAE::Basement Type': 'Basement Type',
    'a01SB00001p8B6rYAE::Roof Type': 'Roof Type',
    'a01SB00001p8B6rYAE::Roof Covering': 'Roof Covering',
    'a01SB00001p8B6rYAE::Roof Age': 'Roof Age',
    'a01SB00001p8B6rYAE::Roof Condition': 'Roof Condition',
    'a01SB00001p8B6rYAE::Building Condition': 'Building Condition',
    'a01SB00001p8B6rYAE::Wiring Type': 'Wiring Type',
    'a01SB00001p8B6rYAE::Electrical Update Year': 'Electrical Update Year',
    'a01SB00001p8B6rYAE::Plumbing Type': 'Plumbing Type',
    'a01SB00001p8B6rYAE::Heating System': 'Heating System',
    'a01SB00001p8B6rYAE::HVAC Age': 'HVAC Age',
    'a01SB00001p8B6rYAE::Exterior Wall Material': 'Exterior Wall Material',
    'a01SB00001p8B6rYAE::Latitude': 'Latitude',
    'a01SB00001p8B6rYAE::Longitude': 'Longitude',
    'a01SB00001p8B6rYAE::FEMA Flood Zone': 'FEMA Flood Zone',
    'a01SB00001p8B6rYAE::Fire Station Distance': 'Distance to Fire Station',
    'a01SB00001p8B6rYAE::Building Replacement Cost': 'Building Replacement Cost',
    // Left intentionally unmapped at step 3 (remain in the unmapped pool):
    //   Foundation Type, Distance to Coast, Earthquake Zone, Water Supply Type,
    //   Wildfire Risk Score, Hail Risk Zone

    // L1-B2 - Loading Dock Annex
    'a01SB00001p8BGXYA2::Construction Type': 'Construction Type',
    'a01SB00001p8BGXYA2::Year Built': 'Year Built',
    'a01SB00001p8BGXYA2::Square Footage': 'Square Footage',
    // Leave Roof Type unmapped intentionally
    'a01SB00001p8BGXYA2::Roof Year': 'Roof Age',
    'a01SB00001p8BGXYA2::Occupancy': 'Occupancy Type',

    // General Liability LOB
    'a01SB00001pGYUTYA4::Premium Basis': null, // Intentionally unmapped

    // ── Duplicate pairs — pre-mapped so the Resolve Duplicates comparison
    //    table renders side-by-side values without manual reconciliation.

    // Location 3A - San Jose Manufacturing Campus
    'a01SB00001pDUP3A::Address': 'Street Address',
    'a01SB00001pDUP3A::City': 'City',
    'a01SB00001pDUP3A::State': 'State',
    'a01SB00001pDUP3A::Zip': 'ZIP Code',
    'a01SB00001pDUP3A::Sprinklered': 'Sprinkler System',
    'a01SB00001pDUP3A::Fire Alarm': 'Fire Alarm',

    // Location 3B - San Jose Manufacturing Facility
    'a01SB00001pDUP3B::Address': 'Street Address',
    'a01SB00001pDUP3B::City': 'City',
    'a01SB00001pDUP3B::State': 'State',
    'a01SB00001pDUP3B::Zip': 'ZIP Code',
    'a01SB00001pDUP3B::Sprinklered': 'Sprinkler System',
    'a01SB00001pDUP3B::Fire Alarm': 'Fire Alarm',

    // Location 5A / 5B - Austin duplicate pair (identical mapped values → all rows match)
    'a01SB00001pDUP5A::Address': 'Street Address',
    'a01SB00001pDUP5A::City': 'City',
    'a01SB00001pDUP5A::State': 'State',
    'a01SB00001pDUP5A::Zip': 'ZIP Code',
    'a01SB00001pDUP5A::Sprinklered': 'Sprinkler System',
    'a01SB00001pDUP5A::Fire Alarm': 'Fire Alarm',
    'a01SB00001pDUP5B::Address': 'Street Address',
    'a01SB00001pDUP5B::City': 'City',
    'a01SB00001pDUP5B::State': 'State',
    'a01SB00001pDUP5B::Zip': 'ZIP Code',
    'a01SB00001pDUP5B::Sprinklered': 'Sprinkler System',
    'a01SB00001pDUP5B::Fire Alarm': 'Fire Alarm',

    // L3A-B1 - Manufacturing Building A
    'a01SB00001pDUP3AB1::Construction Type': 'Construction Type',
    'a01SB00001pDUP3AB1::Year Built': 'Year Built',
    'a01SB00001pDUP3AB1::Square Footage': 'Square Footage',
    'a01SB00001pDUP3AB1::Stories': 'Number of Stories',
    'a01SB00001pDUP3AB1::Roof Type': 'Roof Type',
    'a01SB00001pDUP3AB1::Roof Year': 'Roof Age',
    'a01SB00001pDUP3AB1::Occupancy': 'Occupancy Type',

    // L3B-B1 - Manufacturing Facility Building A
    'a01SB00001pDUP3BB1::Construction Type': 'Construction Type',
    'a01SB00001pDUP3BB1::Year Built': 'Year Built',
    'a01SB00001pDUP3BB1::Square Footage': 'Square Footage',
    'a01SB00001pDUP3BB1::Stories': 'Number of Stories',
    'a01SB00001pDUP3BB1::Roof Type': 'Roof Type',
    'a01SB00001pDUP3BB1::Roof Year': 'Roof Age',
    'a01SB00001pDUP3BB1::Occupancy': 'Occupancy Type',

    // L3A-B3 - Warehouse & Distribution
    'a01SB00001pDUP3AB3::Construction Type': 'Construction Type',
    'a01SB00001pDUP3AB3::Year Built': 'Year Built',
    'a01SB00001pDUP3AB3::Square Footage': 'Square Footage',
    'a01SB00001pDUP3AB3::Stories': 'Number of Stories',
    'a01SB00001pDUP3AB3::Roof Type': 'Roof Type',
    'a01SB00001pDUP3AB3::Roof Year': 'Roof Age',
    'a01SB00001pDUP3AB3::Occupancy': 'Occupancy Type',

    // L3B-B3 - Distribution Center
    'a01SB00001pDUP3BB3::Construction Type': 'Construction Type',
    'a01SB00001pDUP3BB3::Year Built': 'Year Built',
    'a01SB00001pDUP3BB3::Square Footage': 'Square Footage',
    'a01SB00001pDUP3BB3::Stories': 'Number of Stories',
    'a01SB00001pDUP3BB3::Roof Type': 'Roof Type',
    'a01SB00001pDUP3BB3::Roof Year': 'Roof Age',
    'a01SB00001pDUP3BB3::Occupancy': 'Occupancy Type',

    // L3A-B1 - Manufacturing Equipment
    'a01SB00001pDUP3AB1E::Coverage': 'Equipment Coverage',
    'a01SB00001pDUP3AB1E::Valuation': 'Equipment Valuation',
    'a01SB00001pDUP3AB1E::Equipment Type': 'Equipment Type',
    'a01SB00001pDUP3AB1E::Breakdown Coverage': 'Breakdown Coverage',

    // L3B-B1 - Production Equipment
    'a01SB00001pDUP3BB1E::Coverage': 'Equipment Coverage',
    'a01SB00001pDUP3BB1E::Valuation': 'Equipment Valuation',
    'a01SB00001pDUP3BB1E::Equipment Type': 'Equipment Type',
    'a01SB00001pDUP3BB1E::Breakdown Coverage': 'Breakdown Coverage',

    // ── Submission Parties ──
    // Account 1 — NexGen Biologics Inc
    'a01SBPARTY0ACC01::Account Name': 'Account Name',
    'a01SBPARTY0ACC01::Account Type': 'Account Type',
    'a01SBPARTY0ACC01::DBA': 'DBA',
    'a01SBPARTY0ACC01::Legal Entity': 'Legal Entity Type',
    'a01SBPARTY0ACC01::Tax ID': 'Tax ID',
    'a01SBPARTY0ACC01::DUNS Number': 'DUNS Number',
    'a01SBPARTY0ACC01::Industry': 'Industry',
    'a01SBPARTY0ACC01::SIC Code': 'SIC Code',
    'a01SBPARTY0ACC01::NAICS Code': 'NAICS Code',
    'a01SBPARTY0ACC01::Website': 'Website',
    'a01SBPARTY0ACC01::Billing Street': 'Billing Street',
    'a01SBPARTY0ACC01::Billing City': 'Billing City',
    'a01SBPARTY0ACC01::Billing State': 'Billing State',
    'a01SBPARTY0ACC01::Billing Zip': 'Billing ZIP',
    'a01SBPARTY0ACC01::Phone': 'Phone',
    'a01SBPARTY0ACC01::Annual Revenue': 'Annual Revenue',
    'a01SBPARTY0ACC01::Employees': 'Number of Employees',
    // Leave Year Established unmapped intentionally

    // Account 1 → Contact — Dr. Elena Vasquez
    'a01SBPARTY0CON01::First Name': 'First Name',
    'a01SBPARTY0CON01::Last Name': 'Last Name',
    'a01SBPARTY0CON01::Title': 'Title',
    'a01SBPARTY0CON01::Contact Role': 'Contact Role',
    'a01SBPARTY0CON01::Email': 'Email',
    'a01SBPARTY0CON01::Phone': 'Phone',
    'a01SBPARTY0CON01::Mobile': 'Mobile',
    'a01SBPARTY0CON01::Mailing Street': 'Mailing Street',
    'a01SBPARTY0CON01::Mailing City': 'Mailing City',
    'a01SBPARTY0CON01::Mailing State': 'Mailing State',
    'a01SBPARTY0CON01::Mailing Zip': 'Mailing ZIP',
    // Leave Preferred Contact Method unmapped intentionally

    // Account 2 — Vanguard Insurance Partners
    'a01SBPARTY0ACC02::Account Name': 'Account Name',
    'a01SBPARTY0ACC02::Account Type': 'Account Type',
    'a01SBPARTY0ACC02::DBA': 'DBA',
    'a01SBPARTY0ACC02::Legal Entity': 'Legal Entity Type',
    'a01SBPARTY0ACC02::Tax ID': 'Tax ID',
    'a01SBPARTY0ACC02::DUNS Number': 'DUNS Number',
    'a01SBPARTY0ACC02::Industry': 'Industry',
    'a01SBPARTY0ACC02::SIC Code': 'SIC Code',
    'a01SBPARTY0ACC02::NAICS Code': 'NAICS Code',
    'a01SBPARTY0ACC02::Website': 'Website',
    'a01SBPARTY0ACC02::Billing Street': 'Billing Street',
    'a01SBPARTY0ACC02::Billing City': 'Billing City',
    'a01SBPARTY0ACC02::Billing State': 'Billing State',
    'a01SBPARTY0ACC02::Billing Zip': 'Billing ZIP',
    'a01SBPARTY0ACC02::Phone': 'Phone',
    'a01SBPARTY0ACC02::Annual Revenue': 'Annual Revenue',
    'a01SBPARTY0ACC02::Employees': 'Number of Employees',
    // Leave Year Established unmapped intentionally

    // Account 2 → Contact — Niki Paoloni
    'a01SBPARTY0CON02::First Name': 'First Name',
    'a01SBPARTY0CON02::Last Name': 'Last Name',
    'a01SBPARTY0CON02::Title': 'Title',
    'a01SBPARTY0CON02::Contact Role': 'Contact Role',
    'a01SBPARTY0CON02::Email': 'Email',
    'a01SBPARTY0CON02::Phone': 'Phone',
    'a01SBPARTY0CON02::Mobile': 'Mobile',
    'a01SBPARTY0CON02::Mailing Street': 'Mailing Street',
    'a01SBPARTY0CON02::Mailing City': 'Mailing City',
    'a01SBPARTY0CON02::Mailing State': 'Mailing State',
    'a01SBPARTY0CON02::Mailing Zip': 'Mailing ZIP',
    // Leave Preferred Contact Method unmapped intentionally

    // ── Shared Locations ──
    ...Object.fromEntries(
      ['a01SBSHLOC01', 'a01SBSHLOC02', 'a01SBSHLOC03'].flatMap((locId) => [
        [`${locId}::Street Address`, 'Street Address'],
        [`${locId}::City`, 'City'],
        [`${locId}::State`, 'State'],
        [`${locId}::Zip`, 'ZIP Code'],
        [`${locId}::Country`, 'Country'],
        [`${locId}::Construction Type`, 'Construction Type'],
        [`${locId}::Year Built`, 'Year Built'],
        [`${locId}::Square Footage`, 'Square Footage'],
        [`${locId}::Number of Stories`, 'Number of Stories'],
        [`${locId}::Occupancy Type`, 'Occupancy Type'],
        [`${locId}::Sprinklered`, 'Sprinkler System'],
        [`${locId}::Fire Alarm`, 'Fire Alarm'],
        [`${locId}::Security`, 'Security'],
        [`${locId}::Building Value`, 'Building Replacement Cost'],
      ])
    ),
  }));
  // Merged duplicate groups (session-scoped). Keyed by sorted-ids resolution key.
  // Each entry holds the source ids in the order the user resolved them.
  const [mergedGroups, setMergedGroups] = useState<Record<string, string[]>>({});

  const PANEL_ANIM_MS = 260;
  useEffect(() => {
    if (panelCloseTimer.current) {
      clearTimeout(panelCloseTimer.current);
      panelCloseTimer.current = null;
    }
    if (panelSettleTimer.current) {
      clearTimeout(panelSettleTimer.current);
      panelSettleTimer.current = null;
    }
    if (selectedSubmissionLineId) {
      setPanelLineId(selectedSubmissionLineId);
      setPanelSettled(false);
      const raf = requestAnimationFrame(() => setPanelOpen(true));
      panelSettleTimer.current = setTimeout(() => setPanelSettled(true), PANEL_ANIM_MS);
      return () => cancelAnimationFrame(raf);
    }
    setPanelOpen(false);
    setPanelSettled(false);
    panelCloseTimer.current = setTimeout(() => setPanelLineId(null), PANEL_ANIM_MS);
    return undefined;
  }, [selectedSubmissionLineId]);

  useLayoutEffect(() => {
    const el = docScrollRef.current;
    if (!el || !lineSourceViewer) {
      if (markerPositions.length) setMarkerPositions([]);
      return;
    }
    // Wait one frame so the rendered doc has settled before measuring.
    const handle = window.requestAnimationFrame(() => {
      const inner = docScrollRef.current;
      if (!inner) return;
      const total = inner.scrollHeight;
      if (total <= 0) return;
      const marks = Array.from(inner.querySelectorAll('mark[data-doc-mark]')) as HTMLElement[];
      const containerTop = inner.getBoundingClientRect().top;
      const containerScroll = inner.scrollTop;
      const positions = marks.map((m) => {
        const r = m.getBoundingClientRect();
        const top = (r.top - containerTop) + containerScroll;
        const attrKey = m.getAttribute('data-attr-key');
        return { fraction: Math.max(0, Math.min(1, top / total)), top, attrKey };
      });
      // Dedupe markers that fall within 4px of each other to avoid clutter.
      const deduped: Array<{ fraction: number; top: number; attrKey: string | null }> = [];
      positions
        .sort((a, b) => a.top - b.top)
        .forEach((p) => {
          if (deduped.length === 0 || Math.abs(p.top - deduped[deduped.length - 1].top) > 4) {
            deduped.push(p);
          }
        });
      setMarkerPositions(deduped);
    });
    return () => window.cancelAnimationFrame(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineSourceViewer?.activeIdx, lineSourceViewer?.lineId, viewSourcesActiveRow, viewSourcesExpandedAttr, viewSourcesUnmappedAttr, viewSourcesUnmappedGroup, viewSourcesTab, docZoom]);

  // When the active row changes (e.g. a doc hotspot was clicked), scroll the matching
  // right-pane row into view. Runs after the expand/tab state has painted the row.
  useLayoutEffect(() => {
    if (!lineSourceViewer || !viewSourcesActiveRow) return;
    const key = `${viewSourcesActiveRow.attrKey}::${viewSourcesActiveRow.candidateIdx}`;
    const handle = window.requestAnimationFrame(() => {
      const row = rowRefs.current[key];
      const pane = rightPaneRef.current;
      if (!row || !pane) return;
      const rowBox = row.getBoundingClientRect();
      const paneBox = pane.getBoundingClientRect();
      if (rowBox.top < paneBox.top || rowBox.bottom > paneBox.bottom) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
    return () => window.cancelAnimationFrame(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSourcesActiveRow, viewSourcesMappedGroup, viewSourcesTab]);

  const SESSION_KEY = 'lobDataResolutionSession';
  const sessionHydratedRef = useRef(false);
  useEffect(() => {
    if (!mounted || sessionHydratedRef.current) return;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.submissionLineEdits) setSubmissionLineEdits(s.submissionLineEdits);
        if (s.submissionLineSourceIdx) setSubmissionLineSourceIdx(s.submissionLineSourceIdx);
        if (s.duplicateResolutions) setDuplicateResolutions(s.duplicateResolutions);
        // Merge persisted resolved lines *over* the seeded defaults (rather than replacing) so a
        // stale session saved before a seed key existed (e.g. Location 2 / Austin Office Campus)
        // still keeps the parent-clean seed; user resolutions add to it.
        if (s.reconcileResolvedLines) setReconcileResolvedLines((prev) => new Set<string>([...Array.from(prev), ...s.reconcileResolvedLines]));
        if (s.reconcileResolvedTerms) setReconcileResolvedTerms(new Set<string>(s.reconcileResolvedTerms));
        // Merge persisted mappings *over* the seeded defaults (rather than replacing) so a stale
        // session saved before new seed keys were added (e.g. the Verisk enrichment reconciliation
        // mappings) still picks them up; user edits to overlapping keys still win.
        if (s.canonicalTermMappings) setCanonicalTermMappings((prev) => ({ ...prev, ...s.canonicalTermMappings }));
        if (s.viewSourcesRowMap) setViewSourcesRowMap((prev) => ({ ...prev, ...s.viewSourcesRowMap }));
        if (s.viewSourcesExtraTerms) setViewSourcesExtraTerms(s.viewSourcesExtraTerms);
        if (s.viewSourcesTermPref) setViewSourcesTermPref((prev) => ({ ...prev, ...s.viewSourcesTermPref }));
        if (s.viewSourcesTermManual) setViewSourcesTermManual(s.viewSourcesTermManual);
        if (s.viewSourcesOverride) setViewSourcesOverride(s.viewSourcesOverride);
        if (s.movedParentOverrides) setMovedParentOverrides(s.movedParentOverrides);
        if (s.mergedGroups) setMergedGroups(s.mergedGroups);
        if (s.manualCorrections) setManualCorrections(s.manualCorrections);
        if (s.crossLobResolvedLines) setCrossLobResolvedLines(new Set<string>(s.crossLobResolvedLines));
        if (s.crossLobUseNewValue) setCrossLobUseNewValue(s.crossLobUseNewValue);
      }
    } catch (e) {
      // session storage unavailable — quietly skip
    }
    sessionHydratedRef.current = true;
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !sessionHydratedRef.current) return;
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          submissionLineEdits,
          submissionLineSourceIdx,
          duplicateResolutions,
          reconcileResolvedLines: Array.from(reconcileResolvedLines),
          reconcileResolvedTerms: Array.from(reconcileResolvedTerms),
          canonicalTermMappings,
          viewSourcesRowMap,
          viewSourcesExtraTerms,
          viewSourcesTermPref,
          viewSourcesTermManual,
          viewSourcesOverride,
          movedParentOverrides,
          mergedGroups,
          manualCorrections,
          crossLobResolvedLines: Array.from(crossLobResolvedLines),
          crossLobUseNewValue,
        })
      );
    } catch (e) {
      // ignore
    }
  }, [
    mounted,
    submissionLineEdits,
    submissionLineSourceIdx,
    duplicateResolutions,
    reconcileResolvedLines,
    reconcileResolvedTerms,
    canonicalTermMappings,
    viewSourcesRowMap,
    viewSourcesExtraTerms,
    viewSourcesTermPref,
    viewSourcesTermManual,
    viewSourcesOverride,
    movedParentOverrides,
    mergedGroups,
    manualCorrections,
    crossLobResolvedLines,
    crossLobUseNewValue,
  ]);


  useEffect(() => {
    if (sourcePickerAnchor) {
      const editKey = `${sourcePickerAnchor.lineId}::${sourcePickerAnchor.attrKey}`;
      setSourcePickerActiveTab(submissionLineSourceIdx[editKey] ?? 0);
    }
  }, [sourcePickerAnchor, submissionLineSourceIdx]);

  const vsAutoOpenRef = useRef(false);
  // Sticky Discrepancies-tab membership: terms that have surfaced as discrepancies for the open
  // line stay in the tab until the user clicks "Mark as Resolved" — associating an attribute
  // resolves the live discrepancy but must not drop the box mid-review. Re-snapshots per line.
  const discStickyRef = useRef<{ lineId: string | null; terms: Set<string> }>({ lineId: null, terms: new Set() });
  const vsStandalone = props.vsStandalone ?? false;
  const setVsStandalone = props.setVsStandalone ?? (() => {});
  useEffect(() => {
    if (!mounted || !router.isReady || vsAutoOpenRef.current) return;
    const { vsLine, vsMode, vsIdx, vsTab, vsSources } = router.query;
    if (typeof vsLine !== 'string') return;
    vsAutoOpenRef.current = true;
    setVsStandalone(true);
    const sources = typeof vsSources === 'string' && vsSources.length > 0 ? vsSources.split('|') : [];
    const activeIdx = typeof vsIdx === 'string' ? parseInt(vsIdx, 10) || 0 : 0;
    const mode = vsMode === 'reconcile' ? 'reconcile' : 'view';
    if (vsTab === 'discrepancies' || vsTab === 'unmapped' || vsTab === 'mapped') setViewSourcesTab(vsTab);
    setLineSourceViewer({ lineId: vsLine, sources, activeIdx, mode });
  }, [mounted, router.isReady, router.query]);

  // The global Underwriter Assistant navigates here with ?resolve=attributes|duplicates to launch
  // the Resolve Attribute Mapping (reconcile) or Resolve Duplicates modal. Those openers depend on
  // in-render IIFE-scoped state (reconcileQueueIds / buildLineSources / duplicateGroups), so they're
  // assigned to refs during render (below) and invoked from here once the query param is read.
  const openReconcileRef = useRef<null | (() => void)>(null);
  const openDuplicatesRef = useRef<null | (() => void)>(null);
  const [autoResolve, setAutoResolve] = useState<null | 'attributes' | 'duplicates'>(null);
  const autoResolveHandledRef = useRef(false);
  useEffect(() => {
    if (!mounted || !router.isReady || autoResolveHandledRef.current) return;
    const { resolve } = router.query;
    if (resolve !== 'attributes' && resolve !== 'duplicates') return;
    autoResolveHandledRef.current = true;
    setAutoResolve(resolve);
  }, [mounted, router.isReady, router.query]);
  useEffect(() => {
    if (!autoResolve) return;
    const t = setTimeout(() => {
      if (autoResolve === 'attributes') openReconcileRef.current?.();
      else openDuplicatesRef.current?.();
      setAutoResolve(null);
    }, 350);
    return () => clearTimeout(t);
  }, [autoResolve]);

  // Close the tree row-action menu when clicking elsewhere or pressing Escape
  useEffect(() => {
    if (!openRowMenuId) return;
    const onDocClick = () => setOpenRowMenuId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenRowMenuId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openRowMenuId]);

  // Close the toolbar overflow menu when clicking elsewhere or pressing Escape
  useEffect(() => {
    if (!isToolbarMenuOpen) return;
    const onDocClick = () => setIsToolbarMenuOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsToolbarMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isToolbarMenuOpen]);

  const parentRecordName = (l: InsuranceSubmissionLine | null): string => {
    if (!l) return '';
    const override = movedParentOverrides[l.id];
    const pid = override !== undefined ? (override || null) : (l.parentLineId || null);
    if (!pid) return '';
    return mockSubmissionLines.find((x) => x.id === pid)?.name || '';
  };

  // Open the Create Submission Line modal. "Add Child" passes a parentId and locks the Parent
  // Record field; the toolbar "Add" passes null + lock=false so the user picks a parent (or none).
  const openCreateLine = (parentId: string | null, lockParent: boolean) => {
    setCreateLineEditId(null);
    setCreateLineParentId(parentId);
    setCreateLineParentLocked(lockParent);
    setCreateLineForm({ ...emptyCreateLineForm });
    setParentLookupQuery('');
    setParentLookupOpen(false);
    setIsCreateLineOpen(true);
  };
  // Edit mode: open the same modal pre-filled from the line's current values. The parent stays
  // user-editable (the lookup), just seeded with the line's effective parent.
  const openEditLine = (lineId: string) => {
    const l = getMergedSubmissionLine(lineId) || mockSubmissionLines.find((x) => x.id === lineId);
    if (!l) return;
    const override = movedParentOverrides[lineId];
    const parentId = override !== undefined ? (override || null) : (l.parentLineId || null);
    setCreateLineEditId(lineId);
    setCreateLineParentId(parentId);
    setCreateLineParentLocked(false);
    setCreateLineForm({
      name: l.name || '',
      lineType: l.lineType || 'Location',
      lineOfBusiness: l.lineOfBusiness || 'Property',
      status: l.status || 'Active',
      owner: l.owner || '',
      insuredValue: l.insuredValue != null ? String(l.insuredValue) : '',
      coverageLimit: l.coverageLimit != null ? String(l.coverageLimit) : '',
      deductible: l.deductible != null ? String(l.deductible) : '',
      premiumAllocation: l.premiumAllocation != null ? String(l.premiumAllocation) : '',
    });
    setParentLookupQuery('');
    setParentLookupOpen(false);
    setIsCreateLineOpen(true);
  };
  const closeCreateLine = () => {
    setIsCreateLineOpen(false);
    setCreateLineEditId(null);
    setCreateLineParentId(null);
    setCreateLineParentLocked(false);
    setCreateLineForm({ ...emptyCreateLineForm });
    setParentLookupQuery('');
    setParentLookupOpen(false);
  };

  // Editable field component

  // Shared Override Value cell — SLDS-style inline edit. Empty state shows a pencil
  // on hover; a set value renders as plain text with a clear (✕); clicking either
  // opens an input with an inline ✕. Used by the modal card rows and the tree-grid
  // Extracted Data tab so both surfaces stay identical.
  const commitOverride = (rowKey: string, raw: string, tracked = false) => {
    const v = raw.trim();
    setViewSourcesOverride((prev) => {
      if ((prev[rowKey] || '') === v) return prev;
      const before = prev[rowKey];
      if (tracked) {
        markDirty(`ov:${rowKey}`, () => setViewSourcesOverride((p) => {
          const n = { ...p };
          if (before === undefined) delete n[rowKey]; else n[rowKey] = before;
          return n;
        }));
      }
      const next = { ...prev };
      if (v) next[rowKey] = v; else delete next[rowKey];
      return next;
    });
    setViewSourcesEditingRow(null);
  };
  const clearOverride = (rowKey: string, tracked = false) => {
    setViewSourcesOverride((prev) => {
      if (prev[rowKey] === undefined) return prev;
      const before = prev[rowKey];
      if (tracked) {
        markDirty(`ov:${rowKey}`, () => setViewSourcesOverride((p) => ({ ...p, [rowKey]: before })));
      }
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
  };
  const renderOverrideCell = (rowKey: string, override: string, tracked = false) => {
    if (viewSourcesEditingRow === rowKey) {
      return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            autoFocus
            defaultValue={override}
            placeholder="Enter override value"
            onBlur={(e) => commitOverride(rowKey, e.target.value, tracked)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
              else if (e.key === 'Escape') { setViewSourcesEditingRow(null); }
            }}
            style={{ flex: 1, minWidth: 0, padding: '4px 26px 4px 6px', fontSize: '12px', border: '1px solid #0176D3', borderRadius: '4px', boxSizing: 'border-box', color: '#2e2e2e' }}
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); clearOverride(rowKey, tracked); setViewSourcesEditingRow(null); }}
            title="Clear override"
            aria-label="Clear override"
            style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#5c5c5c', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>
      );
    }
    const isHover = viewSourcesHoverRow === rowKey;
    if (override) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, width: '100%' }}>
          <span
            onClick={(e) => { e.stopPropagation(); setViewSourcesEditingRow(rowKey); }}
            title={override}
            style={{ flex: 1, cursor: 'text', color: '#2e2e2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {override}
          </span>
          {isHover && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearOverride(rowKey, tracked); }}
              title="Clear override"
              aria-label="Clear override"
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#5c5c5c', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setViewSourcesEditingRow(rowKey); }}
            title="Edit override value"
            aria-label="Edit override value"
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#0176D3', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
          </button>
        </div>
      );
    }
    return (
      <div
        onClick={(e) => { e.stopPropagation(); setViewSourcesEditingRow(rowKey); }}
        title="Add override value"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', minHeight: '22px', cursor: 'pointer', color: '#0176D3' }}
      >
        {isHover ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
        ) : (
          <span style={{ color: '#c9c9c9' }}>—</span>
        )}
      </div>
    );
  };

  return (
    <>
      {(() => {
                // Submission lines tab always shows for LOB lines
                const hideSubmissionLines = false;

                if (hideSubmissionLines) {
                  return (
                    <div style={{
                      display: 'flex',
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '48px 24px',
                      textAlign: 'center'
                    }}>
                      <div>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="#C9C9C9" style={{ marginBottom: '16px' }}>
                          <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 12H5c-.55 0-1-.45-1-1V9c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1z"/>
                        </svg>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#001e5b', margin: '0 0 8px 0' }}>
                          No Submission Lines Available
                        </h3>
                        <p style={{ fontSize: '13px', color: '#5c5c5c', margin: 0, maxWidth: '400px' }}>
                          Submission lines will be created once the initial data extraction and analysis is complete.
                        </p>
                      </div>
                    </div>
                  );
                }

                // Get Step 9 configuration for submission lines data
                const step9SubmissionConfig = (stepConfigurations as any)[9]?.submission;

                // Filter lines for this specific LOB only (not the entire submission)
                const filteredLines = mockSubmissionLines.filter(
                  l =>
                    l.insuranceSubmissionId === submissionId &&
                    (lobFilter == null ||
                      (Array.isArray(lobFilter)
                        ? l.lineOfBusiness != null && lobFilter.includes(l.lineOfBusiness)
                        : l.lineOfBusiness === lobFilter))
                );
                const baseLines = mounted ? applyLineOverrides(filteredLines) : filteredLines;

                // ── Build merged virtual lines from session-stored mergedGroups ─────
                // For each merged group: combine name (first-prefix + +others), union attributes
                // (first wins on conflicts), and create a virtual line with id "merge::<sortedIds>".
                // Source lines are then hidden and their children reparented to the combined line.
                const sourceIdToMergedId: Record<string, string> = {};
                const mergedLines: typeof baseLines = [];

                const splitName = (name: string): { prefix: string; body: string } => {
                  // Match leading "Word [Identifier]" before the first " - " separator.
                  const m = name.match(/^([^-]+?)\s+-\s+(.*)$/);
                  if (!m) return { prefix: name, body: '' };
                  return { prefix: m[1].trim(), body: m[2].trim() };
                };

                const identifierFromPrefix = (prefix: string): string => {
                  // "Location 3A" -> "3A"; "L3A-B1" -> "B1"; fall back to last token.
                  const tokens = prefix.split(/\s+/);
                  if (tokens.length > 1) return tokens[tokens.length - 1];
                  // Hyphenated like "L3A-B1" — take the last segment after the last hyphen.
                  const dashed = prefix.split('-');
                  if (dashed.length > 1) return dashed[dashed.length - 1];
                  return prefix;
                };

                const baseFromPrefix = (prefix: string): string => {
                  const tokens = prefix.split(/\s+/);
                  if (tokens.length > 1) return tokens.slice(0, -1).join(' ');
                  const dashed = prefix.split('-');
                  if (dashed.length > 1) return dashed.slice(0, -1).join('-');
                  return prefix;
                };

                const parseAttrPairs = (attrs: string | null | undefined): Array<{ key: string; value: string }> => {
                  if (!attrs) return [];
                  return attrs.split(',').map((pair) => {
                    const idx = pair.indexOf(':');
                    if (idx === -1) return { key: pair.trim(), value: '' };
                    return { key: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
                  });
                };

                Object.entries(mergedGroups).forEach(([mergedKey, sourceIds]) => {
                  const sources = sourceIds
                    .map((sid) => baseLines.find((l) => l.id === sid))
                    .filter((l): l is typeof baseLines[number] => !!l);
                  if (sources.length < 2) return;

                  // Build combined name
                  const parts = sources.map((s) => splitName(s.name));
                  const firstPrefix = parts[0].prefix;
                  const base = baseFromPrefix(firstPrefix);
                  const ids = parts.map((p) => identifierFromPrefix(p.prefix));
                  const combinedPrefix = base ? `${base} ${ids.join('+')}` : ids.join('+');
                  const combinedBody = parts[0].body;
                  const combinedName = combinedBody ? `${combinedPrefix} - ${combinedBody}` : combinedPrefix;

                  // Union attributes (first source wins on conflicting keys)
                  const seen = new Set<string>();
                  const combinedPairs: Array<{ key: string; value: string }> = [];
                  sources.forEach((s) => {
                    parseAttrPairs(s.lineAttributes).forEach((p) => {
                      if (!seen.has(p.key)) {
                        seen.add(p.key);
                        combinedPairs.push(p);
                      }
                    });
                  });
                  const combinedAttrs = combinedPairs.map((p) => `${p.key}: ${p.value}`).join(', ');

                  // Combined record: take first non-null for scalar fields
                  const pickFirst = <K extends keyof typeof sources[number]>(key: K) =>
                    sources.find((s) => s[key] != null && s[key] !== '')?.[key] ?? sources[0][key];

                  const mergedId = `merge::${mergedKey}`;
                  const combined = {
                    ...sources[0],
                    id: mergedId,
                    name: combinedName,
                    lineAttributes: combinedAttrs,
                    coverageLimit: pickFirst('coverageLimit'),
                    deductible: pickFirst('deductible'),
                    premiumAllocation: pickFirst('premiumAllocation'),
                    insuredValue: pickFirst('insuredValue'),
                    sublimit: pickFirst('sublimit'),
                  };

                  mergedLines.push(combined);
                  sourceIds.forEach((sid) => { sourceIdToMergedId[sid] = mergedId; });
                });

                const submissionLines = [
                  ...baseLines.filter((l) => !sourceIdToMergedId[l.id]),
                  ...mergedLines,
                ].filter((l) => !deletedLineIds.has(l.id));

                const effectiveParentId = (lineId: string): string | null => {
                  if (movedParentOverrides[lineId] !== undefined) return movedParentOverrides[lineId] || null;
                  // Look up in the post-merge view first, then fall back to base lines so
                  // already-merged source ids still resolve a parent (used by breadcrumb /
                  // bulk-move target validation).
                  const line = submissionLines.find((l) => l.id === lineId) || baseLines.find((l) => l.id === lineId);
                  if (!line) return null;
                  if (line.parentLineId && sourceIdToMergedId[line.parentLineId]) {
                    return sourceIdToMergedId[line.parentLineId];
                  }
                  return line.parentLineId || null;
                };
                const rootLines = submissionLines.filter((line) => !effectiveParentId(line.id));

                // Left-tree search — when a query is present, show only matching nodes plus the
                // lineage (ancestors) leading to them. Ancestors are force-expanded so matches show.
                const treeQuery = treeSearch.trim().toLowerCase();
                const treeVisibleIds: Set<string> | null = (() => {
                  if (!treeQuery) return null;
                  const visible = new Set<string>();
                  submissionLines.forEach((l) => {
                    if (!l.name.toLowerCase().includes(treeQuery)) return;
                    visible.add(l.id);
                    let pid = effectiveParentId(l.id);
                    const seen = new Set<string>();
                    while (pid && !seen.has(pid)) {
                      seen.add(pid);
                      visible.add(pid);
                      pid = effectiveParentId(pid);
                    }
                  });
                  return visible;
                })();

                // At Pricing & Quoting (line step 4) every discrepancy is considered resolved:
                // no tree warning icons, empty reconcile queue, no duplicate/resolution cards.
                const allResolved = lineStep >= 4;

                // Discrepancy flags — drives warning icon next to tree nodes and value rows
                const lineDiscrepancies: Record<string, string[]> = step9SubmissionConfig?.submissionLineDiscrepancies || {};
                const hasLineWarning = (lineId: string) =>
                  !allResolved &&
                  Array.isArray(lineDiscrepancies[lineId]) &&
                  lineDiscrepancies[lineId].length > 0 &&
                  !reconcileResolvedLines.has(lineId);
                const isAttrFlagged = (lineId: string, attrKey: string) =>
                  Array.isArray(lineDiscrepancies[lineId]) && lineDiscrepancies[lineId].some((k) => k.toLowerCase() === attrKey.toLowerCase());

                // Map of line id → attribute key → list of candidate sources.
                // Enrichment-lifecycle gate: through steps 1–3 strip every enrichment-API candidate
                // (Verisk, ISO, …) so no extracted attribute value from an external service is visible
                // in the pool/tree/modal; only at step 4 (Pricing & Quoting) do they appear. Doc/email
                // candidates are untouched.
                const rawSourcesByLine: Record<string, Record<string, Array<{ field: string; value: string; source: string; updated?: boolean }>>> =
                  step9SubmissionConfig?.submissionLineAttributeSources || {};
                const sourcesByLine: Record<string, Record<string, Array<{ field: string; value: string; source: string; updated?: boolean }>>> =
                  lineStep >= 4
                    ? rawSourcesByLine
                    : Object.fromEntries(
                        Object.entries(rawSourcesByLine).map(([lineId, attrs]) => [
                          lineId,
                          Object.fromEntries(
                            Object.entries(attrs)
                              .map(([attrKey, cands]) => [attrKey, cands.filter((c) => !isEnrichmentSourceName(c.source))])
                              .filter(([, cands]) => (cands as unknown[]).length > 0)
                          ),
                        ])
                      );
                // Attribute keys ("lineId::attrKey") whose candidates come *only* from enrichment APIs.
                // These stay absent through steps 1–3; both the candidates and their canonical mapping
                // apply only at step 4.
                const enrichmentOnlyKeys = new Set<string>();
                Object.entries(rawSourcesByLine).forEach(([lineId, attrs]) => {
                  Object.entries(attrs).forEach(([attrKey, cands]) => {
                    if (cands.length > 0 && cands.every((c) => isEnrichmentSourceName(c.source))) {
                      enrichmentOnlyKeys.add(`${lineId}::${attrKey}`);
                    }
                  });
                });
                // Step-aware canonical mappings: enrichment-only attributes (Verisk, ISO, …) stay
                // unmapped until step 4, where they arrive in the pool and map to their canonical term.
                // All other attributes (ACORD forms, broker email) are mapped from step 1.
                const effectiveCanonicalMappings: Record<string, string | null> =
                  lineStep >= 4
                    ? canonicalTermMappings
                    : Object.fromEntries(
                        Object.entries(canonicalTermMappings).filter(([key]) => !enrichmentOnlyKeys.has(key))
                      );
                const defaultSourceFor = (lob: string | null | undefined): string => {
                  if (lob === 'Property' || lob === 'Shared Locations') return 'ACORD 140';
                  if (lob === 'General Liability') return 'ACORD 126';
                  if (lob === 'Parties') return 'ACORD 125';
                  return 'Submission';
                };
                // Distinct extraction sources seen on a line (falls back to the LOB default doc).
                const buildLineSources = (lineId: string, lob: string | null | undefined): string[] => {
                  const ls = sourcesByLine[lineId] || {};
                  const seen: string[] = [];
                  Object.values(ls).forEach((cands) => cands.forEach((c) => {
                    if (c.source && !seen.includes(c.source)) seen.push(c.source);
                  }));
                  if (seen.length === 0) seen.push(defaultSourceFor(lob));
                  return seen;
                };

                // Map of line id → potential duplicate line id (for sibling-level duplicates only)
                const potentialDuplicates: Record<string, string> = step9SubmissionConfig?.submissionLinePotentialDuplicates || {};
                const groupIdsFor = (lineId: string): string[] => {
                  const seen = new Set<string>();
                  const queue = [lineId];
                  while (queue.length) {
                    const cur = queue.shift()!;
                    if (seen.has(cur)) continue;
                    seen.add(cur);
                    const partner = potentialDuplicates[cur];
                    if (partner && !seen.has(partner)) queue.push(partner);
                  }
                  return Array.from(seen);
                };
                const isDuplicateGroupCleared = (lineId: string): boolean => {
                  const ids = groupIdsFor(lineId);
                  if (ids.length < 2) return false;
                  const key = [...ids].sort().join('|');
                  const r = duplicateResolutions[key];
                  return r === 'merged' || r === 'not-merged';
                };
                const hasPotentialDuplicate = (lineId: string) =>
                  !!potentialDuplicates[lineId] && !isDuplicateGroupCleared(lineId);
                const getPotentialDuplicateLine = (lineId: string) => {
                  const dupId = potentialDuplicates[lineId];
                  if (!dupId) return null;
                  return submissionLines.find((l) => l.id === dupId) || null;
                };

                // Core canonical terms — the small, curated set that participates in discrepancy
                // detection and duplicate reconciliation. Kept deliberately narrow: only these terms
                // are treated as "must be mapped", so the reconcile queue stays focused. The broader,
                // category-grouped model below (getCanonicalTermCategories) is a superset used for
                // display and mapping targets.
                const getCoreCanonicalTerms = (
                  lobRaw: string | null | undefined,
                  lineType?: string | null
                ): string[] => {
                  // Shared Locations reuses the Property canonical model (all lines are Locations).
                  const lob = lobRaw === 'Shared Locations' ? 'Property' : lobRaw;
                  if (lob === 'Property') {
                    if (lineType === 'LOB') {
                      return ['Coverage Limit', 'Deductible', 'Total Insured Value', 'Policy Form', 'Cause of Loss', 'Valuation', 'Coinsurance'];
                    }
                    if (lineType === 'Location') {
                      return ['Street Address', 'City', 'State', 'ZIP Code', 'Country', 'Sprinkler System', 'Fire Alarm', 'Security', 'Protection Class'];
                    }
                    if (lineType === 'Building') {
                      return ['Building Name', 'Construction Type', 'Year Built', 'Square Footage', 'Number of Stories', 'Occupancy Type', 'Roof Type', 'Roof Age', 'Building Value'];
                    }
                    if (lineType === 'Equipment / Contents') {
                      return ['Equipment Coverage', 'Equipment Type', 'Equipment Valuation', 'Breakdown Coverage', 'Contents Value', 'Business Income'];
                    }
                    if (lineType === 'Coverage') {
                      return ['Coverage Limit', 'Deductible', 'Sublimit', 'Cause of Loss', 'Valuation'];
                    }
                    return [
                      'Street Address', 'City', 'State', 'ZIP Code',
                      'Building Name', 'Construction Type', 'Year Built', 'Square Footage', 'Number of Stories',
                      'Occupancy Type', 'Protection Class', 'Sprinkler System', 'Fire Alarm',
                      'Building Value', 'Contents Value', 'Business Income',
                      'Coverage Limit', 'Deductible', 'Roof Type', 'Roof Age',
                      'Equipment Coverage', 'Equipment Type', 'Equipment Valuation', 'Breakdown Coverage',
                    ];
                  }

                  if (lob === 'General Liability') {
                    if (lineType === 'LOB') {
                      return ['Coverage Limit', 'Aggregate Limit', 'Deductible', 'Premium Basis', 'Classification Code', 'Operations Description'];
                    }
                    if (lineType === 'Location') {
                      return ['Street Address', 'City', 'State', 'ZIP Code', 'Facility Type', 'Square Footage', 'Number of Employees', 'Annual Visitors'];
                    }
                    if (lineType === 'Coverage') {
                      return ['Coverage Limit', 'Aggregate Limit', 'Deductible', 'Coverage Form', 'Premium Basis'];
                    }
                    return [
                      'Business Name', 'Business Description', 'Annual Revenue', 'Number of Employees', 'Years in Business',
                      'Street Address', 'City', 'State', 'ZIP Code',
                      'Classification Code', 'Operations Description', 'Products Sold',
                      'Coverage Limit', 'Aggregate Limit', 'Deductible', 'Prior Claims',
                    ];
                  }

                  if (lob === 'Commercial Auto') {
                    if (lineType === 'Vehicle') {
                      return ['Vehicle VIN', 'Vehicle Make', 'Vehicle Model', 'Vehicle Year', 'Vehicle Type', 'Garaging Address', 'Garaging City', 'Garaging State', 'Garaging ZIP'];
                    }
                    if (lineType === 'Driver') {
                      return ['Driver Name', 'Driver License', 'Driver DOB'];
                    }
                    if (lineType === 'Coverage' || lineType === 'LOB') {
                      return ['Coverage Type', 'Coverage Limit', 'Deductible'];
                    }
                    return [
                      'Vehicle VIN', 'Vehicle Make', 'Vehicle Model', 'Vehicle Year', 'Vehicle Type',
                      'Garaging Address', 'Garaging City', 'Garaging State', 'Garaging ZIP',
                      'Driver Name', 'Driver License', 'Driver DOB',
                      'Coverage Type', 'Coverage Limit', 'Deductible',
                    ];
                  }

                  if (lob === 'Parties') {
                    if (lineType === 'Account') {
                      return [
                        'Account Name', 'Account Type', 'DBA', 'Legal Entity Type', 'Tax ID', 'DUNS Number',
                        'Industry', 'SIC Code', 'NAICS Code', 'Website',
                        'Billing Street', 'Billing City', 'Billing State', 'Billing ZIP', 'Phone',
                        'Annual Revenue', 'Number of Employees', 'Year Established',
                      ];
                    }
                    if (lineType === 'Contact') {
                      return [
                        'First Name', 'Last Name', 'Title', 'Contact Role', 'Email', 'Phone', 'Mobile',
                        'Mailing Street', 'Mailing City', 'Mailing State', 'Mailing ZIP', 'Preferred Contact Method',
                      ];
                    }
                    return [
                      'Account Name', 'Account Type', 'Tax ID', 'Industry', 'Website',
                      'Billing Street', 'Billing City', 'Billing State', 'Billing ZIP',
                      'First Name', 'Last Name', 'Title', 'Email', 'Phone',
                    ];
                  }

                  return ['Street Address', 'City', 'State', 'ZIP Code', 'Coverage Limit', 'Deductible'];
                };

                // Comprehensive, category-grouped canonical model. The category names mirror the
                // Enrichment tab's Commercial Property categories so a term lands in the same section
                // whether it arrives from a document or an enrichment API. A lot of enriched attributes
                // live in the data model here even when a given submission has no value for them yet.
                // Property/Location gets the full model; everything else wraps its core terms in one
                // generic "Attributes" section so the grouped render is uniform across line types.
                type CanonicalCategory = { category: string; terms: string[] };
                const getCanonicalTermCategories = (
                  lobRaw: string | null | undefined,
                  lineType?: string | null
                ): CanonicalCategory[] => {
                  // Shared Locations reuses the Property canonical model (all lines are Locations).
                  const lob = lobRaw === 'Shared Locations' ? 'Property' : lobRaw;
                  if (lob === 'Property' && lineType === 'Location') {
                    return [
                      {
                        category: 'Property Characteristics',
                        terms: [
                          'Construction Type', 'Year Built', 'Square Footage', 'Number of Stories',
                          'Basement Type', 'Roof Type', 'Roof Covering', 'Roof Age', 'Roof Condition',
                          'Building Condition', 'Wiring Type', 'Electrical Update Year', 'Plumbing Type',
                          'Heating System', 'HVAC Age', 'Exterior Wall Material', 'Foundation Type',
                        ],
                      },
                      {
                        category: 'Location & CAT Exposure',
                        terms: [
                          'Street Address', 'City', 'State', 'ZIP Code', 'Country', 'Latitude', 'Longitude',
                          'FEMA Flood Zone', 'Flood Zone Panel', 'Base Flood Elevation', 'Distance to Coast',
                          'Distance to Water Body', 'Earthquake Zone', 'Peak Ground Acceleration',
                          'Soil Liquefaction Risk', 'Wildfire Hazard Zone', 'Wildfire Risk Score',
                          'Distance to Fire Station', 'Tornado Risk Zone', 'Hurricane Wind Zone',
                          'Hail Risk Zone', 'Windstorm Deductible Required',
                        ],
                      },
                      {
                        category: 'Fire Protection & Response',
                        terms: [
                          'Protection Class', 'Fire Hydrant Distance', 'Hydrants within 1000 ft',
                          'Water Supply Type', 'Water Supply Capacity', 'Fire Department Type',
                          'Fire Station Response Time', 'Sprinkler System', 'Sprinkler Type',
                          'Sprinkler Coverage', 'Sprinkler Install Date', 'Sprinkler Last Inspection',
                          'Fire Alarm', 'Fire Alarm Monitoring', 'Smoke Detection', 'Fire Extinguishers',
                          'Kitchen Fire Suppression', 'Emergency Exit Lighting',
                        ],
                      },
                      {
                        category: 'Occupancy & Operations',
                        terms: [
                          'Occupancy Type', 'Operations Description', 'ISO Classification Code',
                          'Office Percentage', 'Manufacturing Percentage', 'Warehouse Percentage',
                          'Combustible Loading', 'Hazardous Materials', 'Hazmat Description',
                          'Maximum Storage Height', 'Hours of Operation', 'Number of Shifts',
                          'Security', 'Burglar Alarm', 'Security Cameras',
                        ],
                      },
                      {
                        category: 'Claims History',
                        terms: [
                          'Claim Count (5yr)', 'Total Incurred Losses (5yr)', 'Fire Claim Count',
                          'Water Damage Claim Count', 'Theft Claim Count', 'Wind/Hail Claim Count',
                          'Largest Claim Amount', 'Most Recent Claim Date', 'Claim Frequency',
                          'Claim Severity', 'Open Claims Count', 'Subrogation Recoveries',
                        ],
                      },
                      {
                        category: 'Valuation & Insurance-to-Value',
                        terms: [
                          'Building Replacement Cost', 'Contents Replacement Cost', 'Business Income Value',
                          'Business Income Indemnity Period', 'Extra Expense Value', 'Total Insured Value',
                          'Building Insurance Amount', 'Contents Insurance Amount',
                          'Insurance-to-Value Ratio', 'Coinsurance',
                        ],
                      },
                      {
                        category: 'Building Code & Compliance',
                        terms: [
                          'Building Code Year', 'ADA Compliance', 'Asbestos Present', 'Lead Paint Present',
                          'Underground Storage Tanks', 'Radon Mitigation', 'Fire Code Compliance',
                          'Occupancy Permit Current', 'Building Violations', 'Recent Renovations',
                        ],
                      },
                    ];
                  }
                  if (lob === 'Parties' && lineType === 'Account') {
                    return [
                      {
                        category: 'Account Identity',
                        terms: ['Account Name', 'Account Type', 'DBA', 'Legal Entity Type', 'Tax ID', 'DUNS Number'],
                      },
                      {
                        category: 'Business Profile',
                        terms: ['Industry', 'SIC Code', 'NAICS Code', 'Website', 'Annual Revenue', 'Number of Employees', 'Year Established'],
                      },
                      {
                        category: 'Address & Contact',
                        terms: ['Billing Street', 'Billing City', 'Billing State', 'Billing ZIP', 'Phone'],
                      },
                    ];
                  }
                  if (lob === 'Parties' && lineType === 'Contact') {
                    return [
                      {
                        category: 'Contact Identity',
                        terms: ['First Name', 'Last Name', 'Title', 'Contact Role'],
                      },
                      {
                        category: 'Contact Details',
                        terms: ['Email', 'Phone', 'Mobile', 'Preferred Contact Method'],
                      },
                      {
                        category: 'Mailing Address',
                        terms: ['Mailing Street', 'Mailing City', 'Mailing State', 'Mailing ZIP'],
                      },
                    ];
                  }
                  // Everything else: one generic section holding the core terms.
                  return [{ category: 'Attributes', terms: getCoreCanonicalTerms(lob, lineType) }];
                };

                // The full flat term list — union of every category's terms plus the core terms
                // (so a core term is always present even if it lives outside the grouped model).
                const getCanonicalTermOptions = (
                  lob: string | null | undefined,
                  lineType?: string | null
                ): string[] => {
                  const out: string[] = [];
                  const seen = new Set<string>();
                  const push = (t: string) => { if (!seen.has(t)) { seen.add(t); out.push(t); } };
                  getCanonicalTermCategories(lob, lineType).forEach((c) => c.terms.forEach(push));
                  getCoreCanonicalTerms(lob, lineType).forEach(push);
                  return out;
                };
                // The category a canonical term belongs to (for grouped rendering); '' if none.
                const getCanonicalTermCategoryMap = (
                  lob: string | null | undefined,
                  lineType?: string | null
                ): Record<string, string> => {
                  const map: Record<string, string> = {};
                  getCanonicalTermCategories(lob, lineType).forEach((c) => {
                    c.terms.forEach((t) => { if (!(t in map)) map[t] = c.category; });
                  });
                  return map;
                };
                // Group an ordered term list into its canonical categories, preserving the incoming
                // term order within each section. Terms outside the model land under "Other Attributes".
                // Empty categories are retained so the section still renders (collapsed by default).
                const OTHER_CATEGORY = 'Other Attributes';
                const groupTermsByCategory = (
                  lob: string | null | undefined,
                  lineType: string | null | undefined,
                  termOrder: string[]
                ): Array<{ category: string; terms: string[] }> => {
                  const catMap = getCanonicalTermCategoryMap(lob, lineType);
                  const cats = getCanonicalTermCategories(lob, lineType);
                  const sections: Array<{ category: string; terms: string[] }> = cats.map((c) => ({ category: c.category, terms: [] }));
                  const byName: Record<string, { category: string; terms: string[] }> = {};
                  sections.forEach((s) => { byName[s.category] = s; });
                  let other: { category: string; terms: string[] } | null = null;
                  termOrder.forEach((term) => {
                    const cat = catMap[term];
                    if (cat && byName[cat]) { byName[cat].terms.push(term); return; }
                    if (!other) { other = { category: OTHER_CATEGORY, terms: [] }; sections.push(other); }
                    other.terms.push(term);
                  });
                  return sections;
                };
                // Whether a canonical category section is expanded: data-bearing sections default open,
                // empty ones default closed; the user's explicit toggle (opened/closed sets) wins.
                const isCanonicalCatOpen = (category: string, hasData: boolean): boolean => {
                  if (canonicalCatOpened.has(category)) return true;
                  if (canonicalCatClosed.has(category)) return false;
                  return hasData;
                };
                const toggleCanonicalCat = (category: string, currentlyOpen: boolean) => {
                  if (currentlyOpen) {
                    setCanonicalCatClosed((prev) => { const n = new Set(prev); n.add(category); return n; });
                    setCanonicalCatOpened((prev) => { const n = new Set(prev); n.delete(category); return n; });
                  } else {
                    setCanonicalCatOpened((prev) => { const n = new Set(prev); n.add(category); return n; });
                    setCanonicalCatClosed((prev) => { const n = new Set(prev); n.delete(category); return n; });
                  }
                };

                // Default to expanded: `expandedNodes` is treated as a *collapsed* set, so a node is
                // expanded unless the user has explicitly toggled it closed.
                const isNodeExpanded = (lineId: string) => !expandedNodes.has(lineId);

                // Panel is only open when the user explicitly clicks a Line Name
                const activeLineId = selectedSubmissionLineId && submissionLines.some((l) => l.id === selectedSubmissionLineId)
                  ? selectedSubmissionLineId
                  : null;
                // Panel content follows `panelLineId`, which lingers on the closing line through the
                // slide-out animation (activeLineId — the live selection — clears immediately so the
                // tree-row highlight releases the moment the user closes the panel).
                const activeLine = submissionLines.find((l) => l.id === (panelLineId ?? activeLineId)) || null;
                const isPanelOpen = !!activeLine;
                const formatCurrency = (n: number | null | undefined) =>
                  n == null ? '—' : `$${Number(n).toLocaleString()}`;

                const toggleNode = (nodeId: string) => {
                  setExpandedNodes((prev) => {
                    const seed = new Set(prev);
                    if (seed.has(nodeId)) seed.delete(nodeId);
                    else seed.add(nodeId);
                    return seed;
                  });
                };

                const parseAttributesRaw = (attrs: string | null | undefined): Array<{ key: string; value: string }> => {
                  if (!attrs) return [];
                  return attrs.split(',').map((pair) => {
                    const idx = pair.indexOf(':');
                    if (idx === -1) return { key: pair.trim(), value: '' };
                    return { key: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
                  });
                };
                // Through steps 1–3 an attribute that is populated *only* by an enrichment API isn't
                // available yet, so drop it from the parsed attribute list; it appears at step 4.
                const parseAttributes = (attrs: string | null | undefined, lineId?: string): Array<{ key: string; value: string }> => {
                  const parsed = parseAttributesRaw(attrs);
                  if (lineStep >= 4 || !lineId) return parsed;
                  return parsed.filter((a) => !enrichmentOnlyKeys.has(`${lineId}::${a.key}`));
                };

                // Compute duplicate groups, bucketed by line type. Each group is a set of
                // ids that are mutually flagged as potential duplicates.
                const computeDuplicateGroups = (): Record<string, string[][]> => {
                  const visited = new Set<string>();
                  const buckets: Record<string, string[][]> = {
                    'Location': [],
                    'Building': [],
                    'Equipment / Contents': [],
                  };
                  Object.keys(potentialDuplicates).forEach((id) => {
                    if (visited.has(id)) return;
                    const queue = [id];
                    const group: string[] = [];
                    while (queue.length) {
                      const cur = queue.shift()!;
                      if (visited.has(cur)) continue;
                      visited.add(cur);
                      group.push(cur);
                      const partner = potentialDuplicates[cur];
                      if (partner && !visited.has(partner)) queue.push(partner);
                    }
                    if (group.length < 2) return;
                    // Look up against baseLines so already-merged sources still resolve to a bucket.
                    const firstLine = baseLines.find((l) => l.id === group[0]);
                    if (!firstLine) return;
                    const bucketKey = firstLine.lineType;
                    if (buckets[bucketKey]) buckets[bucketKey].push(group);
                  });
                  return buckets;
                };
                const duplicateGroups = computeDuplicateGroups();
                const totalDuplicateGroups =
                  duplicateGroups['Location'].length +
                  duplicateGroups['Building'].length +
                  duplicateGroups['Equipment / Contents'].length;
                const resolutionKeyFor = (group: string[]) => [...group].sort().join('|');
                const isGroupResolved = (group: string[]) => {
                  const r = duplicateResolutions[resolutionKeyFor(group)];
                  return r === 'merged' || r === 'not-merged';
                };
                const resolvedGroupCount =
                  Object.values(duplicateGroups)
                    .flat()
                    .filter(isGroupResolved).length;

                // Pool-model discrepancy detector for a single line. Mirrors the View Sources modal's
                // pool computation so the reconcile queue and the modal agree on what's unresolved.
                // Three discrepancy kinds:
                //  - unmappedTerms: catalog canonical terms with no mapped extraction and no manual value.
                //  - unresolvedSource: a term with 2+ mapped candidates and no explicit preferred pick.
                //  - lowConfidence: a term whose preferred item has confidence < threshold and no override.
                type LineDiscState = { unmappedTerms: string[]; unresolvedSource: string[]; lowConfidence: string[]; hasAny: boolean };
                const lineDiscrepancyState = (lineId: string): LineDiscState => {
                  if (allResolved) return { unmappedTerms: [], unresolvedSource: [], lowConfidence: [], hasAny: false };
                  const rec = submissionLines.find((l) => l.id === lineId);
                  if (!rec) return { unmappedTerms: [], unresolvedSource: [], lowConfidence: [], hasAny: false };
                  const ls = sourcesByLine[lineId] || {};
                  const attrs = parseAttributes(rec.lineAttributes, lineId);
                  // Discrepancy detection runs against the core (curated) term set only, so the
                  // comprehensive enriched model doesn't flood the queue with unmapped-term noise.
                  const catalog = getCoreCanonicalTerms(rec.lineOfBusiness, rec.lineType);
                  // Flatten every extraction candidate into a pool item, then resolve its canonical term.
                  type PI = { attrKey: string; candidateIdx: number; value: string; source: string; confidence: number; override: string };
                  const items: PI[] = [];
                  attrs.forEach((attr) => {
                    const cands = ls[attr.key] || [];
                    const editKey = `${lineId}::${attr.key}`;
                    const edited = submissionLineEdits[editKey];
                    const flagged = isAttrFlagged(lineId, attr.key);
                    const selIdx = submissionLineSourceIdx[editKey] ?? (flagged && cands.length > 1 ? -1 : 0);
                    const list = cands.length > 0
                      ? cands
                      : [{ field: attr.key, value: edited ? edited.value : attr.value, source: edited ? 'Manually edited' : defaultSourceFor(rec.lineOfBusiness) }];
                    list.forEach((cand, i) => {
                      const override = viewSourcesOverride[`${lineId}::${attr.key}::${i}`] || '';
                      items.push({ attrKey: attr.key, candidateIdx: i, value: cand.value, source: cand.source, confidence: confidenceFor(lineId, attr.key, cand.value, cand.source), override });
                    });
                    void selIdx;
                  });
                  const rowTerm = (attrKey: string, candidateIdx: number): string => {
                    const rowKey = `${lineId}::${attrKey}::${candidateIdx}`;
                    if (rowKey in viewSourcesRowMap) return viewSourcesRowMap[rowKey];
                    const editKey = `${lineId}::${attrKey}`;
                    const selIdx = Math.max(0, submissionLineSourceIdx[editKey] ?? 0);
                    if (candidateIdx === selIdx) return effectiveCanonicalMappings[editKey] || '';
                    return '';
                  };
                  const byTerm = new Map<string, PI[]>();
                  items.forEach((it) => {
                    const terms: string[] = [];
                    const primary = rowTerm(it.attrKey, it.candidateIdx);
                    if (primary) terms.push(primary);
                    (viewSourcesExtraTerms[`${lineId}::${it.attrKey}::${it.candidateIdx}`] || []).forEach((t) => {
                      if (t && !terms.includes(t)) terms.push(t);
                    });
                    terms.forEach((t) => {
                      if (!byTerm.has(t)) byTerm.set(t, []);
                      byTerm.get(t)!.push(it);
                    });
                  });
                  const unmappedTerms: string[] = [];
                  const unresolvedSource: string[] = [];
                  const lowConfidence: string[] = [];
                  catalog.forEach((term) => {
                    const group = byTerm.get(term) || [];
                    const manualVal = viewSourcesTermManual[`${lineId}::${term}`] || '';
                    const pref = viewSourcesTermPref[`${lineId}::${term}`];
                    // Unmapped: no mapped extraction and no manual value.
                    if (group.length === 0 && !manualVal) { unmappedTerms.push(term); return; }
                    // Manual value resolves the term outright.
                    if (pref === '__manual__' && manualVal) return;
                    // Unable to resolve source: 2+ candidates and no explicit pick.
                    const explicitPicked = pref && group.some((it) => `${it.attrKey}::${it.candidateIdx}` === pref);
                    if (group.length >= 2 && !explicitPicked) { unresolvedSource.push(term); return; }
                    // Low confidence: the preferred item scores below threshold and has no override.
                    const preferred = explicitPicked
                      ? group.find((it) => `${it.attrKey}::${it.candidateIdx}` === pref)!
                      : group[0];
                    if (preferred && !preferred.override && preferred.confidence < CONFIDENCE_THRESHOLD) {
                      lowConfidence.push(term);
                    }
                  });
                  const hasAny = unmappedTerms.length > 0 || unresolvedSource.length > 0 || lowConfidence.length > 0;
                  return { unmappedTerms, unresolvedSource, lowConfidence, hasAny };
                };
                // The reconcile queue: lines with any live discrepancy that haven't been marked resolved.
                const reconcileQueueIds = submissionLines
                  .filter((l) => !reconcileResolvedLines.has(l.id) && lineDiscrepancyState(l.id).hasAny)
                  .map((l) => l.id);
                const unresolvedDiscrepancyCount = reconcileQueueIds.length;
                const unresolvedDuplicateCount = allResolved ? 0 : totalDuplicateGroups - resolvedGroupCount;
                const crossLobAffectedLineIds = Object.keys(crossLobDiscrepancies).filter((id) =>
                  submissionLines.some((l) => l.id === id) && !crossLobResolvedLines.has(id)
                );
                const unresolvedCrossLobCount = crossLobAffectedLineIds.length;
                const showReconcileCard = showResolutionCards && unresolvedDiscrepancyCount > 0;
                const showResolveDuplicatesCard = showResolutionCards && unresolvedDuplicateCount > 0;
                // Cross-LOB discrepancy card is intentionally hidden in the LOB submission-line view
                // (code retained). Was: showResolutionCards && unresolvedCrossLobCount > 0.
                const showCrossLobCard = false;

                // For Commercial Property, default the reconcile modal to Location 1 - Chicago Warehouse
                // when it's in the queue; otherwise fall back to the first queued/available line.
                const CHICAGO_WAREHOUSE_ID = 'a01SB00001p8B6rYAE';
                const defaultReconcileId = reconcileQueueIds.includes(CHICAGO_WAREHOUSE_ID)
                  ? CHICAGO_WAREHOUSE_ID
                  : (reconcileQueueIds[0] || submissionLines[0]?.id);

                // Ref-bridge for the Underwriter Assistant's ?resolve= deep links (see the effect above).
                openReconcileRef.current = () => {
                  const firstId = defaultReconcileId;
                  if (!firstId) return;
                  const rec = submissionLines.find((l) => l.id === firstId)!;
                  setViewSourcesTab('discrepancies');
                  setViewSourcesActiveRow(null);
                  setViewSourcesUnmappedAttr(null);
                  setViewSourcesMappedGroup(null);
                  setLineSourceViewer({ lineId: firstId, sources: buildLineSources(firstId, rec.lineOfBusiness), activeIdx: 0, mode: 'reconcile' });
                };
                openDuplicatesRef.current = () => {
                  const startCategory: 'Location' | 'Building' | 'Equipment / Contents' =
                    duplicateGroups['Location'].length > 0
                      ? 'Location'
                      : duplicateGroups['Building'].length > 0
                        ? 'Building'
                        : 'Equipment / Contents';
                  setDuplicateCategory(startCategory);
                  setComparisonIdx(0);
                  setIsResolveDuplicatesOpen(true);
                  const firstGroup = duplicateGroups[startCategory][0] || [];
                  const initSel: Record<string, boolean> = {};
                  firstGroup.forEach((lid) => { initSel[lid] = true; });
                  setDuplicateSelections(initSel);
                };

                const renderTreeNode = (line: typeof submissionLines[0], level: number = 0): React.ReactNode => {
                  if (treeVisibleIds && !treeVisibleIds.has(line.id)) return null;
                  const children = submissionLines.filter(
                    (l) => effectiveParentId(l.id) === line.id && (!treeVisibleIds || treeVisibleIds.has(l.id))
                  );
                  const hasChildren = children.length > 0;
                  // While searching, force ancestors open so matches are reachable.
                  const isExpanded = treeVisibleIds ? true : isNodeExpanded(line.id);
                  const isSelected = activeLineId === line.id;
                  const showWarn = hasLineWarning(line.id);
                  const showDuplicate = hasPotentialDuplicate(line.id);
                  // When the panel is open, collapse the grid to Name + Actions columns
                  const gridTemplate = isPanelOpen
                    ? 'minmax(240px, 1fr) 40px'
                    : 'repeat(4, minmax(0, 1fr)) 40px';

                  return (
                    <React.Fragment key={line.id}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: gridTemplate,
                          alignItems: 'stretch',
                          borderBottom: '1px solid #f3f3f3',
                          backgroundColor: isSelected ? '#e8f1fb' : 'transparent',
                          fontSize: '13px',
                          lineHeight: '18px',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#f3f7fb';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {/* Name column */}
                        <div
                          onClick={() => guardNav(() => setSelectedSubmissionLineId(line.id))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 8px',
                            paddingLeft: `${8 + level * 16}px`,
                            cursor: 'pointer',
                            borderLeft: isSelected ? '3px solid #0176D3' : '3px solid transparent',
                            color: isSelected ? '#001e5b' : '#0176D3',
                            fontWeight: isSelected ? 600 : (level === 0 ? 600 : 400),
                            minWidth: 0,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={treeSelectedIds.has(line.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              setTreeSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(line.id)) next.delete(line.id);
                                else next.add(line.id);
                                return next;
                              });
                            }}
                            style={{ flexShrink: 0, margin: 0, cursor: 'pointer' }}
                          />
                          {hasChildren ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleNode(line.id); }}
                              style={{
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '14px',
                                height: '14px',
                                color: '#0176D3',
                                flexShrink: 0,
                              }}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                style={{
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.15s',
                                }}
                              >
                                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                              </svg>
                            </button>
                          ) : (
                            <span style={{ width: '14px', flexShrink: 0 }} />
                          )}
                          {showDuplicate && (
                            <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" aria-label="Potential duplicate">
                                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                              </svg>
                            </span>
                          )}
                          {showWarn && (
                            <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" aria-label="Has discrepancies">
                                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                              </svg>
                            </span>
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {line.name}
                          </span>
                        </div>

                        {!isPanelOpen && (
                          <>
                            <div style={{ padding: '6px 12px', color: '#2e2e2e', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {line.lineType}
                            </div>
                            <div style={{ padding: '6px 12px', color: '#2e2e2e', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {formatCurrency(line.insuredValue)}
                            </div>
                            <div style={{ padding: '6px 12px', color: '#2e2e2e', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {formatCurrency(line.coverageLimit)}
                            </div>
                          </>
                        )}
                        {/* Row actions */}
                        <div
                          style={{ position: 'relative', padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenRowMenuId((cur) => (cur === line.id ? null : line.id));
                            }}
                            aria-haspopup="menu"
                            aria-expanded={openRowMenuId === line.id}
                            title="Show actions"
                            className="slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small"
                            style={{ width: '24px', height: '24px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', border: '1px solid #c9c9c9', borderRadius: '4px' }}
                          >
                            <Icon
                              category="utility"
                              name="down"
                              size="xx-small"
                              assistiveText={{ label: 'Show actions' }}
                            />
                          </button>
                          {openRowMenuId === line.id && (
                            <div
                              role="menu"
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 4,
                                marginTop: '4px',
                                minWidth: '140px',
                                background: 'white',
                                border: '1px solid #d8dde6',
                                borderRadius: '4px',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                                zIndex: 50,
                                padding: '4px 0',
                              }}
                            >
                              {([
                                { label: 'Edit', danger: false, onClick: () => openEditLine(line.id) },
                                { label: 'Add Child', danger: false, onClick: () => openCreateLine(line.id, true) },
                                { label: 'Move', danger: false, onClick: () => {
                                  setMoveTargetId(null);
                                  setMoveSourceIds([line.id]);
                                  setIsMoveOpen(true);
                                } },
                                { label: 'Delete', danger: false, onClick: () => setDeleteConfirmIds([line.id]) },
                              ] as const).map((action) => (
                                <button
                                  key={action.label}
                                  role="menuitem"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick();
                                    setOpenRowMenuId(null);
                                  }}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '6px 14px',
                                    border: 'none',
                                    background: 'none',
                                    color: action.danger ? '#c23934' : '#001e5b',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {isExpanded && children.map((child) => renderTreeNode(child, level + 1))}
                    </React.Fragment>
                  );
                };

                const activeAttributes = parseAttributes(activeLine?.lineAttributes, activeLine?.id);

                // Resolve coordinates for both real and merged Location lines.
                // For a merged virtual line the id is "merge::<sortedSourceIds>" and has no
                // entry in locationCoordinates, so fall back to the first source id that does.
                const coordsForLine = (lineId: string) => {
                  if (locationCoordinates[lineId]) return locationCoordinates[lineId];
                  if (lineId.startsWith('merge::')) {
                    const key = lineId.slice('merge::'.length);
                    const sourceIds = mergedGroups[key] || [];
                    const firstWithCoords = sourceIds.find((sid) => locationCoordinates[sid]);
                    if (firstWithCoords) return locationCoordinates[firstWithCoords];
                  }
                  return null;
                };
                const mapLocations = submissionLines
                  .filter((l) => l.lineType === 'Location' && !!coordsForLine(l.id))
                  .map((l) => {
                    const c = coordsForLine(l.id)!;
                    return {
                      id: l.id,
                      name: l.name,
                      lat: c.lat,
                      lng: c.lng,
                      address: c.address,
                      insuredValue: l.insuredValue,
                      premium: l.premiumAllocation,
                    };
                  });

                return (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
                    {/* Resolution Cards */}
                    {(showReconcileCard || showResolveDuplicatesCard || showCrossLobCard) && (
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'stretch' }}>
                      {/* Reconcile Attributes Card (combines discrepancies + canonical-term mapping) */}
                      {showReconcileCard && (
                      <div
                        className="slds-card"
                        style={{
                          flex: 1,
                          maxWidth: '50%',
                          marginTop: '0',
                          marginBottom: '0',
                          borderRadius: '12px',
                          boxShadow: 'none',
                          border: '1px solid #dddbda',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div className="slds-card__body slds-card__body_inner" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" aria-label="Attribute mapping discrepancies">
                                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                                </svg>
                              </span>
                              <h3 style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#0176D3',
                                margin: 0,
                                lineHeight: '20px'
                              }}>
                                Resolve Attribute Mapping
                              </h3>
                            </div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#5c3a00',
                              backgroundColor: '#fef5e8',
                              border: '1px solid #f5b87c',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              lineHeight: '14px'
                            }}>
                              {unresolvedDiscrepancyCount}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#5c5c5c',
                            lineHeight: '17px',
                            marginBottom: '0px',
                            flex: 1
                          }}>
                            Select sources for conflicting values and map attributes to canonical terms
                          </div>
                          <div style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid #e5e5e5',
                            display: 'flex',
                            justifyContent: 'center'
                          }}>
                            <button
                              onClick={() => {
                                const firstId = defaultReconcileId;
                                if (!firstId) return;
                                const rec = submissionLines.find((l) => l.id === firstId)!;
                                setViewSourcesTab('discrepancies');
                                setViewSourcesActiveRow(null);
                                setViewSourcesUnmappedAttr(null);
                                setViewSourcesMappedGroup(null);
                                setLineSourceViewer({ lineId: firstId, sources: buildLineSources(firstId, rec.lineOfBusiness), activeIdx: 0, mode: 'reconcile' });
                              }}
                              style={{
                                padding: 0,
                                border: 'none',
                                background: 'none',
                                color: '#0176D3',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Resolve Duplicates Card */}
                      {showResolveDuplicatesCard && (
                      <div
                        className="slds-card"
                        style={{
                          flex: 1,
                          maxWidth: '50%',
                          marginTop: '0',
                          marginBottom: '0',
                          borderRadius: '12px',
                          boxShadow: 'none',
                          border: '1px solid #dddbda',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div className="slds-card__body slds-card__body_inner" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" aria-label="Duplicate submission lines">
                                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                                </svg>
                              </span>
                              <h3 style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#0176D3',
                                margin: 0,
                                lineHeight: '20px'
                              }}>
                                Resolve Duplicate Submission Lines
                              </h3>
                            </div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#5c3a00',
                              backgroundColor: '#fef5e8',
                              border: '1px solid #f5b87c',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              lineHeight: '14px'
                            }}>
                              {unresolvedDuplicateCount}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#5c5c5c',
                            lineHeight: '17px',
                            marginBottom: '0px',
                            flex: 1
                          }}>
                            Review and merge possibly duplicate assets or coverage entries
                          </div>
                          <div style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid #e5e5e5',
                            display: 'flex',
                            justifyContent: 'center'
                          }}>
                            <button
                              onClick={() => {
                                const startCategory: 'Location' | 'Building' | 'Equipment / Contents' =
                                  duplicateGroups['Location'].length > 0
                                    ? 'Location'
                                    : duplicateGroups['Building'].length > 0
                                      ? 'Building'
                                      : 'Equipment / Contents';
                                setDuplicateCategory(startCategory);
                                setComparisonIdx(0);
                                setIsResolveDuplicatesOpen(true);
                                const firstGroup = duplicateGroups[startCategory][0] || [];
                                const initSel: Record<string, boolean> = {};
                                firstGroup.forEach((lid) => { initSel[lid] = true; });
                                setDuplicateSelections(initSel);
                              }}
                              style={{
                                padding: 0,
                                border: 'none',
                                background: 'none',
                                color: '#0176D3',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Cross-LOB Discrepancies Card */}
                      {showCrossLobCard && (
                      <div
                        className="slds-card"
                        style={{
                          flex: 1,
                          maxWidth: '50%',
                          marginTop: '0',
                          marginBottom: '0',
                          borderRadius: '12px',
                          boxShadow: 'none',
                          border: '1px solid #dddbda',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div className="slds-card__body slds-card__body_inner" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" aria-label="Cross-LOB discrepancies">
                                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                                </svg>
                              </span>
                              <h3 style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#0176D3',
                                margin: 0,
                                lineHeight: '20px'
                              }}>
                                Cross-LOB Discrepancies
                              </h3>
                            </div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#5c3a00',
                              backgroundColor: '#fef5e8',
                              border: '1px solid #f5b87c',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              lineHeight: '14px'
                            }}>
                              {unresolvedCrossLobCount}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#5c5c5c',
                            lineHeight: '17px',
                            marginBottom: '0px',
                            flex: 1
                          }}>
                            Review attribute changes for shared properties from other lines of business
                          </div>
                          <div style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid #e5e5e5',
                            display: 'flex',
                            justifyContent: 'center'
                          }}>
                            <button
                              onClick={() => {
                                setCrossLobLineIdx(0);
                                setIsCrossLobOpen(true);
                              }}
                              style={{
                                padding: 0,
                                border: 'none',
                                background: 'none',
                                color: '#0176D3',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      </div>
                      )}
                    </div>
                    )}

                    <div ref={treeContainerRef} style={{
                      display: 'flex',
                      gap: 0,
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      overflow: 'hidden',
                      flex: 1,
                      minHeight: '480px',
                    }}>
                      {/* Left tree-grid */}
                      <div style={{
                        width: isPanelOpen ? `${treeWidth}px` : 'auto',
                        flex: isPanelOpen ? `0 0 ${treeWidth}px` : 1,
                        minWidth: 0,
                        backgroundColor: '#fafafa',
                        display: 'flex',
                        flexDirection: 'column',
                      }}>
                        <div style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid #e5e5e5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          backgroundColor: 'white',
                        }}>
                          <span style={{ fontSize: '12px', color: '#5c5c5c' }}>
                            {treeSelectedIds.size > 0 ? `${treeSelectedIds.size} selected` : 'Submission Lines'}
                          </span>
                          {(() => {
                            const baseBtn = {
                              padding: '4px 10px',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid #c9c9c9',
                              borderRadius: '4px',
                              backgroundColor: 'white',
                            } as const;
                            const mergeDisabled = treeSelectedIds.size < 2;
                            const moveDisabled = treeSelectedIds.size === 0;
                            const deleteDisabled = treeSelectedIds.size === 0;
                            const onMerge = () => {
                              const ids = Array.from(treeSelectedIds);
                              if (ids.length < 2) return;
                              const types = new Set(
                                ids.map((id) => baseLines.find((l) => l.id === id)?.lineType).filter(Boolean)
                              );
                              if (types.size > 1) {
                                setMergeTypeWarning(
                                  'Only records of the same type can be merged. Your selection includes ' +
                                    Array.from(types).join(', ') + '. Select records of a single type and try again.'
                                );
                                return;
                              }
                              setMergeTypeWarning(null);
                              setMergeGroupIds(ids);
                              const sel: Record<string, boolean> = {};
                              ids.forEach((id) => { sel[id] = true; });
                              setDuplicateSelections(sel);
                              setComparisonFilter('all');
                              setIsResolveDuplicatesOpen(true);
                            };
                            const onMove = () => {
                              setMoveTargetId(null);
                              setMoveSourceIds(null);
                              setIsMoveOpen(true);
                            };
                            const onAdd = () => openCreateLine(null, false);
                            const onDelete = () => {
                              const ids = Array.from(treeSelectedIds);
                              if (ids.length === 0) return;
                              setDeleteConfirmIds(ids);
                            };

                            if (!isPanelOpen) {
                              return (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button onClick={onAdd} style={{ ...baseBtn, color: '#001e5b', cursor: 'pointer' }}>Add</button>
                                  <button onClick={onDelete} disabled={deleteDisabled} style={{ ...baseBtn, color: deleteDisabled ? '#939393' : '#001e5b', cursor: deleteDisabled ? 'not-allowed' : 'pointer' }}>Delete</button>
                                  <button onClick={onMerge} disabled={mergeDisabled} style={{ ...baseBtn, color: mergeDisabled ? '#939393' : '#001e5b', cursor: mergeDisabled ? 'not-allowed' : 'pointer' }}>Merge</button>
                                  <button onClick={onMove} disabled={moveDisabled} style={{ ...baseBtn, color: moveDisabled ? '#939393' : '#001e5b', cursor: moveDisabled ? 'not-allowed' : 'pointer' }}>Move</button>
                                </div>
                              );
                            }

                            return (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button onClick={onAdd} style={{ ...baseBtn, color: '#001e5b', cursor: 'pointer' }}>Add</button>
                                <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsToolbarMenuOpen((v) => !v);
                                    }}
                                    aria-haspopup="menu"
                                    aria-expanded={isToolbarMenuOpen}
                                    title="Show more actions"
                                    className="slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small"
                                    style={{ width: '24px', height: '24px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', border: '1px solid #c9c9c9', borderRadius: '4px' }}
                                  >
                                    <Icon
                                      category="utility"
                                      name="down"
                                      size="xx-small"
                                      assistiveText={{ label: 'Show more actions' }}
                                    />
                                  </button>
                                  {isToolbarMenuOpen && (
                                    <div
                                      role="menu"
                                      onMouseDown={(e) => e.stopPropagation()}
                                      style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '4px',
                                        minWidth: '140px',
                                        background: 'white',
                                        border: '1px solid #d8dde6',
                                        borderRadius: '4px',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                                        zIndex: 50,
                                        padding: '4px 0',
                                      }}
                                    >
                                      {([
                                        { label: 'Delete', disabled: deleteDisabled, danger: false, onClick: onDelete },
                                        { label: 'Merge', disabled: mergeDisabled, danger: false, onClick: onMerge },
                                        { label: 'Move', disabled: moveDisabled, danger: false, onClick: onMove },
                                      ]).map((opt) => (
                                        <button
                                          key={opt.label}
                                          role="menuitem"
                                          disabled={opt.disabled}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (opt.disabled) return;
                                            opt.onClick();
                                            setIsToolbarMenuOpen(false);
                                          }}
                                          style={{
                                            display: 'block',
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '6px 14px',
                                            border: 'none',
                                            background: 'none',
                                            color: opt.disabled ? '#939393' : (opt.danger ? '#c23934' : '#001e5b'),
                                            fontSize: '13px',
                                            cursor: opt.disabled ? 'not-allowed' : 'pointer',
                                          }}
                                          onMouseEnter={(e) => { if (!opt.disabled) e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        {/* Search box */}
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e5e5', backgroundColor: 'white' }}>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', pointerEvents: 'none' }}>
                              <Icon category="utility" name="search" size="xx-small" colorVariant="default" style={{ fill: '#939393' }} />
                            </span>
                            <input
                              type="text"
                              value={treeSearch}
                              onChange={(e) => setTreeSearch(e.target.value)}
                              placeholder="Search submission lines"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '6px 26px 6px 28px',
                                fontSize: '13px',
                                border: '1px solid #c9c9c9',
                                borderRadius: '4px',
                                color: '#2e2e2e',
                              }}
                            />
                            {treeSearch && (
                              <button
                                onClick={() => setTreeSearch('')}
                                aria-label="Clear search"
                                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', padding: '2px', display: 'inline-flex', color: '#939393' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Column header row — kept visible whether the panel is open or closed */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: isPanelOpen ? 'minmax(0, 1fr) 40px' : 'repeat(4, minmax(0, 1fr)) 40px',
                          backgroundColor: '#f3f3f3',
                          borderBottom: '1px solid #c9c9c9',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#5c5c5c',
                        }}>
                          <div style={{ padding: '10px 12px' }}>Line Name</div>
                          {!isPanelOpen && (
                            <>
                              <div style={{ padding: '10px 12px' }}>Line Type</div>
                              <div style={{ padding: '10px 12px', textAlign: 'right' }}>Insured Value</div>
                              <div style={{ padding: '10px 12px', textAlign: 'right' }}>Coverage Limit</div>
                            </>
                          )}
                          <div />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                          {rootLines.length === 0 ? (
                            <div style={{ padding: '16px', fontSize: '13px', color: '#5c5c5c' }}>
                              No submission lines yet.
                            </div>
                          ) : treeVisibleIds && treeVisibleIds.size === 0 ? (
                            <div style={{ padding: '16px', fontSize: '13px', color: '#5c5c5c' }}>
                              No lines match “{treeSearch}”.
                            </div>
                          ) : (
                            rootLines.map((line) => renderTreeNode(line, 0))
                          )}
                        </div>
                      </div>

                      {/* Draggable separator — resizes the hierarchy pane while the panel is open */}
                      {isPanelOpen && (
                        <div
                          onMouseDown={startTreeResize}
                          title="Drag to resize"
                          style={{
                            flex: '0 0 auto',
                            width: '6px',
                            cursor: 'col-resize',
                            backgroundColor: '#e5e5e5',
                            position: 'relative',
                            zIndex: 5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0176D3'; }}
                          onMouseLeave={(e) => { if (!treeResizeRef.current) e.currentTarget.style.backgroundColor = '#e5e5e5'; }}
                        >
                          <div style={{
                            width: '4px',
                            height: '32px',
                            borderRadius: '2px',
                            backgroundColor: '#939393',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            pointerEvents: 'none',
                          }}>
                            <span style={{ width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'white' }} />
                            <span style={{ width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'white' }} />
                            <span style={{ width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'white' }} />
                          </div>
                        </div>
                      )}

                      {/* Right detail panel — kept mounted through the slide-out animation */}
                      {isPanelOpen && activeLine && (
                      <div ref={detailPaneRef} style={{
                        flex: 1,
                        minWidth: 0,
                        overflowY: 'auto',
                        padding: '16px 20px',
                        paddingBottom: isDirty ? '72px' : '16px',
                        transform: panelSettled ? 'none' : (panelOpen ? 'translateX(0)' : 'translateX(24px)'),
                        opacity: panelOpen ? 1 : 0,
                        transition: `transform ${PANEL_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${PANEL_ANIM_MS}ms ease`,
                      }}>
                          <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              marginBottom: '12px',
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                {(() => {
                                  const parentChain: string[] = [];
                                  let pid = effectiveParentId(activeLine.id);
                                  while (pid) {
                                    const p = submissionLines.find((l) => l.id === pid);
                                    if (!p) break;
                                    if (p.lineType !== 'LOB') parentChain.unshift(p.name);
                                    pid = effectiveParentId(p.id);
                                  }
                                  return parentChain.length > 0 ? (
                                    <div style={{ fontSize: '11px', color: '#5c5c5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {parentChain.join(' / ')} /
                                    </div>
                                  ) : null;
                                })()}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                  <a
                                    href={`${ASSET_PREFIX}/submission-lines/${activeLine.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => { e.preventDefault(); window.open(`${ASSET_PREFIX}/submission-lines/${activeLine.id}`, '_blank'); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, textDecoration: 'none' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                                    title="Open record in a new tab"
                                  >
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0176D3', margin: 0, lineHeight: '22px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'inherit' }}>
                                      {activeLine.name}
                                    </h3>
                                    <Icon category="utility" name="new_window" size="x-small" style={{ fill: '#0176D3', flexShrink: 0 }} />
                                  </a>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {activeLine.lineType === 'Location' && !!coordsForLine(activeLine.id) && (
                                  <button
                                    onClick={() => setMapModalLineId(activeLine.id)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'white', backgroundColor: '#0176D3', border: '1px solid #0176D3', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#014486'; e.currentTarget.style.borderColor = '#014486'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0176D3'; e.currentTarget.style.borderColor = '#0176D3'; }}
                                  >
                                    <Icon category="utility" name="location" size="xx-small" colorVariant="base" style={{ fill: 'white' }} />
                                    View on map
                                  </button>
                                )}
                                {(() => {
                                  const lineSources = sourcesByLine[activeLine.id] || {};
                                  const seen: string[] = [];
                                  Object.values(lineSources).forEach((cands) => {
                                    cands.forEach((c) => {
                                      if (c.source && !seen.includes(c.source)) seen.push(c.source);
                                    });
                                  });
                                  if (seen.length === 0) {
                                    seen.push(defaultSourceFor(activeLine.lineOfBusiness));
                                  }
                                  return (
                                    <button
                                      onClick={() => { setViewSourcesTab('discrepancies'); setLineSourceViewer({ lineId: activeLine.id, sources: seen, activeIdx: 0 }); }}
                                      style={{
                                        padding: '4px 12px',
                                        border: '1px solid #c9c9c9',
                                        borderRadius: '4px',
                                        backgroundColor: 'white',
                                        color: '#001e5b',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                    >
                                      View Sources
                                    </button>
                                  );
                                })()}
                                <button
                                  onClick={() => guardNav(() => setSelectedSubmissionLineId(null))}
                                  aria-label="Close panel"
                                  title="Close"
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    border: 'none',
                                    background: 'none',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#5c5c5c',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* AI Summary — human-readable entity description generated per line
                                type from the line's canonical attributes + financials (see PRD 7.2). */}
                            {(() => {
                              const attrMap: Record<string, string> = {};
                              activeAttributes.forEach((a) => { attrMap[a.key] = a.value; });
                              const attr = (...keys: string[]) => {
                                for (const k of keys) if (attrMap[k]) return attrMap[k];
                                return '';
                              };
                              const parts: string[] = [];
                              const push = (s: string) => { if (s && s.trim()) parts.push(s.trim()); };
                              const money = (n: number | null | undefined) =>
                                n == null ? '' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `$${Number(n).toLocaleString()}`;
                              const type = (activeLine.lineType || '').toLowerCase();

                              if (type === 'location') {
                                const addr = attr('Address');
                                const cityState = [attr('City'), [attr('State'), attr('Zip')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
                                push(`${activeLine.name}${addr ? ` at ${addr}` : ''}${cityState ? `, ${cityState}` : ''}.`);
                                const constr = [attr('Construction Type'), attr('Total Building Area', 'Square Footage'), attr('Year Built') && `built ${attr('Year Built')}`].filter(Boolean).join(', ');
                                if (constr) push(`${constr}.`);
                                const prot = [attr('Sprinklered') && `sprinklered (${attr('Sprinklered')})`, attr('Protection Class') && `protection class ${attr('Protection Class')}`, attr('FEMA Flood Zone') && `flood zone ${attr('FEMA Flood Zone')}`].filter(Boolean).join(', ');
                                if (prot) push(`Protection & CAT: ${prot}.`);
                                const val = money(activeLine.insuredValue ?? activeLine.coverageLimit);
                                if (val) push(`Insured value ${val}.`);
                              } else if (type === 'building') {
                                push(`${activeLine.name}${attr('Occupancy') ? ` — ${attr('Occupancy')}` : ''}.`);
                                const constr = [attr('Construction Type'), attr('Square Footage', 'Total Building Area') && `${attr('Square Footage', 'Total Building Area')} sqft`, attr('Stories', 'Number of Stories') && `${attr('Stories', 'Number of Stories')} stor${attr('Stories', 'Number of Stories') === '1' ? 'y' : 'ies'}`, attr('Year Built') && `built ${attr('Year Built')}`].filter(Boolean).join(', ');
                                if (constr) push(`${constr}.`);
                                const roof = [attr('Roof Type', 'Roof Covering'), attr('Roof Year') && `roof ${attr('Roof Year')}`].filter(Boolean).join(', ');
                                if (roof) push(`Roof: ${roof}.`);
                                const val = money(activeLine.insuredValue ?? activeLine.coverageLimit);
                                if (val) push(`Insured value ${val}.`);
                              } else if (type === 'equipment / contents') {
                                push(`${activeLine.name} — ${attr('Contents Type', 'Equipment Type', 'Coverage') || 'contents'} coverage.`);
                                const detail = [attr('Valuation') && `${attr('Valuation')} valuation`, attr('Breakdown Coverage') && `breakdown coverage ${attr('Breakdown Coverage')}`, attr('Peak Season Increase') && `peak season +${attr('Peak Season Increase')}`].filter(Boolean).join(', ');
                                if (detail) push(`${detail}.`);
                                const val = money(activeLine.insuredValue ?? activeLine.coverageLimit);
                                if (val) push(`Insured value ${val}.`);
                              } else if (type === 'coverage') {
                                push(`${activeLine.name} — ${attr('Coverage', 'Coverage Form') || 'coverage'}.`);
                                const detail = [attr('Perils'), attr('Valuation') && `${attr('Valuation')} valuation`, attr('Deductible Type'), attr('Wind/Hail Deductible') && `wind/hail ${attr('Wind/Hail Deductible')}`, attr('Ordinance or Law') && `ordinance or law ${attr('Ordinance or Law')}`].filter(Boolean).join(', ');
                                if (detail) push(`${detail}.`);
                                const lim = money(activeLine.coverageLimit);
                                if (lim) push(`Limit ${lim}.`);
                              } else if (type === 'lob') {
                                push(`${activeLine.name} — ${attr('Policy Form') && `policy form ${attr('Policy Form')}`}${attr('Coverage Basis') ? `, ${attr('Coverage Basis')} basis` : ''}.`);
                                const detail = [attr('Cause of Loss'), attr('Valuation') && `${attr('Valuation')} valuation`, attr('Coinsurance') && `${attr('Coinsurance')} coinsurance`, attr('Premium Basis') && `premium basis ${attr('Premium Basis')}`].filter(Boolean).join(', ');
                                if (detail) push(`${detail}.`);
                                const lim = money(activeLine.coverageLimit);
                                if (lim) push(`Aggregate limit ${lim}.`);
                              } else {
                                const lob = activeLine.lineOfBusiness ? `${activeLine.lineOfBusiness} ` : '';
                                push(`${activeLine.name} is a ${lob}${type || 'submission line'}.`);
                              }
                              const summary = parts.join(' ');
                              return (
                                <div style={{ fontSize: '13px', color: '#3e3e3c', lineHeight: '19px', marginBottom: '12px' }}>
                                  <strong style={{ color: '#001e5b' }}>AI Summary</strong> {summary}
                                </div>
                              );
                            })()}

                            {/* Data Discrepancy Banner — above the tabs */}
                            {hasLineWarning(activeLine.id) && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                backgroundColor: '#fef5e8',
                                border: '1px solid #f5b87c',
                                borderRadius: '6px',
                                padding: '10px 12px',
                                marginBottom: '12px',
                              }}>
                                <div style={{ fontSize: '13px', color: '#5c3a00', lineHeight: '18px', flex: 1 }}>
                                  <strong>Resolve attribute mapping</strong> — Multiple sources provide different values for some attributes. Review and select the correct value for each discrepancy.{' '}
                                  <button
                                    onClick={() => {
                                      const lineSources = sourcesByLine[activeLine.id] || {};
                                      const seen: string[] = [];
                                      Object.values(lineSources).forEach((cands) => {
                                        cands.forEach((c) => { if (c.source && !seen.includes(c.source)) seen.push(c.source); });
                                      });
                                      if (seen.length === 0) seen.push(defaultSourceFor(activeLine.lineOfBusiness));
                                      setViewSourcesTab('discrepancies');
                                      setLineSourceViewer({ lineId: activeLine.id, sources: seen, activeIdx: 0 });
                                    }}
                                    style={{ background: 'none', border: 'none', color: '#0176D3', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0 }}
                                  >
                                    Resolve
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Inner tabs: Attributes / Extracted Data / Details */}
                            <div style={{
                              borderBottom: '1px solid #e5e5e5',
                              display: 'flex',
                              gap: '0',
                              marginBottom: '12px',
                            }}>
                              {(['attributes', 'unmapped', 'details'] as const).map((tabKey) => {
                                const label = tabKey === 'attributes' ? 'Attributes' : tabKey === 'details' ? 'Details' : 'Extracted Data';
                                const isActive = linePanelTab === tabKey;
                                return (
                                  <button
                                    key={tabKey}
                                    onClick={() => guardNav(() => setLinePanelTab(tabKey))}
                                    style={{
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'none',
                                      fontSize: '13px',
                                      fontWeight: isActive ? 600 : 400,
                                      color: isActive ? '#0176D3' : '#706E6B',
                                      borderBottom: isActive ? '2px solid #0176D3' : '2px solid transparent',
                                      marginBottom: '-1px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>

                            {linePanelTab === 'attributes' && (
                              <ClampOneLine text="Manage the values for this submission line's attributes — view an attribute's sources, switch the selected source, or manually edit a value." />
                            )}
                            {linePanelTab === 'unmapped' && (
                              <ClampOneLine text="Every attribute extracted for this submission line from its documents and emails." />
                            )}

                            {(linePanelTab === 'attributes' || linePanelTab === 'unmapped') && (<>


                            {/* Potential Duplicate Banner */}
                            {linePanelTab === 'attributes' && hasPotentialDuplicate(activeLine.id) && (() => {
                              const duplicateLine = getPotentialDuplicateLine(activeLine.id);
                              return duplicateLine ? (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  backgroundColor: '#fef5e8',
                                  border: '1px solid #f5b87c',
                                  borderLeft: '4px solid #B85C00',
                                  borderRadius: '6px',
                                  padding: '10px 12px',
                                  marginBottom: '12px',
                                }}>
                                  <span style={{ flexShrink: 0 }}>
                                    <Icon
                                      assistiveText={{ label: 'Potential duplicate' }}
                                      category="utility"
                                      name="copy"
                                      size="small"
                                      className="slds-icon-text-warning"
                                    />
                                  </span>
                                  <div style={{ fontSize: '13px', color: '#5c3a00', lineHeight: '18px', flex: 1 }}>
                                    <strong>Potentially same location as{' '}
                                      <button
                                        onClick={() => guardNav(() => setSelectedSubmissionLineId(duplicateLine.id))}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#0176D3',
                                          textDecoration: 'underline',
                                          cursor: 'pointer',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          padding: 0,
                                        }}
                                      >
                                        {duplicateLine.name}
                                      </button>
                                    </strong> — Review to confirm if these are the same or separate facilities.
                                  </div>
                                </div>
                              ) : null;
                            })()}

                            {(() => {
                              const termOptions = getCanonicalTermOptions(activeLine.lineOfBusiness, activeLine.lineType);
                              const lineId = activeLine.id;
                              const lineSources = sourcesByLine[lineId] || {};
                              // Source list (for launching the View Sources modal on the right tab).
                              const seenSources: string[] = [];
                              Object.values(lineSources).forEach((cands) => {
                                cands.forEach((c) => { if (c.source && !seenSources.includes(c.source)) seenSources.push(c.source); });
                              });
                              if (seenSources.length === 0) seenSources.push(defaultSourceFor(activeLine.lineOfBusiness));

                              // Pool model — identical to the View Sources modal so both views share one source
                              // of truth. Each extraction candidate is an atomic pool item that is either mapped
                              // to a canonical term or unmapped; the preferred item per term drives this table.
                              type RecordPoolItem = { itemId: string; attrKey: string; candidateIdx: number; field: string; value: string; override: string; displayValue: string; source: string; confidence: number; updated?: boolean };
                              const rowTermFor = (attrKey: string, candidateIdx: number, isSelected: boolean): string => {
                                const rowKey = `${lineId}::${attrKey}::${candidateIdx}`;
                                if (rowKey in viewSourcesRowMap) return viewSourcesRowMap[rowKey];
                                const mapping = effectiveCanonicalMappings[`${lineId}::${attrKey}`] || '';
                                if (isSelected) return mapping;
                                // Step 4 (Pricing & Quoting): an enrichment candidate maps to its attribute's
                                // canonical term IN ADDITION to the existing selected source, so the term shows
                                // multiple sources without displacing the existing (doc/email) winner.
                                if (lineStep >= 4 && mapping && isEnrichmentSourceName((lineSources[attrKey] || [])[candidateIdx]?.source || '')) return mapping;
                                return '';
                              };
                              // Build via the same `cards` intermediate the modal uses, so the fallback
                              // (no-candidate) value/source honor manual edits + flagged state identically.
                              const recordCards = activeAttributes.map((attr) => {
                                const candidates = lineSources[attr.key] || [];
                                const editKey = `${lineId}::${attr.key}`;
                                const edited = submissionLineEdits[editKey];
                                const flagged = isAttrFlagged(lineId, attr.key);
                                const selectedIdx = submissionLineSourceIdx[editKey] ?? (flagged && candidates.length > 1 ? -1 : 0);
                                const active = edited
                                  ? null
                                  : selectedIdx >= 0 && candidates[selectedIdx]
                                    ? candidates[selectedIdx]
                                    : null;
                                const value = edited
                                  ? edited.value
                                  : flagged && candidates.length > 1 && selectedIdx < 0
                                    ? ''
                                    : active ? active.value : attr.value;
                                const source = edited
                                  ? 'Manually edited'
                                  : flagged && candidates.length > 1 && selectedIdx < 0
                                    ? ''
                                    : active ? active.source : defaultSourceFor(activeLine.lineOfBusiness);
                                return { attrKey: attr.key, value, source, candidates };
                              });
                              const recordPoolItems: RecordPoolItem[] = [];
                              recordCards.forEach((c) => {
                                const cands = c.candidates.length > 0
                                  ? c.candidates
                                  : [{ field: c.attrKey, value: c.value, source: c.source }];
                                cands.forEach((cand, i) => {
                                  const override = viewSourcesOverride[`${lineId}::${c.attrKey}::${i}`] || '';
                                  recordPoolItems.push({
                                    itemId: `${c.attrKey}::${i}`,
                                    attrKey: c.attrKey,
                                    candidateIdx: i,
                                    field: (cand as any).field || c.attrKey,
                                    value: cand.value,
                                    override,
                                    displayValue: override || cand.value,
                                    source: cand.source,
                                    confidence: confidenceFor(lineId, c.attrKey, cand.value, cand.source),
                                    updated: (cand as any).updated,
                                  });
                                });
                              });
                              const recordItemTerm = (it: RecordPoolItem): string => {
                                const selIdx = Math.max(0, submissionLineSourceIdx[`${lineId}::${it.attrKey}`] ?? 0);
                                return rowTermFor(it.attrKey, it.candidateIdx, it.candidateIdx === selIdx);
                              };
                              // All canonical terms a row belongs to: primary (recordItemTerm) + extras.
                              const recordItemAllTerms = (it: RecordPoolItem): string[] => {
                                const all: string[] = [];
                                const primary = recordItemTerm(it);
                                if (primary) all.push(primary);
                                (viewSourcesExtraTerms[`${lineId}::${it.attrKey}::${it.candidateIdx}`] || []).forEach((t) => {
                                  if (t && !all.includes(t)) all.push(t);
                                });
                                return all;
                              };
                              const mappedByTerm = new Map<string, RecordPoolItem[]>();
                              recordPoolItems.forEach((it) => {
                                recordItemAllTerms(it).forEach((t) => {
                                  if (!mappedByTerm.has(t)) mappedByTerm.set(t, []);
                                  mappedByTerm.get(t)!.push(it);
                                });
                              });
                              // Synthetic pool item representing a term's manually-entered value.
                              const manualItemFor = (term: string): RecordPoolItem => {
                                const v = viewSourcesTermManual[`${lineId}::${term}`] || '';
                                return { itemId: '__manual__', attrKey: '', candidateIdx: -1, field: '', value: v, override: '', displayValue: v, source: 'Manual', confidence: 100 };
                              };
                              const termPreferredItem = (term: string): RecordPoolItem | null => {
                                const explicit = viewSourcesTermPref[`${lineId}::${term}`];
                                if (explicit === '__manual__') return manualItemFor(term);
                                const items = mappedByTerm.get(term) || [];
                                if (items.length === 0) return null;
                                return items.find((it) => it.itemId === explicit) || items[0];
                              };
                              // Commit a manually-typed term value: non-empty makes the manual value the winner
                              // (clears attribute, source → Manual); empty reverts to the extraction-based pick.
                              const commitManual = (term: string, v: string) => {
                                const key = `${lineId}::${term}`;
                                const val = v.trim();
                                if ((viewSourcesTermManual[key] || '') !== val) {
                                  const beforeManual = viewSourcesTermManual[key];
                                  const beforePref = viewSourcesTermPref[key];
                                  markDirty(`man:${key}`, () => {
                                    setViewSourcesTermManual((p) => {
                                      const n = { ...p };
                                      if (beforeManual === undefined) delete n[key]; else n[key] = beforeManual;
                                      return n;
                                    });
                                    setViewSourcesTermPref((p) => {
                                      const n = { ...p };
                                      if (beforePref === undefined) delete n[key]; else n[key] = beforePref;
                                      return n;
                                    });
                                  });
                                }
                                setViewSourcesTermManual((prev) => {
                                  const next = { ...prev };
                                  if (val) next[key] = val; else delete next[key];
                                  return next;
                                });
                                setViewSourcesTermPref((prev) => {
                                  const next = { ...prev };
                                  if (val) next[key] = '__manual__';
                                  else if (next[key] === '__manual__') delete next[key];
                                  return next;
                                });
                                setViewSourcesEditingManual(null);
                              };
                              // Term order matches the modal: catalog terms first, then any mapped term
                              // not in the catalog (so a non-catalog mapping still gets a row).
                              const recordTermOrder = [
                                ...termOptions,
                                ...Array.from(mappedByTerm.keys()).filter((t) => !termOptions.includes(t)),
                              ];
                              // Unmapped pool — one row per extraction candidate, sorted like the modal
                              // (attribute name then source) so both views show the identical set of rows.
                              const unmappedItems = recordPoolItems
                                .filter((it) => recordItemAllTerms(it).length === 0)
                                .sort((a, b) => a.attrKey.localeCompare(b.attrKey) || a.source.localeCompare(b.source));

                              // Distinct sources across all of this line's extractions — feeds the
                              // "filter by source" multiselect on both the Attributes and Unmapped tabs.
                              const allSources = Array.from(new Set(recordPoolItems.map((it) => it.source).filter(Boolean))).sort();
                              // Unmapped tab filters (search + source) — independent of the Attributes tab.
                              const unmappedFiltered = unmappedItems.filter((it) => {
                                const q = unmappedSearch.trim().toLowerCase();
                                if (q && !(
                                  (it.field || '').toLowerCase().includes(q) ||
                                  (it.displayValue || '').toLowerCase().includes(q) ||
                                  (it.source || '').toLowerCase().includes(q)
                                )) return false;
                                if (unmappedSourceFilter.size > 0 && !unmappedSourceFilter.has(it.source)) return false;
                                return true;
                              });

                              // Extracted Data tab — a full inventory of every extraction (mapped or not),
                              // sorted by attribute then source. Search/source filters are presentation-only
                              // (they never scope by association status — the tab always shows all rows).
                              const extractedItems = [...recordPoolItems].sort((a, b) =>
                                a.attrKey.localeCompare(b.attrKey) || a.source.localeCompare(b.source));
                              // Association status for a pool item. An extraction can belong to several
                              // canonical terms; for each, it's "Selected" when it's that term's preferred
                              // pick, else "Associated". A term is never listed under both.
                              const itemAssociations = (it: RecordPoolItem): { associated: string[]; selected: string[] } => {
                                const associated: string[] = [];
                                const selected: string[] = [];
                                recordItemAllTerms(it).forEach((term) => {
                                  const pref = termPreferredItem(term);
                                  if (pref && pref.itemId === it.itemId) selected.push(term); else associated.push(term);
                                });
                                return { associated, selected };
                              };
                              // A pool item's single status label (mirrors the row rendering) — feeds the
                              // Extracted Data "Status" filter, which works the same way as the Source filter.
                              const itemStatus = (it: RecordPoolItem): 'Selected' | 'Associated' | 'Unassociated' => {
                                const { associated, selected } = itemAssociations(it);
                                return selected.length > 0 ? 'Selected' : associated.length > 0 ? 'Associated' : 'Unassociated';
                              };
                              const allStatuses = ['Selected', 'Associated', 'Unassociated'];
                              const extractedFiltered = extractedItems.filter((it) => {
                                const q = unmappedSearch.trim().toLowerCase();
                                if (q && !(
                                  (it.field || '').toLowerCase().includes(q) ||
                                  (it.displayValue || '').toLowerCase().includes(q) ||
                                  (it.source || '').toLowerCase().includes(q)
                                )) return false;
                                if (unmappedSourceFilter.size > 0 && !unmappedSourceFilter.has(it.source)) return false;
                                if (unmappedStatusFilter.size > 0 && !unmappedStatusFilter.has(itemStatus(it))) return false;
                                return true;
                              });

                              // Distinct sources contributing to a single canonical term's mapped
                              // extractions — used to scope the single-term Select Source modal's doc
                              // tabs to just the rows in that term's box.
                              const termSources = (term: string): string[] => {
                                const srcs: string[] = [];
                                (mappedByTerm.get(term) || []).forEach((it) => {
                                  if (it.source && !srcs.includes(it.source)) srcs.push(it.source);
                                });
                                return srcs;
                              };
                              // Open the View Sources modal focused on a specific extraction row.
                              const openSourceViewer = (attrKey: string, candidateIdx: number, tab: 'mapped' | 'unmapped', term?: string) => {
                                const scoped = term ? termSources(term) : seenSources;
                                const src = ((lineSources[attrKey] || [])[candidateIdx] || {}).source;
                                const activeIdx = src && scoped.indexOf(src) >= 0 ? scoped.indexOf(src) : 0;
                                setViewSourcesTab(tab);
                                setViewSourcesActiveRow({ attrKey, candidateIdx });
                                setViewSourcesUnmappedAttr(null);
                                setLineSourceViewer({ lineId, sources: scoped, activeIdx, term });
                              };
                              // Open the modal on the Mapped tab with a canonical-term box expanded (empty-term case).
                              const openMappedTerm = (term: string) => {
                                setViewSourcesTab('mapped');
                                setViewSourcesMappedGroup(term);
                                setViewSourcesActiveRow(null);
                                setViewSourcesUnmappedAttr(null);
                                setLineSourceViewer({ lineId, sources: termSources(term), activeIdx: 0, term });
                              };

                              // Group the term rows into canonical categories (mirrors the Enrichment tab
                              // and the View Sources modal). A term "has data" when it resolves to a
                              // preferred pool item or carries a manual value.
                              const recordSections = groupTermsByCategory(activeLine.lineOfBusiness, activeLine.lineType, recordTermOrder);
                              const termHasData = (term: string): boolean =>
                                viewSourcesTermPref[`${lineId}::${term}`] === '__manual__' || (mappedByTerm.get(term) || []).length > 0;

                              const renderRecordTermRow = (term: string, isLast: boolean) => {
                                const preferred = termPreferredItem(term);
                                const manualKey = `${lineId}::${term}`;
                                const editKeyRec = `rec:${manualKey}`;
                                const isManual = viewSourcesTermPref[manualKey] === '__manual__';
                                const mappedCount = (mappedByTerm.get(term) || []).length;
                                const isEditingValue = viewSourcesEditingManual === editKeyRec;
                                const editSeed = preferred ? (preferred.displayValue || '') : '';
                                const manualRowKey = `man:${manualKey}`;
                                const manualEditActive = viewSourcesHoverRow === manualRowKey || isEditingValue;
                                return (
                                  <div
                                    key={term}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                      borderBottom: isLast ? 'none' : '1px solid #e5e5e5',
                                      fontSize: '13px',
                                      backgroundColor: 'white',
                                    }}
                                  >
                                    <div style={{ padding: '10px 12px', color: '#2e2e2e', ...(manualEditActive ? ROW_DIM_STYLE : {}) }}>{term}</div>
                                    {/* Attribute — blank for a manual value */}
                                    <div style={{ padding: '10px 12px', color: isManual ? '#939393' : '#001e5b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(manualEditActive ? ROW_DIM_STYLE : {}) }}>
                                      {isManual ? '—' : (preferred ? preferred.field : '—')}
                                    </div>
                                    {/* Value — always inline-editable; committing text sets a manual value */}
                                    <div
                                      onMouseEnter={() => setViewSourcesHoverRow(manualRowKey)}
                                      onMouseLeave={() => setViewSourcesHoverRow((prev) => prev === manualRowKey ? null : prev)}
                                      style={{ padding: '6px 12px', color: '#2e2e2e', display: 'flex', alignItems: 'center', gap: '6px', ...(dirtyCells.has(`man:${manualKey}`) ? DIRTY_CELL_STYLE : (manualEditActive ? EDIT_CELL_STYLE : {})) }}
                                    >
                                      {isEditingValue ? (
                                        <input
                                          type="text"
                                          autoFocus
                                          defaultValue={editSeed}
                                          placeholder="Enter a value"
                                          onBlur={(e) => commitManual(term, e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                                            else if (e.key === 'Escape') { setViewSourcesEditingManual(null); }
                                          }}
                                          style={{ width: '100%', padding: '4px 6px', fontSize: '13px', border: '1px solid #0176D3', borderRadius: '4px', boxSizing: 'border-box', color: '#2e2e2e' }}
                                        />
                                      ) : (
                                        <>
                                          <span
                                            onClick={() => setViewSourcesEditingManual(editKeyRec)}
                                            title="Click to enter a value"
                                            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', color: preferred ? '#2e2e2e' : '#939393' }}
                                          >
                                            {preferred ? (preferred.displayValue || <span style={{ color: '#939393' }}>—</span>) : <span style={{ fontStyle: 'italic' }}>Add value</span>}
                                          </span>
                                          {isManual ? null : preferred && preferred.override ? (
                                            <span title="Override value" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                                              <Icon category="utility" name="product_transfer" size="xx-small" style={{ fill: '#B85C00' }} />
                                            </span>
                                          ) : preferred ? (
                                            <ConfidenceBadge score={preferred.confidence} />
                                          ) : null}
                                          {manualEditActive && (
                                            <button
                                              type="button"
                                              onClick={() => setViewSourcesEditingManual(editKeyRec)}
                                              title="Edit value"
                                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', background: 'none', padding: '2px', cursor: 'pointer', marginLeft: 'auto' }}
                                            >
                                              <Icon category="utility" name="edit" size="xx-small" style={{ fill: '#0176D3' }} />
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    {/* Source — Manual [+N] when manual, else the extraction source or [Select source] */}
                                    <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', ...(manualEditActive ? ROW_DIM_STYLE : {}) }}>
                                      {isManual ? (
                                        <button
                                          onClick={() => openMappedTerm(term)}
                                          style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer', color: '#0176D3', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', borderRadius: '4px', width: '100%', textAlign: 'left' }}
                                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                          Manual
                                          {mappedCount > 0 && <span style={{ color: '#0176D3' }}> [+{mappedCount}]</span>}
                                        </button>
                                      ) : preferred ? (
                                        <button
                                          onClick={() => openSourceViewer(preferred.attrKey, preferred.candidateIdx, 'mapped', term)}
                                          style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer', color: '#0176D3', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', borderRadius: '4px', width: '100%', textAlign: 'left' }}
                                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                          {preferred.source || defaultSourceFor(activeLine.lineOfBusiness)}
                                          {mappedCount > 1 && <span style={{ color: '#0176D3' }}> [+{mappedCount - 1}]</span>}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => openMappedTerm(term)}
                                          style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer', color: '#0176D3', fontSize: '13px', fontWeight: 400, fontStyle: 'italic', fontFamily: 'inherit', borderRadius: '4px', width: '100%', textAlign: 'left' }}
                                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                          {mappedCount > 0 ? '[Select source]' : '[Map attributes]'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              };

                              // Attributes-tab filters (search / source / unmapped-only) — independent
                              // of the Unmapped tab. A term row is kept when it matches all active filters.
                              const attrQuery = attrSearch.trim().toLowerCase();
                              const termMatchesAttrFilter = (term: string): boolean => {
                                const items = mappedByTerm.get(term) || [];
                                const preferred = termPreferredItem(term);
                                if (attrUnmappedOnly && termHasData(term)) return false;
                                if (attrSourceFilter.size > 0) {
                                  if (!items.some((it) => attrSourceFilter.has(it.source))) return false;
                                }
                                if (attrQuery) {
                                  const hay = [
                                    term,
                                    ...items.map((it) => `${it.field} ${it.displayValue} ${it.source}`),
                                    preferred ? preferred.displayValue : '',
                                  ].join(' ').toLowerCase();
                                  if (!hay.includes(attrQuery)) return false;
                                }
                                return true;
                              };
                              const attrFiltersActive = !!attrQuery || attrSourceFilter.size > 0 || attrUnmappedOnly;

                              let visibleSections = recordSections;
                              if (attrFiltersActive) {
                                visibleSections = visibleSections
                                  .map((s) => ({ category: s.category, terms: s.terms.filter(termMatchesAttrFilter) }))
                                  .filter((s) => s.terms.length > 0);
                              }
                              const allCategoryNames = recordSections.map((s) => s.category);
                              const expandAll = () => {
                                setCanonicalCatOpened(new Set(allCategoryNames));
                                setCanonicalCatClosed(new Set());
                              };
                              const collapseAll = () => {
                                setCanonicalCatClosed(new Set(allCategoryNames));
                                setCanonicalCatOpened(new Set());
                              };

                              // Shared search input for the detail-panel filter bars.
                              const renderFilterSearch = (value: string, onChange: (v: string) => void, placeholder: string) => (
                                <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', pointerEvents: 'none' }}>
                                    <Icon category="utility" name="search" size="xx-small" style={{ fill: '#939393' }} />
                                  </span>
                                  <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    placeholder={placeholder}
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '6px 26px 6px 28px', fontSize: '13px', border: '1px solid #c9c9c9', borderRadius: '4px', color: '#2e2e2e' }}
                                  />
                                  {value && (
                                    <button
                                      onClick={() => onChange('')}
                                      aria-label="Clear search"
                                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', padding: '2px', display: 'inline-flex', color: '#939393' }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                                    </button>
                                  )}
                                </div>
                              );

                              // Shared "filter by …" multiselect dropdown. None selected = show all.
                              // Defaults to the Source dimension; pass label/options to reuse for Status etc.
                              const renderSourceFilter = (
                                selected: Set<string>,
                                setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
                                open: boolean,
                                setOpen: React.Dispatch<React.SetStateAction<boolean>>,
                                label: string = 'Source',
                                options: string[] = allSources
                              ) => (
                                <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                                      padding: '6px 10px', fontSize: '13px', fontWeight: 600,
                                      border: '1px solid #c9c9c9', borderRadius: '4px',
                                      backgroundColor: selected.size > 0 ? '#e8f1fb' : 'white',
                                      color: '#001e5b', cursor: 'pointer', whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <Icon category="utility" name="filterList" size="xx-small" style={{ fill: '#001e5b' }} />
                                    {label}{selected.size > 0 ? ` (${selected.size})` : ''}
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#001e5b" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M7 10l5 5 5-5z" /></svg>
                                  </button>
                                  {open && (
                                    <>
                                      <div onClick={() => setOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }} />
                                      <div
                                        onMouseDown={(e) => e.stopPropagation()}
                                        style={{
                                          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                                          minWidth: '200px', maxHeight: '260px', overflowY: 'auto',
                                          backgroundColor: 'white', border: '1px solid #c9c9c9', borderRadius: '6px',
                                          boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 10001, padding: '4px 0',
                                        }}
                                      >
                                        {options.length === 0 ? (
                                          <div style={{ padding: '10px 14px', fontSize: '12px', color: '#5c5c5c' }}>No options</div>
                                        ) : (
                                          <>
                                            {selected.size > 0 && (
                                              <button
                                                type="button"
                                                onClick={() => setSelected(new Set())}
                                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', border: 'none', background: 'none', color: '#0176D3', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                                              >
                                                Clear all
                                              </button>
                                            )}
                                            {options.map((src) => (
                                              <label
                                                key={src}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', fontSize: '13px', color: '#2e2e2e', cursor: 'pointer' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={selected.has(src)}
                                                  onChange={() => setSelected((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(src)) next.delete(src); else next.add(src);
                                                    return next;
                                                  })}
                                                  style={{ margin: 0, cursor: 'pointer' }}
                                                />
                                                {src}
                                              </label>
                                            ))}
                                          </>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );

                              // Removable source pills shown beneath a filter bar.
                              const pillColorSchemes = {
                                source: { color: '#001e5b', backgroundColor: '#e8f1fb', border: '1px solid #cfe0ff', close: '#0176D3' },
                                status: { color: '#0b6b4f', backgroundColor: '#e3f5ec', border: '1px solid #bfe6d3', close: '#0b6b4f' },
                              };
                              const renderPill = (
                                label: string,
                                onRemove: () => void,
                                scheme: { color: string; backgroundColor: string; border: string; close: string } = pillColorSchemes.source
                              ) => (
                                <span
                                  key={label}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 6px 3px 10px', fontSize: '12px', fontWeight: 600, color: scheme.color, backgroundColor: scheme.backgroundColor, border: scheme.border, borderRadius: '12px' }}
                                >
                                  {label}
                                  <button
                                    type="button"
                                    onClick={onRemove}
                                    aria-label={`Remove ${label} filter`}
                                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: scheme.close, display: 'inline-flex', alignItems: 'center' }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                                  </button>
                                </span>
                              );
                              const renderSourcePills = (
                                selected: Set<string>,
                                setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
                                scheme: { color: string; backgroundColor: string; border: string; close: string } = pillColorSchemes.source
                              ) => (
                                selected.size > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                                    {Array.from(selected).map((src) =>
                                      renderPill(src, () => setSelected((prev) => { const next = new Set(prev); next.delete(src); return next; }), scheme)
                                    )}
                                  </div>
                                ) : null
                              );

                              return (
                                <>
                                  {linePanelTab === 'attributes' && (<>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                    {renderFilterSearch(attrSearch, setAttrSearch, 'Search attributes')}
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2e2e2e', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                      <input
                                        type="checkbox"
                                        checked={attrUnmappedOnly}
                                        onChange={(e) => setAttrUnmappedOnly(e.target.checked)}
                                        style={{ cursor: 'pointer', margin: 0 }}
                                      />
                                      Show unmapped only
                                    </label>
                                    {renderSourceFilter(attrSourceFilter, setAttrSourceFilter, attrSourceMenuOpen, setAttrSourceMenuOpen)}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      {renderSourcePills(attrSourceFilter, setAttrSourceFilter)}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                                      <a
                                        href="#"
                                        onClick={(e) => { e.preventDefault(); expandAll(); }}
                                        style={{ fontSize: '13px', color: '#0176D3', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                                      >
                                        Expand all
                                      </a>
                                      <a
                                        href="#"
                                        onClick={(e) => { e.preventDefault(); collapseAll(); }}
                                        style={{ fontSize: '13px', color: '#0176D3', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                                      >
                                        Collapse all
                                      </a>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {visibleSections.length === 0 ? (
                                      <div style={{ padding: '16px', fontSize: '13px', color: '#5c5c5c', border: '1px solid #e5e5e5', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                                        {attrFiltersActive ? 'No attributes match the current filters.' : 'No attributes mapped.'}
                                      </div>
                                    ) : visibleSections.map((section) => {
                                      const dataCount = section.terms.filter(termHasData).length;
                                      // When a filter is active, default matching categories open so the
                                      // filtered rows are visible without an extra click — but still honor an
                                      // explicit collapse (via the section header or Expand/Collapse all).
                                      const isOpen = attrFiltersActive ? !canonicalCatClosed.has(section.category) : isCanonicalCatOpen(section.category, dataCount > 0);
                                      return (
                                        <div key={section.category} style={{ border: '1px solid #e5e5e5', borderRadius: '6px', overflow: 'hidden' }}>
                                          <button
                                            onClick={() => toggleCanonicalCat(section.category, isOpen)}
                                            style={{
                                              width: '100%',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              padding: '10px 14px',
                                              background: '#fafafa',
                                              border: 'none',
                                              borderBottom: isOpen ? '1px solid #e5e5e5' : 'none',
                                              cursor: 'pointer',
                                              textAlign: 'left',
                                            }}
                                          >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                              <svg width="12" height="12" viewBox="0 0 24 24" fill="#0176D3" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                                                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                                              </svg>
                                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>{section.category}</span>
                                              <span style={{ fontSize: '11px', color: '#706E6B' }}>· {dataCount} of {section.terms.length} mapped</span>
                                            </span>
                                          </button>
                                          {isOpen && (
                                            <div>
                                              <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                                backgroundColor: '#f3f3f3',
                                                borderBottom: '1px solid #c9c9c9',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: '#5c5c5c',
                                              }}>
                                                <div style={{ padding: '10px 12px' }}>Canonical Term</div>
                                                <div style={{ padding: '10px 12px' }}>Attribute</div>
                                                <div style={{ padding: '10px 12px' }}>Value</div>
                                                <div style={{ padding: '10px 12px' }}>Source</div>
                                              </div>
                                              {section.terms.map((term, idx) =>
                                                renderRecordTermRow(term, idx === section.terms.length - 1)
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  </>)}

                                  {linePanelTab === 'unmapped' && (
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>
                                        Extracted Data ({extractedFiltered.length}{extractedFiltered.length !== extractedItems.length ? ` of ${extractedItems.length}` : ''})
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                      {renderFilterSearch(unmappedSearch, setUnmappedSearch, 'Search extracted data')}
                                      {renderSourceFilter(unmappedSourceFilter, setUnmappedSourceFilter, unmappedSourceMenuOpen, setUnmappedSourceMenuOpen)}
                                      {renderSourceFilter(unmappedStatusFilter, setUnmappedStatusFilter, unmappedStatusMenuOpen, setUnmappedStatusMenuOpen, 'Status', allStatuses)}
                                    </div>
                                    {(unmappedSourceFilter.size > 0 || unmappedStatusFilter.size > 0) && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                                        {Array.from(unmappedSourceFilter).map((src) =>
                                          renderPill(src, () => setUnmappedSourceFilter((prev) => { const next = new Set(prev); next.delete(src); return next; }), pillColorSchemes.source)
                                        )}
                                        {Array.from(unmappedStatusFilter).map((st) =>
                                          renderPill(st, () => setUnmappedStatusFilter((prev) => { const next = new Set(prev); next.delete(st); return next; }), pillColorSchemes.status)
                                        )}
                                      </div>
                                    )}
                                    <div style={{ border: '1px solid #e5e5e5', borderRadius: '6px', overflow: 'hidden' }}>
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1.2fr 1fr 0.9fr 1fr 116px',
                                        alignItems: 'center',
                                        backgroundColor: '#f3f3f3',
                                        borderBottom: '1px solid #c9c9c9',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: '#5c5c5c',
                                      }}>
                                        <div style={{ padding: '10px 12px' }}>Attribute</div>
                                        <div style={{ padding: '10px 12px' }}>Value</div>
                                        <div style={{ padding: '10px 12px' }}>Source</div>
                                        <div style={{ padding: '10px 12px' }}>Override Value</div>
                                        <div style={{ padding: '10px 12px' }}>Status</div>
                                      </div>
                                      {extractedFiltered.length === 0 ? (
                                        <div style={{ padding: '16px', fontSize: '13px', color: '#5c5c5c' }}>
                                          {extractedItems.length === 0 ? 'No extracted data for this line.' : 'No extracted data matches the current filters.'}
                                        </div>
                                      ) : (
                                        extractedFiltered.map((it, idx) => {
                                          const isLast = idx === extractedFiltered.length - 1;
                                          const rowKey = `${lineId}::${it.attrKey}::${it.candidateIdx}`;
                                          const editActive = viewSourcesHoverRow === rowKey || viewSourcesEditingRow === rowKey;
                                          const { associated, selected } = itemAssociations(it);
                                          const status = selected.length > 0 ? 'Selected' : associated.length > 0 ? 'Associated' : 'Unassociated';
                                          const statusStyle = status === 'Selected'
                                            ? { color: '#2E844A', backgroundColor: '#e7f5ec', border: '1px solid #b5e0c4' }
                                            : status === 'Associated'
                                              ? { color: '#0176D3', backgroundColor: '#eef4ff', border: '1px solid #c3dbf7' }
                                              : { color: '#5c5c5c', backgroundColor: '#f3f3f3', border: '1px solid #dddbda' };
                                          return (
                                            <div
                                              key={it.itemId}
                                              style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1.2fr 1fr 0.9fr 1fr 116px',
                                                alignItems: 'stretch',
                                                borderBottom: isLast ? 'none' : '1px solid #e5e5e5',
                                                fontSize: '13px',
                                                backgroundColor: 'white',
                                              }}
                                            >
                                              <div title={it.field} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', color: '#001e5b', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive ? ROW_DIM_STYLE : {}) }}>{it.field}</div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', minWidth: 0, ...(editActive ? ROW_DIM_STYLE : {}) }}>
                                                <span title={it.value || undefined} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#2e2e2e', opacity: it.override ? 0.5 : 1 }}>
                                                  {it.value || <span style={{ color: '#939393' }}>—</span>}
                                                </span>
                                                <ConfidenceBadge score={it.confidence} />
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', minWidth: 0, ...(editActive ? ROW_DIM_STYLE : {}) }}>
                                                <button
                                                  onClick={() => openSourceViewer(it.attrKey, it.candidateIdx, 'unmapped')}
                                                  title={it.source || defaultSourceFor(activeLine.lineOfBusiness)}
                                                  style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer', color: '#0176D3', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', borderRadius: '4px', width: '100%', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                >
                                                  {it.source || defaultSourceFor(activeLine.lineOfBusiness)}
                                                </button>
                                              </div>
                                              <div
                                                onMouseEnter={() => setViewSourcesHoverRow(rowKey)}
                                                onMouseLeave={() => setViewSourcesHoverRow((prev) => prev === rowKey ? null : prev)}
                                                style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', ...(dirtyCells.has(`ov:${rowKey}`) ? DIRTY_CELL_STYLE : (editActive ? EDIT_CELL_STYLE : {})) }}
                                              >
                                                {renderOverrideCell(rowKey, it.override, true)}
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '10px 12px', ...(editActive ? ROW_DIM_STYLE : {}) }}>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (statusPopover && statusPopover.key === rowKey) {
                                                      setStatusPopover(null);
                                                    } else {
                                                      const r = e.currentTarget.getBoundingClientRect();
                                                      setStatusPopover({ key: rowKey, top: r.bottom + 4, left: Math.max(8, r.right - 260), associated, selected });
                                                    }
                                                  }}
                                                  title="View canonical-term associations"
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '3px 8px',
                                                    borderRadius: '11px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    ...statusStyle,
                                                  }}
                                                >
                                                  {status}
                                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                  )}
                                </>
                              );
                            })()}
                            </>)}

                            {linePanelTab === 'details' && (() => {
                              // Inline-editable field for any tree node (writes to panelFieldEdits, keyed by
                              // line id). Mirrors the LOB record page's Details tab EditableField look.
                              const PanelField = ({ fieldName, label, value, type = 'text', isLink = false }: {
                                fieldName: string; label: string; value: any; type?: 'text' | 'number'; isLink?: boolean;
                              }) => {
                                const editKey = `${activeLine.id}::${fieldName}`;
                                const isEditing = panelEditingField === editKey;
                                const isCellDirty = dirtyCells.has(`panel:${editKey}`);
                                const commit = () => {
                                  setPanelEditingField(null);
                                };
                                const isCurrency = type === 'number';
                                return (
                                  <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                                    <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>{label}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(isCellDirty ? { ...DIRTY_CELL_STYLE, padding: '2px 6px' } : {}) }}>
                                      {isEditing ? (
                                        <input
                                          type={type}
                                          value={value ?? ''}
                                          onChange={(e) => {
                                            // First change captures the pristine value (edit not yet applied this render).
                                            const had = editKey in panelFieldEdits;
                                            const prevVal = panelFieldEdits[editKey];
                                            markDirty(`panel:${editKey}`, () => setPanelFieldEdits((p) => {
                                              const n = { ...p };
                                              if (had) n[editKey] = prevVal; else delete n[editKey];
                                              return n;
                                            }));
                                            const raw = type === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : e.target.value;
                                            setPanelFieldEdits((prev) => ({ ...prev, [editKey]: raw }));
                                          }}
                                          onBlur={commit}
                                          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
                                          autoFocus
                                          style={{ fontSize: '13px', color: '#001e5b', border: '1px solid #0176D3', padding: '4px 8px', borderRadius: '4px', flex: 1, marginRight: '8px' }}
                                        />
                                      ) : (
                                        <div style={{ fontSize: '13px', color: isLink ? '#0176D3' : '#001e5b', flex: 1 }}>
                                          {isCurrency ? (value == null ? '—' : `$${Number(value).toLocaleString()}`) : (value || '—')}
                                        </div>
                                      )}
                                      <button
                                        onClick={() => setPanelEditingField(editKey)}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                          <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                );
                              };
                              const fv = (fieldName: string, fallback: any) => {
                                const editKey = `${activeLine.id}::${fieldName}`;
                                return editKey in panelFieldEdits ? panelFieldEdits[editKey] : fallback;
                              };
                              const hasFinancials = activeLine.coverageLimit != null || activeLine.deductible != null || activeLine.premiumAllocation != null || activeLine.insuredValue != null;
                              return (
                                <div>
                                  {/* Line Information Section */}
                                  <div style={{ marginBottom: '16px' }}>
                                    <div style={{ padding: '12px 16px', backgroundColor: '#f3f3f3', borderRadius: '4px 4px 0 0', fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>
                                      Line Information
                                    </div>
                                    <div style={{ backgroundColor: 'white', padding: '16px', border: '1px solid #e5e5e5', borderTop: 'none' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <PanelField fieldName="name" label="Line Name" value={fv('name', activeLine.name)} />
                                        <PanelField fieldName="lineType" label="Line Type" value={fv('lineType', activeLine.lineType)} />
                                        <PanelField fieldName="lineOfBusiness" label="Line of Business" value={fv('lineOfBusiness', activeLine.lineOfBusiness)} />
                                        <PanelField fieldName="status" label="Status" value={fv('status', activeLine.status)} />
                                        <PanelField fieldName="owner" label="Owner" value={fv('owner', activeLine.owner)} />
                                        <PanelField fieldName="parentRecord" label="Parent Record" value={parentRecordName(activeLine)} isLink />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Financial Information Section */}
                                  {hasFinancials && (
                                    <div style={{ marginBottom: '16px' }}>
                                      <div style={{ padding: '12px 16px', backgroundColor: '#f3f3f3', borderRadius: '4px 4px 0 0', fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>
                                        Financial Information
                                      </div>
                                      <div style={{ backgroundColor: 'white', padding: '16px', border: '1px solid #e5e5e5', borderTop: 'none' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                          {activeLine.insuredValue != null && (
                                            <PanelField fieldName="insuredValue" label="Insured Value" value={fv('insuredValue', activeLine.insuredValue)} type="number" />
                                          )}
                                          {activeLine.coverageLimit != null && (
                                            <PanelField fieldName="coverageLimit" label="Coverage Limit" value={fv('coverageLimit', activeLine.coverageLimit)} type="number" />
                                          )}
                                          {activeLine.deductible != null && (
                                            <PanelField fieldName="deductible" label="Deductible" value={fv('deductible', activeLine.deductible)} type="number" />
                                          )}
                                          {activeLine.premiumAllocation != null && (
                                            <PanelField fieldName="premiumAllocation" label="Premium Allocation" value={fv('premiumAllocation', activeLine.premiumAllocation)} type="number" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                      </div>
                      )}
                    </div>

                    {/* Save / Cancel footer — pinned to the viewport bottom (position:fixed) so it stays
                        visible while the page scrolls, and width-matched to the detail (right) pane via
                        measured metrics. `bottom` clamps to the pane's bottom edge once that edge scrolls
                        into view, so the footer rides up with the section end rather than overlapping it. */}
                    {isDirty && footerMetrics && (
                      <div style={{
                        position: 'fixed',
                        left: footerMetrics.left,
                        width: footerMetrics.width,
                        bottom: footerMetrics.bottom,
                        padding: '12px 20px',
                        backgroundColor: '#fafaf9',
                        borderTop: '1px solid #dddbda',
                        boxShadow: '0 -2px 6px rgba(0,0,0,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        zIndex: 20,
                        boxSizing: 'border-box',
                      }}>
                        <span style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#3e3e3c' }}>
                          You have unsaved changes.
                        </span>
                        <button
                          onClick={cancelDirty}
                          style={{ minWidth: '80px', height: '32px', padding: '0 16px', border: '1px solid #c9c9c9', borderRadius: '4px', backgroundColor: 'white', color: '#0176D3', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f4f6f9'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveDirty}
                          style={{ minWidth: '80px', height: '32px', padding: '0 16px', border: 'none', borderRadius: '4px', backgroundColor: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#014486'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0176D3'; }}
                        >
                          Save
                        </button>
                      </div>
                    )}

                    {/* Source picker modal */}
                    {sourcePickerAnchor && (() => {
                      const { lineId, attrKey } = sourcePickerAnchor;
                      const candidates = (sourcesByLine[lineId] || {})[attrKey] || [];
                      const editKey = `${lineId}::${attrKey}`;
                      const currentIdx = submissionLineSourceIdx[editKey] ?? 0;
                      const isEdited = !!submissionLineEdits[editKey];
                      const activeTabIdx = Math.min(sourcePickerActiveTab, Math.max(0, candidates.length - 1));
                      const activeCandidate = candidates[activeTabIdx];
                      return (
                        <div
                          style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10000,
                          }}
                          onClick={() => setSourcePickerAnchor(null)}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              width: '90vw',
                              maxWidth: '90vw',
                              height: '88vh',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
                            }}
                          >
                            <div style={{
                              padding: '16px 24px',
                              borderBottom: '1px solid #e5e5e5',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#001e5b', margin: 0 }}>
                                Select Source
                              </h2>
                              <button
                                onClick={() => setSourcePickerAnchor(null)}
                                title="Close"
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#5c5c5c">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                              </button>
                            </div>
                            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e5e5', minWidth: 0 }}>
                                <div style={{
                                  display: 'flex',
                                  borderBottom: '1px solid #e5e5e5',
                                  backgroundColor: '#fafafa',
                                  overflowX: 'auto',
                                  flexShrink: 0,
                                }}>
                                  {candidates.map((cand, i) => {
                                    const isActive = i === activeTabIdx;
                                    return (
                                      <button
                                        key={`tab-${cand.source}-${i}`}
                                        onClick={() => setSourcePickerActiveTab(i)}
                                        style={{
                                          padding: '10px 16px',
                                          border: 'none',
                                          background: isActive ? 'white' : 'transparent',
                                          borderBottom: isActive ? '2px solid #0176D3' : '2px solid transparent',
                                          color: isActive ? '#0176D3' : '#5c5c5c',
                                          fontSize: '13px',
                                          fontWeight: isActive ? 600 : 400,
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {cand.source}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div style={{
                                  flex: 1,
                                  overflowY: 'auto',
                                  backgroundColor: '#525659',
                                  padding: '24px',
                                }}>
                                  {(() => {
                                    const isChicagoAddress = lineId === 'a01SB00001p8B6rYAE' && attrKey === 'Address';
                                    if (!isChicagoAddress || !activeCandidate) {
                                      return (
                                        <div style={{
                                          height: '100%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#bdbdbd',
                                          fontSize: '13px',
                                          textAlign: 'center',
                                        }}>
                                          <div>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="#9e9e9e" style={{ marginBottom: '12px' }}>
                                              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                                            </svg>
                                            <div>Documents go here</div>
                                            {activeCandidate && (
                                              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                                                {activeCandidate.source}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }

                                    const highlight = (text: string, target: string) => {
                                      if (!target) return <>{text}</>;
                                      const idx = text.toLowerCase().indexOf(target.toLowerCase());
                                      if (idx < 0) return <>{text}</>;
                                      return (
                                        <>
                                          {text.slice(0, idx)}
                                          <mark style={{ backgroundColor: '#fff59d', padding: '0 2px', borderRadius: '2px', border: '1px solid #8a6d00', boxShadow: '0 0 0 1px #8a6d00' }}>
                                            {text.slice(idx, idx + target.length)}
                                          </mark>
                                          {text.slice(idx + target.length)}
                                        </>
                                      );
                                    };

                                    const pageStyle: React.CSSProperties = {
                                      backgroundColor: 'white',
                                      maxWidth: '720px',
                                      margin: '0 auto',
                                      padding: '40px 48px',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                      fontFamily: '"Times New Roman", Times, serif',
                                      color: '#1a1a1a',
                                      fontSize: '12px',
                                      lineHeight: 1.5,
                                    };

                                    if (activeCandidate.source === 'ACORD 140') {
                                      return (
                                        <div style={pageStyle}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                                            <div>
                                              <div style={{ fontSize: '10px', letterSpacing: '0.5px', color: '#5c5c5c' }}>ACORD®</div>
                                              <div style={{ fontSize: '16px', fontWeight: 700 }}>PROPERTY SECTION</div>
                                            </div>
                                            <div style={{ fontSize: '10px', textAlign: 'right' }}>
                                              <div>FORM 140 (2016/03)</div>
                                              <div>Page 1 of 4</div>
                                            </div>
                                          </div>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                            <tbody>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', width: '30%', fontWeight: 600 }}>AGENCY</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Vanguard Insurance Partners</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>NAMED INSURED</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>NexGen Biologics Inc</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>EFFECTIVE DATE</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>07/01/2026</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                          <div style={{ marginTop: '16px', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                            BLANKET SUMMARY / SCHEDULE OF LOCATIONS
                                          </div>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                                            <tbody>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', width: '15%', fontWeight: 600 }}>LOC #</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>1</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>STREET ADDRESS</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{highlight('1450 W Fulton St', '1450 W Fulton St')}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>CITY / STATE / ZIP</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Chicago, IL 60607</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>COUNTY</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Cook</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>OCCUPANCY</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Warehouse / Cold Storage — Pharmaceutical</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                          <div style={{ marginTop: '16px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>
                                            ACORD 140 (2016/03) © 2002–2016 ACORD CORPORATION. All rights reserved.
                                          </div>
                                        </div>
                                      );
                                    }

                                    if (activeCandidate.source === 'ACORD 125') {
                                      return (
                                        <div style={pageStyle}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                                            <div>
                                              <div style={{ fontSize: '10px', letterSpacing: '0.5px', color: '#5c5c5c' }}>ACORD®</div>
                                              <div style={{ fontSize: '16px', fontWeight: 700 }}>COMMERCIAL INSURANCE APPLICATION</div>
                                              <div style={{ fontSize: '11px' }}>Applicant Information Section</div>
                                            </div>
                                            <div style={{ fontSize: '10px', textAlign: 'right' }}>
                                              <div>FORM 125 (2016/03)</div>
                                              <div>Page 2 of 6</div>
                                            </div>
                                          </div>
                                          <div style={{ marginTop: '8px', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                            PREMISES INFORMATION
                                          </div>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                                            <tbody>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', width: '25%', fontWeight: 600 }}>LOCATION #</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>1</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>STREET</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{highlight('1450 West Fulton St', '1450 West Fulton St')}</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>CITY</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Chicago</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>STATE</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>IL</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>ZIP</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>60607</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>INTEREST</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Owner</td>
                                              </tr>
                                              <tr>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>DESCRIPTION OF OPERATIONS</td>
                                                <td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Pharmaceutical cold-chain warehouse and distribution center serving the Midwest region.</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                          <div style={{ marginTop: '16px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>
                                            ACORD 125 (2016/03) © 2002–2016 ACORD CORPORATION. All rights reserved.
                                          </div>
                                        </div>
                                      );
                                    }

                                    if (activeCandidate.source === 'Email') {
                                      return (
                                        <div style={{ ...pageStyle, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: '13px' }}>
                                          <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '12px', marginBottom: '12px' }}>
                                            <div style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b', marginBottom: '8px' }}>
                                              NexGen Biologics — Property Submission, Chicago Location
                                            </div>
                                            <table style={{ fontSize: '11px', color: '#5c5c5c' }}>
                                              <tbody>
                                                <tr><td style={{ paddingRight: '8px' }}><strong>From:</strong></td><td>Niki Paoloni &lt;niki.paoloni@vanguardins.com&gt;</td></tr>
                                                <tr><td style={{ paddingRight: '8px' }}><strong>To:</strong></td><td>Martha Reyes &lt;martha.reyes@nationalmutual.com&gt;</td></tr>
                                                <tr><td style={{ paddingRight: '8px' }}><strong>Date:</strong></td><td>Tuesday, June 2, 2026 9:14 AM</td></tr>
                                                <tr><td style={{ paddingRight: '8px' }}><strong>Subject:</strong></td><td>NexGen Biologics — New Business Submission</td></tr>
                                              </tbody>
                                            </table>
                                          </div>
                                          <p style={{ marginTop: 0 }}>Hi Martha,</p>
                                          <p>
                                            Submitting the new property quote for <strong>NexGen Biologics Inc</strong> with effective date 7/1/2026. They have three locations; details for the Chicago warehouse below — full ACORDs are attached.
                                          </p>
                                          <div style={{ backgroundColor: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '4px', padding: '12px 16px', marginTop: '8px' }}>
                                            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Location 1 — Chicago Warehouse</div>
                                            <div>Street Address: {highlight('1448 W Fulton Street, Chicago, IL 60607', '1448 W Fulton Street')}</div>
                                            <div>Year Built: 1998 (renovated 2019)</div>
                                            <div>Total Sq Ft: ~84,000</div>
                                            <div>Sprinkler System: Full Coverage</div>
                                            <div>Alarm System: Central Station</div>
                                          </div>
                                          <p>
                                            Please confirm receipt and let me know if you need anything else to bind. The insured is targeting an answer by EOW.
                                          </p>
                                          <p style={{ marginBottom: 0 }}>Thanks,<br />Niki Paoloni<br /><span style={{ color: '#5c5c5c', fontSize: '11px' }}>Vanguard Insurance Partners · (312) 555-0142</span></p>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div style={{
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#bdbdbd',
                                        fontSize: '13px',
                                      }}>
                                        Documents go here
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    backgroundColor: '#eaf3fc',
                                    border: '1px solid #b6d8f4',
                                    borderLeft: '4px solid #0176D3',
                                    borderRadius: '4px',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    color: '#014486',
                                    lineHeight: '17px',
                                    marginBottom: '12px',
                                  }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#0176D3" style={{ flexShrink: 0, marginTop: '1px' }}>
                                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                                    </svg>
                                    <span>Any value in <strong>Override Value</strong> will be used for that source.</span>
                                  </div>
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '40px 1.2fr 1fr 1fr 1.2fr',
                                    paddingBottom: '8px',
                                    borderBottom: '1px solid #e5e5e5',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#5c5c5c',
                                    columnGap: '12px',
                                  }}>
                                    <div />
                                    <div>Field</div>
                                    <div>Extracted Value</div>
                                    <div>Source</div>
                                    <div>Override Value</div>
                                  </div>
                                  <div style={{ marginTop: '4px' }}>
                                    {candidates.map((cand, i) => {
                                      const checked = !isEdited && i === currentIdx;
                                      const isLast = i === candidates.length - 1;
                                      const correctionKey = `${editKey}::${i}`;
                                      const corrected = manualCorrections[correctionKey] ?? '';
                                      return (
                                        <label
                                          key={`${cand.source}-${i}`}
                                          style={{
                                            display: 'grid',
                                            gridTemplateColumns: '40px 1.2fr 1fr 1fr 1.2fr',
                                            borderBottom: isLast ? 'none' : '1px solid #e5e5e5',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            color: '#2e2e2e',
                                            alignItems: 'center',
                                            padding: '10px 0',
                                            columnGap: '12px',
                                            backgroundColor: i === activeTabIdx ? '#f0f8ff' : 'transparent',
                                          }}
                                          onClick={() => setSourcePickerActiveTab(i)}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <input
                                              type="radio"
                                              name="source-picker"
                                              checked={checked}
                                              onChange={() => {
                                                setSubmissionLineSourceIdx((prev) => ({ ...prev, [editKey]: i }));
                                                setSubmissionLineEdits((prev) => {
                                                  if (!prev[editKey]) return prev;
                                                  const next = { ...prev };
                                                  delete next[editKey];
                                                  return next;
                                                });
                                                setSourcePickerActiveTab(i);
                                              }}
                                              style={{ accentColor: '#0176D3', cursor: 'pointer', margin: 0 }}
                                            />
                                          </div>
                                          <div>{cand.field}</div>
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <span>{cand.value}</span>
                                            {cand.updated && (
                                              <span
                                                title="Updated Value"
                                                aria-label="Updated Value"
                                                style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                                              >
                                                <Icon
                                                  category="utility"
                                                  name="refresh"
                                                  size="x-small"
                                                  className="slds-icon-text-error"
                                                />
                                              </span>
                                            )}
                                          </div>
                                          <div style={{ color: '#0176D3', fontWeight: 600 }}>{cand.source}</div>
                                          <div onClick={(e) => e.stopPropagation()}>
                                            <input
                                              type="text"
                                              value={corrected}
                                              placeholder="Enter override value"
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                setManualCorrections((prev) => {
                                                  const next = { ...prev };
                                                  if (v === '') delete next[correctionKey];
                                                  else next[correctionKey] = v;
                                                  return next;
                                                });
                                              }}
                                              style={{
                                                width: '100%',
                                                padding: '6px 8px',
                                                fontSize: '13px',
                                                border: '1px solid #c9c9c9',
                                                borderRadius: '4px',
                                                backgroundColor: 'white',
                                                color: '#2e2e2e',
                                                boxSizing: 'border-box',
                                              }}
                                            />
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div style={{
                              padding: '12px 24px',
                              borderTop: '1px solid #e5e5e5',
                              backgroundColor: '#fafafa',
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: '8px',
                            }}>
                              <button
                                onClick={() => setSourcePickerAnchor(null)}
                                style={{
                                  padding: '8px 20px',
                                  border: '1px solid #c9c9c9',
                                  borderRadius: '4px',
                                  backgroundColor: 'white',
                                  color: '#001e5b',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Close
                              </button>
                              <button
                                onClick={() => setSourcePickerAnchor(null)}
                                style={{
                                  padding: '8px 20px',
                                  border: 'none',
                                  borderRadius: '4px',
                                  backgroundColor: '#0176D3',
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Resolve Duplicates Modal */}
                    {isResolveDuplicatesOpen && (() => {
                      const categoryOrder: Array<'Location' | 'Building' | 'Equipment / Contents'> = ['Location', 'Building', 'Equipment / Contents'];
                      const filterVisible = (groups: string[][], resolutions: Record<string, string>) =>
                        groups.filter((g) => {
                          const r = resolutions[resolutionKeyFor(g)];
                          return r !== 'merged' && r !== 'not-merged';
                        });
                      const isMergeMode = mergeGroupIds !== null;
                      const groupsForCategory = filterVisible(duplicateGroups[duplicateCategory] || [], duplicateResolutions);
                      const totalInCategory = isMergeMode ? 1 : groupsForCategory.length;
                      const safeIdx = totalInCategory === 0 ? 0 : Math.min(comparisonIdx, totalInCategory - 1);
                      const activeGroup = isMergeMode ? (mergeGroupIds || []) : (groupsForCategory[safeIdx] || []);
                      const groupKey = activeGroup.length ? resolutionKeyFor(activeGroup) : '';
                      const existingResolution = isMergeMode ? undefined : (groupKey ? duplicateResolutions[groupKey] : undefined);

                      const closeModal = () => {
                        setIsResolveDuplicatesOpen(false);
                        setDuplicateSelections({});
                        setMergeGroupIds(null);
                      };

                      const handleMergeManual = () => {
                        if (groupKey) {
                          const orderedSelected = activeGroup.filter((lid) => duplicateSelections[lid]);
                          const unselected = activeGroup.filter((lid) => !duplicateSelections[lid]);
                          const sourceIds = [...orderedSelected, ...unselected];
                          if (sourceIds.length >= 2) {
                            setMergedGroups((prev) => ({ ...prev, [groupKey]: sourceIds }));
                            setDuplicateResolutions((prev) => ({ ...prev, [groupKey]: 'merged' }));
                          }
                        }
                        setTreeSelectedIds(new Set());
                        closeModal();
                      };

                      const setSelectionForGroup = (group: string[]) => {
                        const sel: Record<string, boolean> = {};
                        group.forEach((lid) => { sel[lid] = true; });
                        setDuplicateSelections(sel);
                      };

                      const advanceAfterAction = (action: 'merged' | 'not-merged' | 'skipped') => {
                        if (!groupKey) return;
                        const nextResolutions = { ...duplicateResolutions, [groupKey]: action };
                        setDuplicateResolutions(nextResolutions);
                        const isRemoved = action === 'merged' || action === 'not-merged';

                        const remainingHere = filterVisible(duplicateGroups[duplicateCategory] || [], nextResolutions);
                        if (isRemoved) {
                          if (remainingHere.length > 0) {
                            const nextIdx = Math.min(safeIdx, remainingHere.length - 1);
                            setComparisonIdx(nextIdx);
                            setSelectionForGroup(remainingHere[nextIdx]);
                            return;
                          }
                        } else {
                          if (safeIdx < remainingHere.length - 1) {
                            const nextIdx = safeIdx + 1;
                            setComparisonIdx(nextIdx);
                            setSelectionForGroup(remainingHere[nextIdx]);
                            return;
                          }
                        }
                        const currentCatIdx = categoryOrder.indexOf(duplicateCategory);
                        for (let i = currentCatIdx + 1; i < categoryOrder.length; i++) {
                          const nextCatGroups = filterVisible(duplicateGroups[categoryOrder[i]] || [], nextResolutions);
                          if (nextCatGroups.length > 0) {
                            setDuplicateCategory(categoryOrder[i]);
                            setComparisonIdx(0);
                            setSelectionForGroup(nextCatGroups[0]);
                            return;
                          }
                        }
                        closeModal();
                      };

                      const switchCategory = (cat: 'Location' | 'Building' | 'Equipment / Contents') => {
                        if (cat === duplicateCategory) return;
                        setDuplicateCategory(cat);
                        setComparisonIdx(0);
                        const firstGroup = filterVisible(duplicateGroups[cat] || [], duplicateResolutions)[0] || [];
                        setSelectionForGroup(firstGroup);
                      };

                      const handleDoNotMerge = () => advanceAfterAction('not-merged');
                      const handleSkip = () => advanceAfterAction('skipped');
                      const handleMergeSelected = () => {
                        if (groupKey) {
                          // Preserve the order the user selected in: selected ids in carousel order first,
                          // any unselected fall through (we still merge the whole group).
                          const orderedSelected = activeGroup.filter((lid) => duplicateSelections[lid]);
                          const unselected = activeGroup.filter((lid) => !duplicateSelections[lid]);
                          const sourceIds = [...orderedSelected, ...unselected];
                          if (sourceIds.length >= 2) {
                            setMergedGroups((prev) => ({ ...prev, [groupKey]: sourceIds }));
                          }
                        }
                        advanceAfterAction('merged');
                      };

                      const currentCatIdxForBack = categoryOrder.indexOf(duplicateCategory);
                      const prevCatWithGroups = (() => {
                        for (let i = currentCatIdxForBack - 1; i >= 0; i--) {
                          const groups = filterVisible(duplicateGroups[categoryOrder[i]] || [], duplicateResolutions);
                          if (groups.length > 0) return { cat: categoryOrder[i], groups };
                        }
                        return null;
                      })();
                      const canGoBack = safeIdx > 0 || prevCatWithGroups !== null;
                      const handleBack = () => {
                        if (safeIdx > 0) {
                          const prevIdx = safeIdx - 1;
                          setComparisonIdx(prevIdx);
                          setSelectionForGroup(groupsForCategory[prevIdx]);
                          return;
                        }
                        if (prevCatWithGroups) {
                          const lastIdx = prevCatWithGroups.groups.length - 1;
                          setDuplicateCategory(prevCatWithGroups.cat);
                          setComparisonIdx(lastIdx);
                          setSelectionForGroup(prevCatWithGroups.groups[lastIdx]);
                        }
                      };

                      const groupResolved = (g: string[]) => {
                        const r = duplicateResolutions[resolutionKeyFor(g)];
                        return r === 'merged' || r === 'not-merged';
                      };
                      const totalAcrossAll =
                        duplicateGroups['Location'].length +
                        duplicateGroups['Building'].length +
                        duplicateGroups['Equipment / Contents'].length;
                      const resolvedAcrossAll =
                        duplicateGroups['Location'].filter(groupResolved).length +
                        duplicateGroups['Building'].filter(groupResolved).length +
                        duplicateGroups['Equipment / Contents'].filter(groupResolved).length;
                      const remainingAcrossAll = totalAcrossAll - resolvedAcrossAll;
                      const globalPriorRemaining = categoryOrder
                        .slice(0, categoryOrder.indexOf(duplicateCategory))
                        .reduce(
                          (acc, c) => acc + filterVisible(duplicateGroups[c] || [], duplicateResolutions).length,
                          0
                        );
                      const globalPosition = totalInCategory === 0 ? 0 : globalPriorRemaining + safeIdx + 1;

                      const selectedCount = activeGroup.filter((lid) => duplicateSelections[lid]).length;
                      const canMerge = selectedCount >= 2;

                      const lineDataForGroup = activeGroup.map((lineId) => {
                        // Comparison table needs source-line attributes even after the group has been merged.
                        const line = baseLines.find((l) => l.id === lineId);
                        const attrs = line ? parseAttributes(line.lineAttributes, line.id) : [];
                        const valueFor = (attrKey: string) => {
                          if (!line) return { value: '', source: '' };
                          const editKey = `${line.id}::${attrKey}`;
                          const edited = submissionLineEdits[editKey];
                          const orig = attrs.find((a) => a.key === attrKey);
                          const candidates = (sourcesByLine[line.id] || {})[attrKey] || [];
                          const selectedSrcIdx = submissionLineSourceIdx[editKey] ?? 0;
                          const activeSource = edited ? null : (candidates[selectedSrcIdx] ?? null);
                          const displayValue = edited
                            ? edited.value
                            : (activeSource ? activeSource.value : (orig?.value || ''));
                          const displaySource = edited
                            ? 'Manually edited'
                            : (activeSource ? activeSource.source : defaultSourceFor(line.lineOfBusiness));
                          return { value: displayValue, source: displaySource };
                        };
                        const termToAttrKey: Record<string, string> = {};
                        attrs.forEach((a) => {
                          if (!line) return;
                          const term = effectiveCanonicalMappings[`${line.id}::${a.key}`];
                          if (term) termToAttrKey[term] = a.key;
                        });
                        const mappedKeys = new Set(Object.values(termToAttrKey));
                        const unmappedAttrs = attrs.filter((a) => !mappedKeys.has(a.key));
                        const children = line ? baseLines.filter((l) => l.parentLineId === line.id) : [];
                        return { line, attrs, valueFor, termToAttrKey, unmappedAttrs, children };
                      });

                      const lobForGroup = lineDataForGroup[0]?.line?.lineOfBusiness || null;
                      // All members of a duplicate group share the same lineType (the carousel buckets by it)
                      const lineTypeForGroup = lineDataForGroup[0]?.line?.lineType || null;
                      // Duplicate comparison uses the core term set so the carousel stays focused on
                      // the curated attributes, not the full enriched model.
                      const canonicalTermsForGroup = getCoreCanonicalTerms(lobForGroup, lineTypeForGroup);

                      // Row classification for the All / Matches / Differences filter.
                      // "matching"   = at least 2 cells populated and all populated cells share the same value
                      // "different"  = at least 2 cells populated and they don't all match
                      // "incomplete" = fewer than 2 populated cells (always shown under All only)
                      const classifyRow = (
                        cellValues: string[]
                      ): 'matching' | 'different' | 'incomplete' => {
                        const nonEmpty = cellValues.filter((v) => v && v.trim() !== '');
                        if (nonEmpty.length < 2) return 'incomplete';
                        return new Set(nonEmpty).size === 1 ? 'matching' : 'different';
                      };
                      const includeRow = (kind: 'matching' | 'different' | 'incomplete') => {
                        if (comparisonFilter === 'all') return true;
                        if (comparisonFilter === 'matches') return kind === 'matching';
                        return kind === 'different';
                      };

                      const colCount = activeGroup.length;
                      const tableGridTemplate = `200px repeat(${colCount}, minmax(220px, 1fr))`;

                      // Rows to show after the All / Matches / Differences filter. Computed here
                      // (not inside the table) so the empty-state message can render outside the
                      // horizontally-scrolling table and stay put.
                      const visibleRows = canonicalTermsForGroup
                        .map((term, idx) => {
                          const cellValues = lineDataForGroup.map((d) => {
                            const k = d.termToAttrKey[term];
                            return k ? d.valueFor(k).value : '';
                          });
                          return { term, idx, cellValues, kind: classifyRow(cellValues) };
                        })
                        .filter((r) => includeRow(r.kind));
                      const emptyComparisonMsg = comparisonFilter === 'differences'
                        ? 'No differences found — every canonical-term value matches across these submission lines.'
                        : comparisonFilter === 'matches'
                        ? 'No matching canonical-term values across these submission lines.'
                        : 'No canonical-term values to compare.';

                      const renderComparisonTable = () => (
                        <div style={{
                          border: '1px solid #c9c9c9',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          backgroundColor: 'white',
                        }}>
                          {/* Header row: per-line name + Select to Merge */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: tableGridTemplate,
                            borderBottom: '1px solid #c9c9c9',
                            backgroundColor: '#fafafa',
                          }}>
                            <div style={{
                              padding: '10px 12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#5c5c5c',
                              textTransform: 'uppercase',
                              letterSpacing: '0.4px',
                              borderRight: '1px solid #e5e5e5',
                            }}>
                              Canonical Term
                            </div>
                            {lineDataForGroup.map((d, i) => {
                              if (!d.line) return <div key={`h-${i}`} />;
                              const checked = !!duplicateSelections[d.line.id];
                              const isLast = i === lineDataForGroup.length - 1;
                              const parentChain: string[] = [];
                              let pid = effectiveParentId(d.line.id);
                              while (pid) {
                                const p = submissionLines.find((l) => l.id === pid);
                                if (!p) break;
                                if (p.lineType !== 'LOB') parentChain.unshift(p.name);
                                pid = effectiveParentId(p.id);
                              }
                              const parentPath = parentChain.length ? `${parentChain.join(' / ')} /` : null;
                              return (
                                <div
                                  key={d.line.id}
                                  style={{
                                    padding: '10px 12px',
                                    borderRight: isLast ? 'none' : '1px solid #e5e5e5',
                                    borderTop: checked ? '3px solid #0176D3' : '3px solid transparent',
                                    backgroundColor: checked ? '#f4f9ff' : 'transparent',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      {parentPath && (
                                        <div style={{ fontSize: '11px', color: '#5c5c5c', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {parentPath}
                                        </div>
                                      )}
                                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#001e5b', lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {d.line.name}
                                      </div>
                                    </div>
                                  </div>
                                  <label style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#001e5b',
                                  }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const next = e.target.checked;
                                        setDuplicateSelections((prev) => ({ ...prev, [d.line!.id]: next }));
                                      }}
                                      style={{ accentColor: '#0176D3', cursor: 'pointer', margin: 0 }}
                                    />
                                    Select to Merge
                                  </label>
                                </div>
                              );
                            })}
                          </div>

                          {/* AI Summary row — one per candidate, above the attribute comparison */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: tableGridTemplate,
                            borderBottom: '1px solid #e5e5e5',
                            backgroundColor: '#f6f9fe',
                            fontSize: '12px',
                          }}>
                            <div style={{
                              padding: '10px 12px',
                              borderRight: '1px solid #e5e5e5',
                              color: '#001e5b',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}>
                              <Icon category="utility" name="sparkles" size="xx-small" style={{ fill: '#0176D3' }} />
                              AI Summary
                            </div>
                            {lineDataForGroup.map((d, i) => {
                              const cellChecked = d.line ? !!duplicateSelections[d.line.id] : false;
                              const isLast = i === lineDataForGroup.length - 1;
                              if (!d.line) {
                                return <div key={`ai-${i}`} style={{ padding: '10px 12px', borderRight: isLast ? 'none' : '1px solid #e5e5e5' }} />;
                              }
                              const typeWord = (d.line.lineType || 'submission line').toLowerCase();
                              const mappedCount = Object.keys(d.termToAttrKey).length;
                              const summary = `${d.line.name} is a ${typeWord} with ${mappedCount} mapped attribute${mappedCount === 1 ? '' : 's'} and ${d.children.length} child record${d.children.length === 1 ? '' : 's'}. It closely matches the other candidate${lineDataForGroup.length > 2 ? 's' : ''} in this group and is a likely duplicate.`;
                              return (
                                <div key={`ai-${i}`} style={{
                                  padding: '10px 12px',
                                  borderRight: isLast ? 'none' : '1px solid #e5e5e5',
                                  color: '#3e3e3c',
                                  lineHeight: '17px',
                                  backgroundColor: cellChecked ? '#eef4fd' : 'transparent',
                                }}>
                                  {summary}
                                </div>
                              );
                            })}
                          </div>

                          {/* Canonical-term value rows — every term shown, mapped or not */}
                          {canonicalTermsForGroup.length === 0 ? (
                            <div style={{ padding: '14px 16px', fontSize: '12px', color: '#5c5c5c' }}>
                              No canonical terms defined for this line of business.
                            </div>
                          ) : visibleRows.length === 0 ? null : (() => {
                            return visibleRows.map(({ term, idx }) => {
                              return (
                                <div
                                  key={term}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: tableGridTemplate,
                                    borderBottom: '1px solid #e5e5e5',
                                    backgroundColor: idx % 2 === 0 ? '#fbfbfb' : 'white',
                                    fontSize: '13px',
                                  }}
                                >
                                  <div style={{
                                    padding: '10px 12px',
                                    borderRight: '1px solid #e5e5e5',
                                    color: '#001e5b',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}>
                                    {term}
                                  </div>
                                  {lineDataForGroup.map((d, i) => {
                                    const attrKey = d.termToAttrKey[term];
                                    const cellChecked = d.line ? !!duplicateSelections[d.line.id] : false;
                                    const isLast = i === lineDataForGroup.length - 1;
                                    if (!attrKey || !d.line) {
                                      return (
                                        <div key={`${term}-${i}`} style={{
                                          padding: '10px 12px',
                                          borderRight: isLast ? 'none' : '1px solid #e5e5e5',
                                          color: '#939393',
                                          backgroundColor: cellChecked ? '#f4f9ff' : 'transparent',
                                        }}>—</div>
                                      );
                                    }
                                    const { value } = d.valueFor(attrKey);
                                    return (
                                      <div key={`${term}-${i}`} style={{
                                        padding: '10px 12px',
                                        borderRight: isLast ? 'none' : '1px solid #e5e5e5',
                                        color: '#2e2e2e',
                                        backgroundColor: cellChecked ? '#f4f9ff' : 'transparent',
                                      }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {value || <span style={{ color: '#939393' }}>—</span>}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      );

                      return (
                        <div
                          style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10000,
                          }}
                          onClick={closeModal}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              width: '90vw',
                              maxWidth: '90vw',
                              height: '88vh',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
                            }}
                          >
                            {/* Header */}
                            <div style={{
                              padding: '16px 24px',
                              borderBottom: '1px solid #e5e5e5',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#001e5b', margin: 0 }}>
                                {isMergeMode ? 'Merge Submission Lines' : 'Resolve Duplicate Submission Lines'}
                              </h2>
                              <button
                                onClick={closeModal}
                                title="Close"
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#5c5c5c">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                              </button>
                            </div>

                            {/* Category tabs (horizontal) */}
                            {!isMergeMode && <div style={{
                              display: 'flex',
                              borderBottom: '1px solid #e5e5e5',
                              backgroundColor: '#fafafa',
                              padding: '0 20px',
                              gap: '4px',
                              flexShrink: 0,
                            }}>
                              {categoryOrder
                                .filter((cat) => filterVisible(duplicateGroups[cat] || [], duplicateResolutions).length > 0)
                                .map((cat) => {
                                  const remaining = filterVisible(duplicateGroups[cat] || [], duplicateResolutions).length;
                                  const isActive = duplicateCategory === cat;
                                  return (
                                    <button
                                      key={cat}
                                      onClick={() => switchCategory(cat)}
                                      style={{
                                        padding: '12px 16px',
                                        border: 'none',
                                        background: 'none',
                                        borderBottom: isActive ? '2px solid #0176D3' : '2px solid transparent',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '-1px',
                                      }}
                                    >
                                      <span style={{
                                        fontSize: '13px',
                                        fontWeight: isActive ? 600 : 500,
                                        color: isActive ? '#0176D3' : '#2e2e2e',
                                      }}>
                                        {cat === 'Equipment / Contents' ? 'Equipment' : cat}
                                      </span>
                                      <span style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: '#5c3a00',
                                        backgroundColor: '#fef5e8',
                                        border: '1px solid #f5b87c',
                                        padding: '1px 7px',
                                        borderRadius: '10px',
                                      }}>
                                        {remaining}
                                      </span>
                                    </button>
                                  );
                                })}
                            </div>}

                            {/* Body */}
                            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                              {/* Right panel - comparison */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                {/* Instruction banner */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '8px',
                                  padding: '10px 20px',
                                  backgroundColor: '#eef4ff',
                                  borderBottom: '1px solid #cfe0ff',
                                  fontSize: '12px',
                                  color: '#001e5b',
                                  lineHeight: '17px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0176D3" style={{ flexShrink: 0, marginTop: '1px' }}>
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-6h2v6zm0-8h-2V7h2v4z"/>
                                  </svg>
                                  <span>
                                    {isMergeMode ? (
                                      <>Compare the selected records below. Cards left checked with <strong>Select to Merge</strong> will be combined into a single submission line on <strong>Merge Selected</strong>.</>
                                    ) : (
                                      <>Compare the records below and choose an action. Resolve duplicates in the order <strong>Location → Building → Equipment</strong>.
                                      Cards selected with <strong>Select to Merge</strong> will be combined into a single submission line on Merge Selected.</>
                                    )}
                                  </span>
                                </div>

                                {/* Comparison area */}
                                <div style={{ flex: 1, padding: '16px 20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                  {existingResolution && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                                      <span style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        backgroundColor: existingResolution === 'merged' ? '#e7f5ec' : existingResolution === 'not-merged' ? '#f3f3f3' : '#fef5e8',
                                        color: existingResolution === 'merged' ? '#1a4f2c' : existingResolution === 'not-merged' ? '#3e3e3e' : '#5c3a00',
                                        border: existingResolution === 'merged' ? '1px solid #2E844A' : existingResolution === 'not-merged' ? '1px solid #939393' : '1px solid #f5b87c',
                                      }}>
                                        {existingResolution === 'merged' ? 'Merged' : existingResolution === 'not-merged' ? 'Not duplicates' : 'Skipped'}
                                      </span>
                                    </div>
                                  )}
                                  {totalInCategory === 0 ? (
                                    <div style={{ padding: '24px', fontSize: '13px', color: '#5c5c5c' }}>
                                      No duplicate {duplicateCategory.toLowerCase()} records to review.
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{
                                        display: 'inline-flex',
                                        alignSelf: 'flex-start',
                                        marginBottom: '12px',
                                        border: '1px solid #c9c9c9',
                                        borderRadius: '999px',
                                        backgroundColor: '#fff',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                      }}>
                                        {(['all', 'matches', 'differences'] as const).map((opt) => {
                                          const isActive = comparisonFilter === opt;
                                          const label = opt === 'all' ? 'All' : opt === 'matches' ? 'Matches' : 'Differences';
                                          return (
                                            <button
                                              key={opt}
                                              onClick={() => setComparisonFilter(opt)}
                                              style={{
                                                padding: '6px 16px',
                                                border: 'none',
                                                background: isActive ? '#0176D3' : 'transparent',
                                                color: isActive ? '#fff' : '#001e5b',
                                                fontSize: '12px',
                                                fontWeight: isActive ? 600 : 500,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              {label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <div style={{
                                        flex: visibleRows.length === 0 ? '0 0 auto' : 1,
                                        overflowX: 'auto',
                                        overflowY: 'auto',
                                        paddingBottom: '8px',
                                        minHeight: 0,
                                      }}>
                                        {renderComparisonTable()}
                                      </div>
                                      {visibleRows.length === 0 && (
                                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#5c5c5c', flexShrink: 0 }}>
                                          {emptyComparisonMsg}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Footer with progress + actions */}
                                <div style={{
                                  padding: '12px 20px',
                                  borderTop: '1px solid #e5e5e5',
                                  backgroundColor: '#fafafa',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '12px',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {isMergeMode ? (
                                      <button
                                        onClick={closeModal}
                                        style={{
                                          padding: '8px 16px',
                                          border: '1px solid #c9c9c9',
                                          borderRadius: '4px',
                                          backgroundColor: 'white',
                                          color: '#001e5b',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          onClick={handleBack}
                                          disabled={!canGoBack}
                                          style={{
                                            padding: '8px 16px',
                                            border: '1px solid #c9c9c9',
                                            borderRadius: '4px',
                                            backgroundColor: 'white',
                                            color: '#001e5b',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: canGoBack ? 'pointer' : 'not-allowed',
                                            opacity: canGoBack ? 1 : 0.5,
                                          }}
                                        >
                                          Back
                                        </button>
                                        <div style={{
                                          width: '160px',
                                          height: '6px',
                                          borderRadius: '3px',
                                          backgroundColor: '#e5e5e5',
                                          overflow: 'hidden',
                                        }}>
                                          {(() => {
                                            const totalInCat = (duplicateGroups[duplicateCategory] || []).length;
                                            const resolvedInCat = (duplicateGroups[duplicateCategory] || []).filter(groupResolved).length;
                                            return (
                                              <div style={{
                                                height: '100%',
                                                width: totalInCat === 0 ? '0%' : `${(resolvedInCat / totalInCat) * 100}%`,
                                                backgroundColor: '#2E844A',
                                                transition: 'width 200ms ease',
                                              }} aria-label={`${resolvedInCat} of ${totalInCat} resolved`} />
                                            );
                                          })()}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    {!isMergeMode && (
                                      <>
                                        <button
                                          onClick={handleDoNotMerge}
                                          disabled={totalInCategory === 0}
                                          style={{
                                            padding: '8px 16px',
                                            border: '1px solid #c9c9c9',
                                            borderRadius: '4px',
                                            backgroundColor: 'white',
                                            color: '#001e5b',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: totalInCategory === 0 ? 'not-allowed' : 'pointer',
                                            opacity: totalInCategory === 0 ? 0.5 : 1,
                                          }}
                                        >
                                          Do Not Merge
                                        </button>
                                        <button
                                          onClick={handleSkip}
                                          disabled={totalInCategory === 0}
                                          style={{
                                            padding: '8px 16px',
                                            border: '1px solid #c9c9c9',
                                            borderRadius: '4px',
                                            backgroundColor: 'white',
                                            color: '#001e5b',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: totalInCategory === 0 ? 'not-allowed' : 'pointer',
                                            opacity: totalInCategory === 0 ? 0.5 : 1,
                                          }}
                                        >
                                          Skip
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={isMergeMode ? handleMergeManual : handleMergeSelected}
                                      disabled={!canMerge}
                                      style={{
                                        padding: '8px 16px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: canMerge ? '#0176D3' : '#a0c5e8',
                                        color: 'white',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: canMerge ? 'pointer' : 'not-allowed',
                                      }}
                                    >
                                      Merge Selected
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Mixed-type merge warning */}
                    {mergeTypeWarning && (
                      <div
                        style={{
                          position: 'fixed',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10001,
                        }}
                        onClick={() => setMergeTypeWarning(null)}
                      >
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            width: '420px',
                            maxWidth: '90vw',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ padding: '20px 24px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="#B85C00" style={{ flexShrink: 0, marginTop: '1px' }}>
                              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                            </svg>
                            <div>
                              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#001e5b', margin: '0 0 6px 0' }}>
                                Can&apos;t merge different record types
                              </h2>
                              <p style={{ fontSize: '13px', color: '#3e3e3c', margin: 0, lineHeight: '19px' }}>
                                {mergeTypeWarning}
                              </p>
                            </div>
                          </div>
                          <div style={{
                            padding: '12px 24px',
                            backgroundColor: '#fafaf9',
                            borderTop: '1px solid #e5e5e5',
                            display: 'flex',
                            justifyContent: 'flex-end',
                          }}>
                            <button
                              onClick={() => setMergeTypeWarning(null)}
                              style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '4px',
                                backgroundColor: '#0176D3',
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              OK
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* View Sources modal — list canonical terms as cards, expandable to show
                        the full Field/Extracted/Source/Override table; left pane shows the
                        source document with a highlight on the actively-clicked row's value. */}
                    {lineSourceViewer && (() => {
                      const { lineId, sources, activeIdx } = lineSourceViewer;
                      const isReconcile = lineSourceViewer.mode === 'reconcile';
                      // Single-term mode (opened from a record-view canonical-term Source cell):
                      // render exactly one term box, no tabs, no "only-active-doc" checkbox.
                      const singleTerm = lineSourceViewer.term || null;
                      // Reconcile queue: unresolved lines with any live discrepancy, plus the currently-open
                      // line (so it stays visible in the list until Save & Next marks it resolved).
                      const reconcileList = submissionLines
                        .filter((l) => l.id === lineId || (!reconcileResolvedLines.has(l.id) && lineDiscrepancyState(l.id).hasAny))
                        .map((l) => l.id);
                      const lineRecord = submissionLines.find((l) => l.id === lineId);
                      const lineAttrs = parseAttributes(lineRecord?.lineAttributes, lineRecord?.id);
                      const lineSources = sourcesByLine[lineId] || {};
                      const lineCanonicalKey = lineRecord ? lineRecord.id : '';

                      // For the document highlight: the active row drives which source tab is
                      // selected and which value to highlight. Falls back to the active source
                      // tab if no row is selected.
                      const activeRow = viewSourcesActiveRow;
                      const activeRowCandidates = activeRow ? (lineSources[activeRow.attrKey] || []) : [];
                      const activeRowCandidate = activeRow ? activeRowCandidates[activeRow.candidateIdx] : null;
                      // When an unmapped attribute is selected, its value/source drive the highlight instead.
                      const unmappedSelCandidates = viewSourcesUnmappedAttr ? (lineSources[viewSourcesUnmappedAttr] || []) : [];
                      const unmappedSelCandidate = unmappedSelCandidates[0] || null;
                      const activeSourceName = activeRowCandidate?.source || unmappedSelCandidate?.source || sources[activeIdx];
                      const highlightValue = activeRowCandidate?.value || unmappedSelCandidate?.value || '';

                      const closeModal = () => {
                        // Revert any uncommitted dirty cells — closing without Save/Save & Next discards
                        // edits (Save/goReconSaveNext call saveDirty first, so this is a no-op there).
                        cancelDirty();
                        setLineSourceViewer(null);
                        setViewSourcesExpandedAttr(null);
                        setViewSourcesActiveRow(null);
                        setViewSourcesHoveredAttr(null);
                        setViewSourcesOnlyActiveDoc(false);
                        setViewSourcesTab('mapped');
                        setViewSourcesUnmappedAttr(null);
                        setViewSourcesUnmappedGroup(null);
                        setViewSourcesMappedGroup(null);
                        setViewSourcesMapPickerAttr(null);
                        setViewSourcesMapPickerSearch('');
                        setViewSourcesMapPickerRect(null);
                        // Mapping data (viewSourcesRowMap / viewSourcesTermPref / viewSourcesTermManual /
                        // viewSourcesOverride) is intentionally NOT reset here — it persists across
                        // close/reopen and reloads.
                        setViewSourcesEditingRow(null);
                        setViewSourcesEditingManual(null);
                        setViewSourcesManualActive(false);
                        setStatusPopover(null);
                        setReconcileDocMenuOpen(false);
                        setReconcileTreeCollapsed(new Set());
                        setReconcileQueueWidth(260);
                        setDocZoom(1);
                        // Drop the sticky Discrepancies snapshot so a reopen re-derives from live state.
                        discStickyRef.current = { lineId: null, terms: new Set() };
                      };

                      // Live discrepancy state for the open line — drives the reconcile-mode indicators.
                      const disc = lineDiscrepancyState(lineId);
                      // Canonical terms flagged with any discrepancy — feeds the Discrepancies tab (and its count).
                      // "Mark all as resolved" (reconcileResolvedLines) clears the line's discrepancies wholesale.
                      const isLineResolved = reconcileResolvedLines.has(lineId);
                      // Terms flagged live by the detector this render.
                      const liveDiscTerms = [...disc.unmappedTerms, ...disc.unresolvedSource, ...disc.lowConfidence];
                      // Sticky membership: once a term surfaces as a discrepancy it stays in the tab until
                      // "Mark as Resolved". Associating an attribute clears the live discrepancy but keeps the
                      // box in place (re-snapshotted per line; cleared in closeModal so a reopen starts fresh).
                      if (discStickyRef.current.lineId !== lineId) {
                        discStickyRef.current = { lineId, terms: new Set(liveDiscTerms) };
                      } else {
                        liveDiscTerms.forEach((t) => discStickyRef.current.terms.add(t));
                      }
                      const discTermSet = isLineResolved
                        ? new Set<string>()
                        : new Set<string>(Array.from(discStickyRef.current.terms)
                            .filter((t) => !reconcileResolvedTerms.has(`${lineId}::${t}`)));
                      const discCount = discTermSet.size;
                      // Switch the modal to another submission line (reconcile-mode left-list navigation).
                      const switchToLine = (nextId: string) => {
                        const rec = submissionLines.find((l) => l.id === nextId);
                        if (!rec) return;
                        setViewSourcesExpandedAttr(null);
                        setViewSourcesActiveRow(null);
                        setViewSourcesManualActive(false);
                        setViewSourcesUnmappedAttr(null);
                        setViewSourcesUnmappedGroup(null);
                        setViewSourcesMappedGroup(null);
                        setStatusPopover(null);
                        setViewSourcesTab('discrepancies');
                        setLineSourceViewer({ lineId: nextId, sources: buildLineSources(nextId, rec.lineOfBusiness), activeIdx: 0, mode: 'reconcile' });
                      };
                      const reconcileIdx = reconcileList.indexOf(lineId);
                      const goReconPrev = () => {
                        if (reconcileIdx > 0) guardNav(() => switchToLine(reconcileList[reconcileIdx - 1]));
                      };
                      const goReconSkip = () => {
                        const next = reconcileList[reconcileIdx + 1];
                        guardNav(() => { if (next) switchToLine(next); else closeModal(); });
                      };
                      const goReconSaveNext = () => {
                        saveDirty();
                        setReconcileResolvedLines((prev) => {
                          const nextSet = new Set(prev);
                          nextSet.add(lineId);
                          return nextSet;
                        });
                        // Advance to the next still-unresolved line in the queue (excluding the one just resolved).
                        const next = reconcileList.find((id) => id !== lineId && !reconcileResolvedLines.has(id));
                        if (next) switchToLine(next); else closeModal();
                      };

                      // Enrichment-API vendors get a distinct teal family (blue reserved for links).
                      const enrichmentSources = new Set(['Verisk 360', 'CoreLogic', 'ISO', 'RMS CatModel', 'FEMA NFIP', 'USGS', 'D&B', 'LexisNexis CLUE', 'NCCI']);
                      const isEnrichmentSource = (src: string): boolean => enrichmentSources.has(src);
                      // Per-source palette — green / purple / orange / teal (blue reserved for links).
                      // Document color coding removed — all sources render in a neutral grey family.
                      const sourceColor = (_src: string): string => '#5c5c5c';
                      const sourcePastel = (_src: string): string => '#f3f3f3';

                      // Build the list of canonical terms to display: every attribute on the line
                      // that has at least one extraction candidate, or that has a defined value.
                      type CardEntry = { attrKey: string; value: string; source: string; candidates: Array<{ field: string; value: string; source: string; updated?: boolean }> };
                      const cards: CardEntry[] = lineAttrs.map((attr) => {
                        const candidates = lineSources[attr.key] || [];
                        const editKey = `${lineId}::${attr.key}`;
                        const edited = submissionLineEdits[editKey];
                        const flagged = isAttrFlagged(lineId, attr.key);
                        const selectedIdx = submissionLineSourceIdx[editKey] ?? (flagged && candidates.length > 1 ? -1 : 0);
                        const active = edited
                          ? null
                          : selectedIdx >= 0 && candidates[selectedIdx]
                            ? candidates[selectedIdx]
                            : null;
                        const value = edited
                          ? edited.value
                          : flagged && candidates.length > 1 && selectedIdx < 0
                            ? ''
                            : active
                              ? active.value
                              : attr.value;
                        const source = edited
                          ? 'Manually edited'
                          : flagged && candidates.length > 1 && selectedIdx < 0
                            ? ''
                            : active
                              ? active.source
                              : defaultSourceFor(lineRecord?.lineOfBusiness);
                        return { attrKey: attr.key, value, source, candidates };
                      });

                      // Pool model: flatten every card into its individual extraction rows. Each row is an
                      // atomic pool item — always either mapped to a canonical term or in the unmapped pool.
                      type PoolItem = { itemId: string; attrKey: string; candidateIdx: number; field: string; value: string; override: string; displayValue: string; source: string; confidence: number; updated?: boolean };
                      const canonicalTermCatalog = getCanonicalTermOptions(lineRecord?.lineOfBusiness, lineRecord?.lineType);
                      // A row's canonical term: explicit row override wins, else inherit the attribute's mapping
                      // (only the attribute's *selected* candidate inherits, so a default mapping seeds one row).
                      const rowTermFor = (attrKey: string, candidateIdx: number, isSelected: boolean): string => {
                        const rowKey = `${lineId}::${attrKey}::${candidateIdx}`;
                        if (rowKey in viewSourcesRowMap) return viewSourcesRowMap[rowKey];
                        const mapping = effectiveCanonicalMappings[`${lineId}::${attrKey}`] || '';
                        if (isSelected) return mapping;
                        // Step 4 (Pricing & Quoting): an enrichment candidate maps to its attribute's
                        // canonical term IN ADDITION to the existing selected source, so the term shows
                        // multiple sources without displacing the existing (doc/email) winner.
                        if (lineStep >= 4 && mapping && isEnrichmentSourceName((lineSources[attrKey] || [])[candidateIdx]?.source || '')) return mapping;
                        return '';
                      };
                      const poolItems: PoolItem[] = [];
                      cards.forEach((c) => {
                        const editKey = `${lineId}::${c.attrKey}`;
                        const cands = c.candidates.length > 0
                          ? c.candidates
                          : [{ field: c.attrKey, value: c.value, source: c.source }];
                        const selIdx = Math.max(0, submissionLineSourceIdx[editKey] ?? 0);
                        cands.forEach((cand, i) => {
                          const override = viewSourcesOverride[`${lineId}::${c.attrKey}::${i}`] || '';
                          poolItems.push({
                            itemId: `${c.attrKey}::${i}`,
                            attrKey: c.attrKey,
                            candidateIdx: i,
                            field: cand.field,
                            value: cand.value,
                            override,
                            displayValue: override || cand.value,
                            source: cand.source,
                            confidence: confidenceFor(lineId, c.attrKey, cand.value, cand.source),
                            updated: (cand as any).updated,
                          });
                        });
                        void selIdx;
                      });
                      const itemTerm = (it: PoolItem): string => {
                        const editKey = `${lineId}::${it.attrKey}`;
                        const selIdx = Math.max(0, submissionLineSourceIdx[editKey] ?? 0);
                        return rowTermFor(it.attrKey, it.candidateIdx, it.candidateIdx === selIdx);
                      };
                      // All canonical terms a row belongs to: its primary term (via itemTerm) plus any
                      // extra associations. An attribute can sit in several Canonical boxes at once.
                      const itemAllTerms = (it: PoolItem): string[] => {
                        const all: string[] = [];
                        const primary = itemTerm(it);
                        if (primary) all.push(primary);
                        (viewSourcesExtraTerms[`${lineId}::${it.attrKey}::${it.candidateIdx}`] || []).forEach((t) => {
                          if (t && !all.includes(t)) all.push(t);
                        });
                        return all;
                      };
                      const itemInActiveDoc = (it: PoolItem) => !!it.source && it.source === activeSourceName && !!it.value;

                      const mappedItems = poolItems.filter((it) => itemAllTerms(it).length > 0);
                      const unmappedItems = poolItems.filter((it) => itemAllTerms(it).length === 0);

                      // Mapped rows grouped by canonical term. Every catalog term gets a box (so a term's box
                      // remains even after its last row returns to the pool); non-catalog terms are appended.
                      const mappedByTerm = new Map<string, PoolItem[]>();
                      const mappedVisible = viewSourcesOnlyActiveDoc ? mappedItems.filter(itemInActiveDoc) : mappedItems;
                      mappedVisible.forEach((it) => {
                        itemAllTerms(it).forEach((term) => {
                          if (!mappedByTerm.has(term)) mappedByTerm.set(term, []);
                          mappedByTerm.get(term)!.push(it);
                        });
                      });
                      const mappedTermOrder = [
                        ...canonicalTermCatalog,
                        ...Array.from(mappedByTerm.keys()).filter((t) => !canonicalTermCatalog.includes(t)),
                      ];
                      const mappedGroups: Array<[string, PoolItem[]]> = mappedTermOrder.map((term) => [term, mappedByTerm.get(term) || []]);
                      // If the Discrepancies tab is active but has just been emptied (e.g. Mark all as resolved),
                      // fall back to All Canonical so the pane isn't stranded on a hidden tab.
                      const activeTab = (viewSourcesTab === 'discrepancies' && discCount === 0) ? 'mapped' : viewSourcesTab;
                      // Discrepancies tab reuses the canonical-box render, filtered to flagged terms only.
                      const shownGroups = activeTab === 'discrepancies'
                        ? mappedGroups.filter(([term]) => discTermSet.has(term))
                        : mappedGroups;
                      // Single-term mode renders exactly one box for the requested canonical term.
                      const singleTermGroup: [string, PoolItem[]] | null = singleTerm
                        ? (mappedGroups.find(([t]) => t === singleTerm) || [singleTerm, mappedByTerm.get(singleTerm) || []])
                        : null;
                      // In single-term mode the doc tabs are scoped to the sources of the term's
                      // *mapped* extractions — derived live so removing/mapping a row updates the
                      // tab list. Empty until at least one attribute is mapped to the term.
                      const singleTermSources: string[] | null = singleTermGroup
                        ? Array.from(new Set(singleTermGroup[1].map((it) => it.source).filter(Boolean)))
                        : null;
                      const docSources = singleTermSources || sources;
                      // In single-term mode, keep the active doc tab within the live scoped list
                      // (the captured `sources[activeIdx]` can drift as rows are mapped/removed).
                      const viewerSource = singleTerm
                        ? (docSources.includes(activeSourceName) ? activeSourceName : (docSources[activeIdx] || docSources[0] || ''))
                        : activeSourceName;
                      // Shared handler for clicking a hotspot in ANY doc viewer (PDF/doc <mark>,
                      // image bounding box, XLS cell): resolve the extraction it represents, surface
                      // its right-pane row (expanding a collapsed term box first), and highlight it.
                      // A top-level effect keyed on viewSourcesActiveRow does the actual scroll.
                      const activateDocRow = (attrKey: string, value?: string) => {
                        const pool = [...mappedItems, ...unmappedItems];
                        const norm = (s: string) => (s || '').trim().toLowerCase();
                        const candidates = pool.filter((it) => it.attrKey === attrKey);
                        const target = candidates.find((it) => it.source === activeSourceName)
                          || (value ? candidates.find((it) => norm(it.value) === norm(value)) : undefined)
                          || candidates[0];
                        if (!target) return;
                        setViewSourcesManualActive(false);
                        const term = itemTerm(target);
                        if (term) {
                          if (viewSourcesTab !== 'discrepancies' || !discTermSet.has(term)) setViewSourcesTab('mapped');
                          setViewSourcesMappedGroup(term);
                          setViewSourcesExpandedAttr(target.attrKey);
                        } else {
                          setViewSourcesTab('unmapped');
                        }
                        setViewSourcesActiveRow({ attrKey: target.attrKey, candidateIdx: target.candidateIdx });
                        const tabIdx = sources.indexOf(target.source);
                        if (tabIdx >= 0) setLineSourceViewer((prev) => prev ? { ...prev, activeIdx: tabIdx } : prev);
                      };
                      // Group the shown term-boxes into canonical categories (mirrors the record view and
                      // the Enrichment tab). Each section carries its terms + how many hold a mapped value.
                      const groupHasData = ([, items]: [string, PoolItem[]]) => items.length > 0;
                      const shownGroupMap = new Map(shownGroups.map((g) => [g[0], g] as [string, [string, PoolItem[]]]));
                      const modalSections = groupTermsByCategory(
                        lineRecord?.lineOfBusiness,
                        lineRecord?.lineType,
                        shownGroups.map(([term]) => term)
                      ).map((section) => {
                        const groups = section.terms
                          .map((t) => shownGroupMap.get(t))
                          .filter(Boolean) as Array<[string, PoolItem[]]>;
                        const dataCount = groups.filter(groupHasData).length;
                        return { category: section.category, groups, dataCount };
                      }).filter((s) => s.groups.length > 0);

                      // Unmapped pool — flat, sorted by attribute name then source.
                      const unmappedVisible = viewSourcesOnlyActiveDoc ? unmappedItems.filter(itemInActiveDoc) : unmappedItems;
                      const unmappedSorted = [...unmappedVisible].sort((a, b) =>
                        a.attrKey.localeCompare(b.attrKey) || a.source.localeCompare(b.source));

                      // Count for the Unmapped tab label (the Canonical tab shows no count).
                      const unmappedCount = unmappedItems.length;

                      // Extracted Data tab — full inventory of every extraction (mapped or not),
                      // sorted like the Unmapped table. Honors the "only active doc" checkbox but
                      // never scopes by association status (the tab is a complete inventory).
                      const extractedVisible = viewSourcesOnlyActiveDoc ? poolItems.filter(itemInActiveDoc) : poolItems;
                      const extractedSorted = [...extractedVisible].sort((a, b) =>
                        a.attrKey.localeCompare(b.attrKey) || a.source.localeCompare(b.source));

                      // Preferred (winning) row per term: explicit pick (incl. the '__manual__' sentinel),
                      // else first mapped row in the term.
                      const termPreferredId = (term: string, items: PoolItem[]): string | null => {
                        const explicit = viewSourcesTermPref[`${lineId}::${term}`];
                        if (explicit === '__manual__') return '__manual__';
                        if (explicit && items.some((it) => it.itemId === explicit)) return explicit;
                        // Reconcile mode: a term with 2+ candidates and no explicit pick stays unresolved —
                        // no radio is selected until the user chooses (an "unable to resolve source" case).
                        if (isReconcile && items.length >= 2) return null;
                        return items.length > 0 ? items[0].itemId : null;
                      };
                      // Synthetic pool item representing a term's manually-entered value.
                      const manualPoolItem = (term: string): PoolItem => {
                        const v = viewSourcesTermManual[`${lineId}::${term}`] || '';
                        return { itemId: '__manual__', attrKey: '', candidateIdx: -1, field: '', value: v, override: '', displayValue: v, source: 'Manual', confidence: 100 };
                      };
                      const commitManual = (term: string, v: string) => {
                        const key = `${lineId}::${term}`;
                        const val = v.trim();
                        if ((viewSourcesTermManual[key] || '') !== val) {
                          const beforeManual = viewSourcesTermManual[key];
                          const beforePref = viewSourcesTermPref[key];
                          markDirty(`man:${key}`, () => {
                            setViewSourcesTermManual((p) => {
                              const n = { ...p };
                              if (beforeManual === undefined) delete n[key]; else n[key] = beforeManual;
                              return n;
                            });
                            setViewSourcesTermPref((p) => {
                              const n = { ...p };
                              if (beforePref === undefined) delete n[key]; else n[key] = beforePref;
                              return n;
                            });
                          });
                        }
                        setViewSourcesTermManual((prev) => {
                          const next = { ...prev };
                          if (val) next[key] = val; else delete next[key];
                          return next;
                        });
                        setViewSourcesTermPref((prev) => {
                          const next = { ...prev };
                          if (val) next[key] = '__manual__';
                          else if (next[key] === '__manual__') delete next[key];
                          return next;
                        });
                        setViewSourcesEditingManual(null);
                      };

                      // Association status for an Extracted Data row (mirrors the record panel). An item can
                      // belong to several terms; for each, it's "Selected" when it's that term's preferred
                      // pick, else "Associated". A term is never listed under both.
                      const itemAssociations = (it: PoolItem): { associated: string[]; selected: string[] } => {
                        const associated: string[] = [];
                        const selected: string[] = [];
                        itemAllTerms(it).forEach((term) => {
                          // Use the term's full mapped set (not the active-doc-scoped mappedByTerm) so the
                          // preferred pick is resolved consistently regardless of the doc filter.
                          const termItems = mappedItems.filter((m) => itemAllTerms(m).includes(term));
                          const pref = termPreferredId(term, termItems);
                          if (pref && pref === it.itemId) selected.push(term); else associated.push(term);
                        });
                        return { associated, selected };
                      };

                      // Build value→attrKey map so each <mark> (and the rail marker derived from it) carries its
                      // key. Scoped to the active tab so the flag rail reflects Mapped vs Unmapped. In
                      // single-term mode (opened from a Source cell) it's scoped to just that term's
                      // mapped extractions, so only that attribute's hotspots highlight in the doc.
                      const railItems = singleTerm
                        ? (singleTermGroup ? singleTermGroup[1] : [])
                        : (activeTab === 'unmapped' ? unmappedItems : mappedItems);
                      const valueToAttr: Array<{ value: string; attrKey: string }> = [];
                      railItems.forEach((it) => {
                        if (it.source === activeSourceName && it.value) {
                          valueToAttr.push({ value: it.value, attrKey: it.attrKey });
                        }
                      });

                      const renderText = (text: string) => {
                        if (valueToAttr.length === 0) return <>{text}</>;
                        type Range = { start: number; end: number; isActive: boolean; attrKey: string };
                        const ranges: Range[] = [];
                        const lower = text.toLowerCase();
                        const sorted = [...valueToAttr].sort((a, b) => b.value.length - a.value.length);
                        sorted.forEach(({ value, attrKey }) => {
                          const needle = value.toLowerCase();
                          if (!needle) return;
                          let from = 0;
                          while (true) {
                            const idx = lower.indexOf(needle, from);
                            if (idx < 0) break;
                            const end = idx + needle.length;
                            const overlaps = ranges.some((r) => !(end <= r.start || idx >= r.end));
                            if (!overlaps) {
                              ranges.push({ start: idx, end, isActive: !!highlightValue && value === highlightValue, attrKey });
                            }
                            from = end;
                          }
                        });
                        if (ranges.length === 0) return <>{text}</>;
                        ranges.sort((a, b) => a.start - b.start);
                        const parts: React.ReactNode[] = [];
                        let cursor = 0;
                        ranges.forEach((r, i) => {
                          if (r.start > cursor) parts.push(text.slice(cursor, r.start));
                          const segment = text.slice(r.start, r.end);
                          if (r.isActive) {
                            parts.push(
                              <mark
                                key={`active-${i}`}
                                data-doc-mark="active"
                                data-attr-key={r.attrKey}
                                onClick={() => activateDocRow(r.attrKey, segment)}
                                style={{ backgroundColor: '#fff59d', padding: '0 2px', borderRadius: '2px', border: '1px solid #8a6d00', boxShadow: '0 0 0 1px #8a6d00', cursor: 'pointer' }}
                              >
                                {segment}
                              </mark>
                            );
                          } else {
                            parts.push(
                              <mark
                                key={`other-${i}`}
                                data-doc-mark="other"
                                data-attr-key={r.attrKey}
                                onClick={() => activateDocRow(r.attrKey, segment)}
                                style={{ backgroundColor: '#fff9c4', padding: '0 2px', borderRadius: '2px', cursor: 'pointer' }}
                              >
                                {segment}
                              </mark>
                            );
                          }
                          cursor = r.end;
                        });
                        if (cursor < text.length) parts.push(text.slice(cursor));
                        return <>{parts}</>;
                      };
                      // Backwards-compat alias used by doc renderers below.
                      const highlightFn = (text: string, _target: string) => renderText(text);

                      const pageStyle: React.CSSProperties = {
                        backgroundColor: 'white',
                        maxWidth: '720px',
                        margin: '0 auto',
                        padding: '40px 48px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        fontFamily: '"Times New Roman", Times, serif',
                        color: '#1a1a1a',
                        fontSize: '12px',
                        lineHeight: 1.5,
                      };

                      const acordPage = (children: React.ReactNode, key?: React.Key) => (
                        <div key={key} style={{ ...pageStyle, marginBottom: '16px' }}>{children}</div>
                      );

                      // Enrichment API responses arrive as JSON but are shown to the underwriter as a
                      // read-only tree grid (Field / Value) rather than a source document. Leaf values run
                      // through renderText so extracted values highlight and the flag rail lines up.
                      type JsonNode = string | number | boolean | null | JsonObject | JsonNode[];
                      interface JsonObject { [k: string]: JsonNode }
                      interface JsonRow { key: string; depth: number; label: string; value?: string; isBranch: boolean }
                      const flattenJson = (node: JsonNode, depth: number, keyPrefix: string): JsonRow[] => {
                        const rows: JsonRow[] = [];
                        if (Array.isArray(node)) {
                          node.forEach((item, i) => {
                            if (typeof item === 'object' && item !== null) {
                              rows.push({ key: `${keyPrefix}-${i}`, depth, label: `item ${i + 1}`, isBranch: true });
                              rows.push(...flattenJson(item, depth + 1, `${keyPrefix}-${i}`));
                            } else {
                              rows.push({ key: `${keyPrefix}-${i}`, depth, label: `[${i}]`, value: String(item), isBranch: false });
                            }
                          });
                        } else if (node !== null && typeof node === 'object') {
                          Object.entries(node).forEach(([k, v]) => {
                            const isBranch = v !== null && typeof v === 'object';
                            rows.push({ key: `${keyPrefix}-${k}`, depth, label: k, value: isBranch ? undefined : String(v), isBranch });
                            if (isBranch) rows.push(...flattenJson(v, depth + 1, `${keyPrefix}-${k}`));
                          });
                        }
                        return rows;
                      };
                      const renderJsonTreeGrid = (node: JsonNode, keyPrefix: string): React.ReactNode => {
                        const rows = flattenJson(node, 0, keyPrefix);
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', fontSize: '12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                            <div style={{ padding: '6px 10px', backgroundColor: '#efefef', fontWeight: 700, fontSize: '10px', letterSpacing: '0.5px', color: '#5c5c5c', borderBottom: '1px solid #d8d8d8' }}>FIELD</div>
                            <div style={{ padding: '6px 10px', backgroundColor: '#efefef', fontWeight: 700, fontSize: '10px', letterSpacing: '0.5px', color: '#5c5c5c', borderBottom: '1px solid #d8d8d8' }}>VALUE</div>
                            {rows.map((r) => (
                              <React.Fragment key={r.key}>
                                <div style={{ paddingLeft: 10 + r.depth * 18, paddingRight: 10, paddingTop: '5px', paddingBottom: '5px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                  {r.isBranch
                                    ? <span style={{ color: '#939393', fontSize: '10px', flexShrink: 0 }}>▾</span>
                                    : <span style={{ color: '#c9c9c9', fontSize: '10px', flexShrink: 0 }}>•</span>}
                                  <span style={{ color: '#001e5b', fontWeight: r.isBranch ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>{r.label}</span>
                                </div>
                                <div style={{ padding: '5px 10px', borderBottom: '1px solid #eee', color: '#2e2e2e', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.value ?? ''}>
                                  {r.isBranch ? <span style={{ color: '#9e9e9e', fontStyle: 'italic' }}>{'{ }'}</span> : renderText(r.value ?? '')}
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        );
                      };

                      // Mock enrichment API responses keyed by vendor, for the Chicago Warehouse worked example.
                      const enrichmentResponses: Record<string, { endpoint: string; status: string; retrieved: string; body: JsonObject }> = {
                        'ISO': {
                          endpoint: 'GET /v2/property/protection-class',
                          status: '200 OK',
                          retrieved: '2026-06-02T14:20:11Z',
                          body: {
                            provider: 'ISO',
                            product: 'Public Protection Classification',
                            location: {
                              addressLine1: '1450 W Fulton St',
                              city: 'Chicago',
                              state: 'IL',
                              postalCode: '60607',
                            },
                            protectionClass: {
                              isoPPC: '3',
                              splitClassification: false,
                              respondingFireStation: 'CFD Engine 34',
                              fireStationDistanceMiles: 0.6,
                              waterSupply: 'Municipal — hydrant within 500 ft',
                            },
                            confidence: 0.97,
                            matchType: 'ROOFTOP',
                          },
                        },
                        'Verisk 360': {
                          endpoint: 'GET /360value/v3/property',
                          status: '200 OK',
                          retrieved: '2026-06-02T14:19:48Z',
                          body: {
                            provider: 'Verisk 360Value',
                            requestId: 'v360-8841-CHI',
                            property: {
                              constructionType: 'Masonry Non-Combustible',
                              yearBuilt: 1998,
                              totalSquareFootage: 142000,
                              roof: { type: 'TPO Membrane', ageYears: 6, condition: 'Good' },
                              protection: {
                                automaticSprinkler: 'Full',
                                fireAlarmType: 'Central Station',
                              },
                              valuation: { buildingReplacementCost: 28640000, currency: 'USD' },
                            },
                            confidence: 0.94,
                          },
                        },
                        'CoreLogic': {
                          endpoint: 'GET /property/v1/hazard',
                          status: '200 OK',
                          retrieved: '2026-06-02T14:20:03Z',
                          body: {
                            provider: 'CoreLogic',
                            geocode: { latitude: 41.8866, longitude: -87.6593, matchType: 'ROOFTOP' },
                            hazards: {
                              femaFloodZone: 'X',
                              seismicZone: 'Low',
                              wildfireRiskScore: 4,
                              distanceToCoastMiles: 687,
                            },
                            confidence: 0.91,
                          },
                        },
                      };

                      const enrichmentDoc = (sourceName: string) => {
                        const resp = enrichmentResponses[sourceName];
                        const serviceName = (resp?.body?.provider as string) || sourceName;
                        const executedOn = resp?.retrieved ? formatEnrichmentDate(resp.retrieved) : null;
                        return (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px' }}>
                            <div style={{ maxWidth: '360px' }}>
                              <svg width="44" height="44" viewBox="0 0 24 24" fill="#0176D3" style={{ marginBottom: '14px' }}>
                                <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3z" />
                              </svg>
                              <div style={{ fontSize: '15px', fontWeight: 600, color: '#032D60', marginBottom: '8px' }}>Enriched via {serviceName}</div>
                              <div style={{ fontSize: '13px', color: '#5c5c5c', lineHeight: '19px' }}>
                                This value was retrieved automatically from the {serviceName} enrichment service{executedOn ? ` on ${executedOn}` : ''}. There is no source document to preview for enriched data.
                              </div>
                            </div>
                          </div>
                        );
                      };

                      // File-type of a source, driving which renderer + chrome the canvas uses.
                      // Rail markers only exist for pdf/doc (their renderers emit data-doc-mark
                      // via renderText); xls/image/json emit none, so the rail auto-suppresses.
                      const docFileType = (src: string): 'pdf' | 'doc' | 'image' | 'xls' | 'json' => {
                        if (isEnrichmentSource(src)) return 'json';
                        if (src === 'Statement of Values') return 'xls';
                        if (src === 'Site Survey Photo') return 'image';
                        if (src === 'Email') return 'doc';
                        return 'pdf';
                      };

                      // Statement of Values — a mock SOV spreadsheet rendered like a real sheet
                      // (Google-Sheets-style): lettered column headers, a row-number gutter, many
                      // columns/rows and its own horizontal + vertical scroll. The cell whose value
                      // matches highlightValue gets an amber fill (no data-doc-mark → no rail).
                      const sovDoc = () => renderSov(highlightValue);

                      const renderSov = (highlight: string) => {
                        const headers = ['Loc #', 'Street Address', 'City', 'State', 'ZIP', 'County', 'Bldg Value', 'Contents Value', 'BI Value', 'Year Built', 'Sq Ft', 'Construction', 'Sprinkler', 'Alarm', 'Occupancy'];
                        const dataRows: string[][] = [
                          ['1', '1450 W Fulton St', 'Chicago', 'IL', '60607', 'Cook', '$28,640,000', '$6,200,000', '$4,100,000', '1998', '142,000', 'Masonry NC', 'Full', 'Central', 'Cold Storage'],
                          ['2', '200 Congress Ave', 'Austin', 'TX', '78701', 'Travis', '$12,300,000', '$3,400,000', '$1,900,000', '2005', '64,000', 'Joisted Masonry', 'Full', 'Central', 'Office'],
                          ['3', '88 First St', 'San Jose', 'CA', '95113', 'Santa Clara', '$18,900,000', '$5,100,000', '$2,700,000', '2011', '88,500', 'Fire Resistive', 'Full', 'Central', 'R&D Lab'],
                        ];
                        const totalCols = headers.length; // only the columns present in the file
                        const totalRows = 1 + dataRows.length; // header row + the file's data rows
                        const colLetter = (i: number) => String.fromCharCode(65 + i);
                        const hl = (highlight || '').trim().toLowerCase();
                        // Every value this sheet contributed to the pool (mapped or unmapped) —
                        // used to give non-selected extractions a lighter "other" highlight,
                        // mirroring renderText's active vs other <mark> distinction. Scoped like the
                        // rail: in single-term mode only that term's extractions light up.
                        const sovScopeItems = (singleTerm ? railItems : [...mappedItems, ...unmappedItems])
                          .filter((it) => it.source === 'Statement of Values' && it.value);
                        const sovOtherVals = sovScopeItems
                          .map((it) => it.value.trim().toLowerCase())
                          .filter((v) => v && v !== hl);
                        const otherSet = Array.from(new Set(sovOtherVals));
                        const matchesVal = (cv: string, needle: string) => {
                          if (cv === needle) return true;
                          // Substring both ways for multi-part values (e.g. full address vs its
                          // parts), but only for cells long enough to avoid spurious hits.
                          return cv.length >= 2 && (needle.includes(cv) || cv.includes(needle));
                        };
                        // A cell lights up (active) when the clicked right-pane row's value matches it.
                        const cellMatches = (v: string) => {
                          if (!hl || !v) return false;
                          return matchesVal(v.trim().toLowerCase(), hl);
                        };
                        // A cell gets the lighter "other" highlight when it matches any other
                        // Statement-of-Values extraction (not the currently selected one).
                        const cellOtherMatches = (v: string) => {
                          if (!v || otherSet.length === 0) return false;
                          const cv = v.trim().toLowerCase();
                          return otherSet.some((n) => matchesVal(cv, n));
                        };
                        // Every pool item this sheet contributed — used to map a clicked cell back
                        // to its attribute row in the right pane (scoped like the highlights above).
                        const sovPoolItems = sovScopeItems;
                        const findSovItem = (cellVal: string) => {
                          const cv = cellVal.trim().toLowerCase();
                          return sovPoolItems.find((it) => matchesVal(cv, it.value.trim().toLowerCase()));
                        };
                        const selectSovItem = (it: PoolItem) => {
                          setViewSourcesUnmappedAttr(null);
                          activateDocRow(it.attrKey, it.value);
                        };
                        // When the active highlight changes, scroll the matching cell to the center of
                        // the sheet viewport (once per value, so manual scrolling isn't fought).
                        const scrollCellIntoView = (cell: HTMLTableCellElement | null) => {
                          if (!cell) return;
                          const box = sovScrollRef.current;
                          if (!box) return;
                          if (sovScrolledValueRef.current === hl) return;
                          sovScrolledValueRef.current = hl;
                          const targetLeft = cell.offsetLeft - (box.clientWidth - cell.offsetWidth) / 2;
                          const targetTop = cell.offsetTop - (box.clientHeight - cell.offsetHeight) / 2;
                          box.scrollTo({ left: Math.max(0, targetLeft), top: Math.max(0, targetTop), behavior: 'smooth' });
                        };
                        // Reset the scroll guard when the highlight clears so re-selecting the same
                        // value later still scrolls.
                        if (!hl) sovScrolledValueRef.current = '';
                        // Zoom scales the cell metrics (not the whole viewer), Google-Sheets style.
                        const z = docZoom;
                        const GUT = Math.round(46 * z);
                        const colW = (c: number) => Math.round((c === 0 ? 60 : c === 1 ? 190 : c >= 6 && c <= 8 ? 130 : 110) * z);
                        const fs = Math.round(12 * z);
                        const hfs = Math.max(9, Math.round(11 * z));
                        const padV = Math.round(4 * z);
                        const padH = Math.round(8 * z);
                        const headH = Math.round(22 * z);
                        const gridVal = (r: number, c: number) => (r === 0 ? (headers[c] || '') : (dataRows[r - 1][c] || ''));
                        const headBg = '#f1f3f4';
                        return (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden', fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
                            {/* Spreadsheet title bar */}
                            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#217346', color: 'white', fontSize: '12px', fontWeight: 600 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" /></svg>
                              NexGen_Statement_of_Values.xlsx
                            </div>
                            {/* Scrollable sheet viewport — fills the canvas, scrolls both ways */}
                            <div ref={sovScrollRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', backgroundColor: '#fbfbfb' }}>
                              <table style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                                <colgroup>
                                  <col style={{ width: `${GUT}px` }} />
                                  {Array.from({ length: totalCols }).map((_, c) => (<col key={`col-${c}`} style={{ width: `${colW(c)}px` }} />))}
                                </colgroup>
                                <thead>
                                  <tr>
                                    <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, height: `${headH}px`, backgroundColor: '#e6e6e6', border: '1px solid #d0d0d0' }} />
                                    {Array.from({ length: totalCols }).map((_, c) => (
                                      <th key={`ch-${c}`} style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: headBg, border: '1px solid #d0d0d0', fontSize: `${hfs}px`, fontWeight: 600, color: '#5c5c5c', textAlign: 'center', height: `${headH}px` }}>{colLetter(c)}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from({ length: totalRows }).map((_, r) => (
                                    <tr key={`sov-r-${r}`}>
                                      <th style={{ position: 'sticky', left: 0, zIndex: 1, backgroundColor: headBg, border: '1px solid #d0d0d0', fontSize: `${hfs}px`, fontWeight: 600, color: '#5c5c5c', textAlign: 'center' }}>{r + 1}</th>
                                      {Array.from({ length: totalCols }).map((_, c) => {
                                        const v = gridVal(r, c);
                                        const isHeaderRow = r === 0;
                                        const match = !isHeaderRow && cellMatches(v);
                                        const otherMatch = !isHeaderRow && !match && cellOtherMatches(v);
                                        const cellBg = match ? '#ffe28a' : otherMatch ? '#fff9c4' : (isHeaderRow ? '#eef3ef' : 'white');
                                        const sovItem = !isHeaderRow ? findSovItem(v) : undefined;
                                        return (
                                          <td
                                            key={`sov-${r}-${c}`}
                                            title={v || undefined}
                                            ref={match ? scrollCellIntoView : undefined}
                                            onClick={sovItem ? () => selectSovItem(sovItem) : undefined}
                                            style={{
                                              border: '1px solid #e2e2e2',
                                              padding: `${padV}px ${padH}px`,
                                              fontSize: `${fs}px`,
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              color: '#1a1a1a',
                                              fontWeight: isHeaderRow ? 700 : 400,
                                              backgroundColor: cellBg,
                                              boxShadow: match ? 'inset 0 0 0 2px #8a6d00' : 'none',
                                              cursor: sovItem ? 'pointer' : 'default',
                                            }}
                                          >{v}</td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {/* Sheet tab strip — pinned to the bottom of the canvas */}
                            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 8px', backgroundColor: '#f1f1f1', borderTop: '1px solid #c9c9c9' }}>
                              <div style={{ padding: '3px 12px', fontSize: '11px', fontWeight: 600, color: '#217346', backgroundColor: 'white', border: '1px solid #c9c9c9', borderBottom: 'none', borderRadius: '2px 2px 0 0' }}>Locations</div>
                              <div style={{ padding: '3px 12px', fontSize: '11px', color: '#939393' }}>Summary</div>
                            </div>
                          </div>
                        );
                      };

                      // Site Survey — a mock scanned handwritten inspection form. Extracted values are
                      // written in a handwriting font and run through renderText so the value read off
                      // the form (the address) becomes a clickable, rail-tracked hotspot.
                      const HAND = '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive';
                      const surveyRow = (label: string, node: React.ReactNode) => (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '18px' }}>
                          <div style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3a3a3a', paddingBottom: '3px', width: '150px' }}>{label}</div>
                          <div style={{ flex: 1, borderBottom: '1px solid #9a9a9a', paddingBottom: '2px', fontFamily: HAND, fontSize: '18px', color: '#1a3a7a', lineHeight: 1.2, minHeight: '24px' }}>{node}</div>
                        </div>
                      );
                      const imageDoc = () => (
                        <div style={{ maxWidth: '720px', margin: '0 auto', backgroundColor: 'white', borderRadius: '2px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#1a1a1a', color: 'white', fontSize: '12px', fontWeight: 600 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>
                            site_survey_form_chicago.jpg
                          </div>
                          {/* Faux scanned paper form with handwritten entries */}
                          <div style={{ position: 'relative', padding: '28px 32px 36px', background: 'linear-gradient(#fdfdf9,#f4f3ea)', fontFamily: 'Arial, sans-serif' }}>
                            <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: '10px', marginBottom: '22px' }}>
                              <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px', color: '#1a1a1a' }}>PROPERTY SITE SURVEY — FIELD INSPECTION</div>
                              <div style={{ fontSize: '10px', color: '#5c5c5c', marginTop: '3px' }}>Vanguard Insurance Partners · Loss Control</div>
                            </div>
                            {surveyRow('Insured', <span>NexGen Biologics Inc</span>)}
                            {surveyRow('Site Address', renderText('1450 W Fulton St'))}
                            {surveyRow('Inspected By', <span>R. Alvarez</span>)}
                            {surveyRow('Date', <span>05 / 28 / 2026</span>)}
                            {surveyRow('Occupancy', <span>Cold storage warehouse</span>)}
                            {surveyRow('Notes', <span>Fully fenced, docks alarmed.</span>)}
                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                              <div style={{ fontFamily: HAND, fontSize: '22px', color: '#1a3a7a', borderBottom: '1px solid #9a9a9a', paddingBottom: '2px', minWidth: '180px' }}>R. Alvarez</div>
                              <div style={{ fontSize: '9px', color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: '1px' }}>Inspector Signature</div>
                            </div>
                          </div>
                          <div style={{ padding: '8px 12px', fontSize: '11px', color: '#5c5c5c', fontFamily: 'Arial, sans-serif', backgroundColor: '#fafafa', borderTop: '1px solid #e5e5e5' }}>
                            Scanned field inspection form · Location 1 — Chicago Warehouse · captured 05/28/2026
                          </div>
                        </div>
                      );

                      const renderDoc = (sourceName: string, _target: string) => {
                        const ftype = docFileType(sourceName);
                        if (ftype === 'xls') return sovDoc();
                        if (ftype === 'image') return imageDoc();
                        if (sourceName === 'ACORD 140') {
                          return (
                            <>
                              {acordPage(
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                                    <div>
                                      <div style={{ fontSize: '10px', letterSpacing: '0.5px', color: '#5c5c5c' }}>ACORD®</div>
                                      <div style={{ fontSize: '16px', fontWeight: 700 }}>PROPERTY SECTION</div>
                                    </div>
                                    <div style={{ fontSize: '10px', textAlign: 'right' }}>
                                      <div>FORM 140 (2016/03)</div>
                                      <div>Page 1 of 4</div>
                                    </div>
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <tbody>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', width: '30%', fontWeight: 600 }}>AGENCY</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Vanguard Insurance Partners</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>NAMED INSURED</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>NexGen Biologics Inc</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>EFFECTIVE DATE</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>07/01/2026</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>POLICY TERM</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>12 Months</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>NAIC</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>325412</td></tr>
                                    </tbody>
                                  </table>
                                  <p style={{ fontSize: '11px', marginTop: '14px', lineHeight: 1.5 }}>
                                    This Property Section is part of the commercial insurance application submitted to underwriter Martha Reyes. The schedule below covers all insured premises operated by NexGen Biologics Inc across the United States. Loss-prevention, alarm and protection details for each premises follow on subsequent pages.
                                  </p>
                                  <div style={{ marginTop: '14px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>ACORD 140 (2016/03) — Page 1 of 4</div>
                                </>,
                                'a140-1'
                              )}
                              {acordPage(
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700 }}>SCHEDULE OF LOCATIONS</div>
                                    <div style={{ fontSize: '10px' }}>FORM 140 — Page 2 of 4</div>
                                  </div>
                                  <div style={{ marginTop: '4px', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>BLANKET SUMMARY / SCHEDULE OF LOCATIONS</div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                                    <tbody>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', width: '30%', fontWeight: 600 }}>LOC #</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>1</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>STREET ADDRESS</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('1450 W Fulton St, Chicago, IL 60607')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>CITY</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Chicago')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>STATE</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('IL')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>ZIP</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('60607')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>COUNTRY</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('USA')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>COUNTY</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Cook</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>OCCUPANCY</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Warehouse / Cold Storage — Pharmaceutical</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>PROTECTION CLASS</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>3</td></tr>
                                    </tbody>
                                  </table>
                                  <p style={{ fontSize: '11px', marginTop: '14px', lineHeight: 1.5 }}>
                                    The premises is a single-tenant, owner-occupied warehouse with cold-chain pharmaceutical storage. The structure is fully fenced with controlled access at the loading docks. Refer to the Protection / Loss Prevention page for sprinkler, alarm and security details.
                                  </p>
                                  <div style={{ marginTop: '14px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>ACORD 140 (2016/03) — Page 2 of 4</div>
                                </>,
                                'a140-2'
                              )}
                              {acordPage(
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700 }}>CONSTRUCTION / BUILDING DETAILS</div>
                                    <div style={{ fontSize: '10px' }}>FORM 140 — Page 3 of 4</div>
                                  </div>
                                  <div style={{ marginTop: '4px', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>CONSTRUCTION</div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                                    <tbody>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', width: '40%', fontWeight: 600 }}>CONSTRUCTION TYPE</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Masonry Non-Combustible')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>YEAR BUILT</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('1998')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>NO. OF STORIES</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('1')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>TOTAL AREA</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('142,000 sq ft')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>EXTERIOR WALLS</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Brick')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>BASEMENT</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('None')}</td></tr>
                                    </tbody>
                                  </table>
                                  <div style={{ marginTop: '10px', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>ROOF</div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                                    <tbody>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', width: '40%', fontWeight: 600 }}>ROOF TYPE</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Flat')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>ROOF MATERIAL</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('TPO Membrane')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>ROOF UPDATED / AGE</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('6 years')}</td></tr>
                                    </tbody>
                                  </table>
                                  <div style={{ marginTop: '10px', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>WIRING / PLUMBING / HEATING</div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                                    <tbody>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', width: '40%', fontWeight: 600 }}>WIRING</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Copper')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>WIRING UPDATED</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('2015')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>PLUMBING</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Copper')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>HEATING</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Gas-Fired Unit Heaters')}</td></tr>
                                    </tbody>
                                  </table>
                                  <p style={{ fontSize: '11px', marginTop: '14px', lineHeight: 1.5 }}>
                                    Construction and building-system details as reported by the applicant. Masonry non-combustible construction with a flat TPO membrane roof reroofed within the last six years; copper wiring updated in 2015 and gas-fired unit heaters throughout the warehouse.
                                  </p>
                                  <div style={{ marginTop: '14px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>ACORD 140 (2016/03) — Page 3 of 4</div>
                                </>,
                                'a140-3'
                              )}
                              {acordPage(
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700 }}>PROTECTION / LOSS PREVENTION</div>
                                    <div style={{ fontSize: '10px' }}>FORM 140 — Page 4 of 4</div>
                                  </div>
                                  <div style={{ marginTop: '4px', backgroundColor: '#1a1a1a', color: 'white', padding: '4px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>FIRE / LIFE SAFETY</div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                                    <tbody>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', width: '40%', fontWeight: 600 }}>SPRINKLERED</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Yes')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>FIRE ALARM</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Yes')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>SECURITY</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('24/7 Guard')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>BURGLAR ALARM</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Central Station, UL listed</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>EMERGENCY POWER</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Generator backup; on-site fuel storage</td></tr>
                                    </tbody>
                                  </table>
                                  <p style={{ fontSize: '11px', marginTop: '14px', lineHeight: 1.5 }}>
                                    Loss prevention measures include 24/7 on-site security, central-station monitored fire and burglar alarms, and a redundant generator. Annual third-party inspections of the sprinkler system and life-safety equipment are documented in the loss control file.
                                  </p>
                                  <div style={{ marginTop: '14px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>ACORD 140 (2016/03) © 2002–2016 ACORD CORPORATION. All rights reserved.</div>
                                </>,
                                'a140-4'
                              )}
                            </>
                          );
                        }
                        if (sourceName === 'ACORD 125') {
                          return (
                            <>
                              {acordPage(
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                                    <div>
                                      <div style={{ fontSize: '10px', letterSpacing: '0.5px', color: '#5c5c5c' }}>ACORD®</div>
                                      <div style={{ fontSize: '16px', fontWeight: 700 }}>COMMERCIAL INSURANCE APPLICATION</div>
                                      <div style={{ fontSize: '11px' }}>Applicant Information Section</div>
                                    </div>
                                    <div style={{ fontSize: '10px', textAlign: 'right' }}>
                                      <div>FORM 125 (2016/03)</div>
                                      <div>Page 1 of 3</div>
                                    </div>
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <tbody>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', width: '30%', fontWeight: 600 }}>APPLICANT</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>NexGen Biologics Inc</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>FEIN</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>47-3829104</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>BUSINESS TYPE</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Corporation</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>NAICS</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>325412 — Pharmaceutical Preparation Manufacturing</td></tr>
                                    </tbody>
                                  </table>
                                  <p style={{ fontSize: '11px', marginTop: '14px', lineHeight: 1.5 }}>
                                    The applicant operates pharmaceutical manufacturing and cold-chain distribution. Premises information for each insured location follows on the next page; protection and loss-control attestations are summarized on page 3.
                                  </p>
                                  <div style={{ marginTop: '14px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>ACORD 125 (2016/03) — Page 1 of 3</div>
                                </>,
                                'a125-1'
                              )}
                              {acordPage(
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700 }}>PREMISES INFORMATION</div>
                                    <div style={{ fontSize: '10px' }}>FORM 125 — Page 2 of 3</div>
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                                    <tbody>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', width: '30%', fontWeight: 600 }}>LOCATION #</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>1</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>STREET</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('1450 West Fulton St, Chicago IL 60607')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>CITY</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Chicago')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>STATE</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('IL')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>ZIP</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('60607')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>INTEREST</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Owner</td></tr>
                                    </tbody>
                                  </table>
                                  <p style={{ fontSize: '11px', marginTop: '14px', lineHeight: 1.5 }}>
                                    The applicant is the sole occupant and owner of the premises. The site is used for cold-chain pharmaceutical warehousing and distribution serving the Midwest region. Hazardous materials are stored in a dedicated, climate-controlled vault.
                                  </p>
                                  <div style={{ marginTop: '14px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>ACORD 125 (2016/03) — Page 2 of 3</div>
                                </>,
                                'a125-2'
                              )}
                              {acordPage(
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700 }}>PROTECTION ATTESTATIONS</div>
                                    <div style={{ fontSize: '10px' }}>FORM 125 — Page 3 of 3</div>
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                                    <tbody>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', width: '40%', fontWeight: 600 }}>FIRE SUPPRESSION</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Sprinklered')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>FIRE ALARM</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderText('Central Station Monitored')}</td></tr>
                                      <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>DESCRIPTION OF OPERATIONS</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>Pharmaceutical cold-chain warehouse and distribution center serving the Midwest region.</td></tr>
                                    </tbody>
                                  </table>
                                  <p style={{ fontSize: '11px', marginTop: '14px', lineHeight: 1.5 }}>
                                    The applicant attests that all life-safety, fire-suppression and intrusion-detection systems are inspected on a regular schedule by qualified third-party providers, and that any deficiencies are remediated promptly.
                                  </p>
                                  <div style={{ marginTop: '14px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>ACORD 125 (2016/03) © 2002–2016 ACORD CORPORATION. All rights reserved.</div>
                                </>,
                                'a125-3'
                              )}
                            </>
                          );
                        }
                        if (isEnrichmentSource(sourceName)) {
                          return enrichmentDoc(sourceName);
                        }
                        if (sourceName === 'Email') {
                          return (
                            <div style={{ ...pageStyle, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: '13px' }}>
                              <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '12px', marginBottom: '12px' }}>
                                <div style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b', marginBottom: '8px' }}>NexGen Biologics — Property Submission, Chicago Location</div>
                                <table style={{ fontSize: '11px', color: '#5c5c5c' }}>
                                  <tbody>
                                    <tr><td style={{ paddingRight: '8px' }}><strong>From:</strong></td><td>Niki Paoloni &lt;niki.paoloni@vanguardins.com&gt;</td></tr>
                                    <tr><td style={{ paddingRight: '8px' }}><strong>To:</strong></td><td>Martha Reyes &lt;martha.reyes@nationalmutual.com&gt;</td></tr>
                                    <tr><td style={{ paddingRight: '8px' }}><strong>Date:</strong></td><td>Tuesday, June 2, 2026 9:14 AM</td></tr>
                                    <tr><td style={{ paddingRight: '8px' }}><strong>Subject:</strong></td><td>NexGen Biologics — New Business Submission</td></tr>
                                  </tbody>
                                </table>
                              </div>
                              <p style={{ marginTop: 0 }}>Hi Martha,</p>
                              <p>Submitting the new property quote for <strong>NexGen Biologics Inc</strong> with effective date 7/1/2026. They have three locations; details for the Chicago warehouse below — full ACORDs are attached.</p>
                              <div style={{ backgroundColor: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '4px', padding: '12px 16px', marginTop: '8px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '6px' }}>Location 1 — Chicago Warehouse</div>
                                <div>Street Address: {renderText('1448 W Fulton Street, Chicago, IL 60607')}</div>
                                <div>City: {renderText('Chicago')}</div>
                                <div>State: {renderText('Illinois')}</div>
                                <div>ZIP Code: {renderText('60612')}</div>
                                <div>Country: {renderText('United States')}</div>
                                <div>Year Built: 1998 (renovated 2019)</div>
                                <div>Total Sq Ft: ~84,000</div>
                                <div>Sprinkler System: {renderText('Full Coverage')}</div>
                                <div>Alarm System: {renderText('Central Station')}</div>
                                <div>Security System: {renderText('24-Hour Guard Service')}</div>
                              </div>
                              <p>Please confirm receipt and let me know if you need anything else to bind. The insured is targeting an answer by EOW.</p>
                              <p style={{ marginBottom: 0 }}>Thanks,<br />Niki Paoloni<br /><span style={{ color: '#5c5c5c', fontSize: '11px' }}>Vanguard Insurance Partners · (312) 555-0142</span></p>
                            </div>
                          );
                        }
                        return (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bdbdbd', fontSize: '13px', textAlign: 'center' }}>
                            <div>
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="#9e9e9e" style={{ marginBottom: '12px' }}>
                                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                              </svg>
                              <div>Documents go here</div>
                              <div style={{ marginTop: '8px', fontSize: '12px' }}>{sourceName}</div>
                            </div>
                          </div>
                        );
                      };

                      // Reusable canonical-term box. Two styles:
                      //  - 'default'     : rendered inside category sections (Canonical tab). Collapsed header
                      //                    shows the preferred value + source columns.
                      //  - 'discrepancy' : rendered flat (no category sections). The canonical category becomes a
                      //                    sub-line under the term, and the collapsed header shows the discrepancy
                      //                    descriptor (styled like "No attribute mapped") instead of value/source.
                      const termCatMap = getCanonicalTermCategoryMap(lineRecord?.lineOfBusiness, lineRecord?.lineType);
                      const renderTermBox = (term: string, groupItems: PoolItem[], boxStyle: 'default' | 'discrepancy' = 'default') => {
                                    const isTermExpanded = viewSourcesMappedGroup === term || singleTerm === term;
                                    const isManualPref = viewSourcesTermPref[`${lineId}::${term}`] === '__manual__';
                                    const hasAttrs = groupItems.length > 0 || isManualPref;
                                    const isDisc = boxStyle === 'discrepancy';
                                    // A default-style box (Attributes tab) whose term has a live
                                    // discrepancy shows the same right-aligned warning indicator as the
                                    // Discrepancies tab, in its collapsed header.
                                    const termHasDisc = !isDisc && discTermSet.has(term)
                                      && (disc.unresolvedSource.includes(term) || disc.lowConfidence.includes(term) || disc.unmappedTerms.includes(term));
                                    const category = termCatMap[term] || '';
                                    // Classify the discrepancy driving this box (used only in the discrepancy style).
                                    const discKind = disc.unresolvedSource.includes(term) ? 'conflict'
                                      : disc.lowConfidence.includes(term) ? 'lowconf'
                                      : disc.unmappedTerms.includes(term) ? 'unmapped' : null;
                                    // Sticky-but-resolved: the box lingers in the Discrepancies tab (via
                                    // discStickyRef) after its live discrepancy cleared — e.g. the user
                                    // associated an attribute — but hasn't clicked "Mark as Resolved" yet.
                                    const discCleared = isDisc && discKind === null;
                                    const explicitPick = viewSourcesTermPref[`${lineId}::${term}`];
                                    // In a discrepancy conflict box the term has 2+ candidates but no confirmed
                                    // pick — leave every radio unselected so the user must choose a source.
                                    const preferredId = (isDisc && discKind === 'conflict' && !explicitPick)
                                      ? null
                                      : termPreferredId(term, groupItems);
                                    // Unable to resolve source: 2+ candidates, no pick yet.
                                    const isUnresolvedSource = (isReconcile || (isDisc && discKind === 'conflict')) && !isManualPref && groupItems.length >= 2 && preferredId === null;
                                    const primaryItem = isManualPref
                                      ? manualPoolItem(term)
                                      : (preferredId ? (groupItems.find((it) => it.itemId === preferredId) || null) : null);
                                    // Short label shown in the header (collapsed AND expanded).
                                    const discMessage = discKind === 'conflict' ? 'Unable to resolve source'
                                      : discKind === 'lowconf' ? 'Low extraction confidence'
                                      : 'No attribute mapped';
                                    // How-to-fix guidance shown above the attribute table when expanded.
                                    const discFix = discKind === 'conflict'
                                      ? 'Multiple sources provide a value for this term. Select the preferred source below, or mark it as resolved.'
                                      : discKind === 'lowconf'
                                      ? 'The extracted value has low confidence. Add an override value, enter a manual value, or mark it as resolved.'
                                      : 'No attribute is mapped. Associate and select attributes or add a manual value';
                                    // Default-style boxes with a live discrepancy adopt the Discrepancies-tab
                                    // expanded layout (how-to-fix text + Mark as Resolved).
                                    const showDiscUI = isDisc || termHasDisc;
                                    const resolveTerm = () => {
                                      // Commit this term's dirty cells (override rows + manual value) so their
                                      // yellow state clears when the term is marked resolved.
                                      const termKeys = new Set<string>([`man:${lineId}::${term}`]);
                                      groupItems.forEach((gi) => termKeys.add(`ov:${lineId}::${gi.attrKey}::${gi.candidateIdx}`));
                                      setDirtyCells((prev) => {
                                        const next = new Set<string>();
                                        prev.forEach((k) => {
                                          if (termKeys.has(k)) {
                                            delete dirtyReverts.current[k];
                                          } else {
                                            next.add(k);
                                          }
                                        });
                                        return next;
                                      });
                                      setReconcileResolvedTerms((prev) => {
                                        const next = new Set(prev);
                                        next.add(`${lineId}::${term}`);
                                        return next;
                                      });
                                      setViewSourcesMappedGroup((prev) => prev === term ? null : prev);
                                    };
                                    // "Map Attributes" flyout — pick from ALL extracted attributes (multi-
                                    // association) and attach a row to this term. Rows already in this term's
                                    // box are excluded so the picker only offers new associations.
                                    const mapAttrPickerId = `term:${term}`;
                                    const isMapAttrOpen = viewSourcesMapPickerAttr === mapAttrPickerId && !!viewSourcesMapPickerRect;
                                    const mapAttrSearch = viewSourcesMapPickerSearch.trim().toLowerCase();
                                    const mapAttrPool = poolItems.filter((it) => !itemAllTerms(it).includes(term));
                                    const mapAttrCandidates = mapAttrSearch
                                      ? mapAttrPool.filter((it) => it.field.toLowerCase().includes(mapAttrSearch) || (it.source || '').toLowerCase().includes(mapAttrSearch))
                                      : mapAttrPool;
                                    // Associate an extraction with this term (multi-association): add the term
                                    // to the row's extra-terms list without disturbing its primary term or any
                                    // existing preferred picks. Seed this term's preferred pick only if none set.
                                    const mapItemToTerm = (it: PoolItem) => {
                                      const rowKey = `${lineId}::${it.attrKey}::${it.candidateIdx}`;
                                      const already = itemAllTerms(it).includes(term);
                                      if (!already) {
                                        setViewSourcesExtraTerms((prev) => {
                                          const cur = prev[rowKey] || [];
                                          if (cur.includes(term)) return prev;
                                          return { ...prev, [rowKey]: [...cur, term] };
                                        });
                                      }
                                      setViewSourcesTermPref((prev) => prev[`${lineId}::${term}`] ? prev : { ...prev, [`${lineId}::${term}`]: it.itemId });
                                    };
                                    const toggleMapAttr = (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      setViewSourcesMapPickerSearch('');
                                      if (viewSourcesMapPickerAttr === mapAttrPickerId) {
                                        setViewSourcesMapPickerAttr(null);
                                        setViewSourcesMapPickerRect(null);
                                      } else {
                                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        setViewSourcesMapPickerRect({ top: r.bottom + 4, left: r.right - 450 });
                                        setViewSourcesMapPickerAttr(mapAttrPickerId);
                                      }
                                    };
                                    const mapAttrControl = (
                                      <div style={{ position: 'relative' }}>
                                        <button
                                          type="button"
                                          onClick={toggleMapAttr}
                                          style={{ padding: 0, border: 'none', background: 'none', color: '#0176D3', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                          Associate Attribute
                                        </button>
                                        {isMapAttrOpen && (
                                          <>
                                            <div
                                              onClick={() => { setViewSourcesMapPickerAttr(null); setViewSourcesMapPickerSearch(''); setViewSourcesMapPickerRect(null); }}
                                              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }}
                                            />
                                            <div style={{
                                              position: 'fixed',
                                              top: viewSourcesMapPickerRect!.top,
                                              left: viewSourcesMapPickerRect!.left,
                                              zIndex: 10001,
                                              width: '450px',
                                              maxHeight: '300px',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              backgroundColor: 'white',
                                              border: '1px solid #c9c9c9',
                                              borderRadius: '6px',
                                              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                                              overflow: 'hidden',
                                            }}>
                                              <div style={{ padding: '8px', borderBottom: '1px solid #e5e5e5' }}>
                                                <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '6px' }}>Associate extracted data that matches the attribute</div>
                                                <input
                                                  type="text"
                                                  autoFocus
                                                  value={viewSourcesMapPickerSearch}
                                                  placeholder="Search unmapped attributes"
                                                  onChange={(e) => setViewSourcesMapPickerSearch(e.target.value)}
                                                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #c9c9c9', borderRadius: '4px', boxSizing: 'border-box', color: '#2e2e2e' }}
                                                />
                                              </div>
                                              <div style={{ overflowY: 'auto', padding: '4px' }}>
                                                {mapAttrCandidates.length === 0 ? (
                                                  <div style={{ padding: '10px 8px', fontSize: '12px', color: '#5c5c5c', textAlign: 'center' }}>No unmapped attributes</div>
                                                ) : mapAttrCandidates.map((it) => (
                                                  <div
                                                    key={it.itemId}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                  >
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                      <div style={{ fontSize: '12px', color: '#2e2e2e', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.field}</div>
                                                      <div style={{ fontSize: '10px', color: '#939393', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {it.displayValue || '—'} · {it.source || '—'}
                                                      </div>
                                                    </div>
                                                    <button
                                                      type="button"
                                                      title="Map to this term"
                                                      onClick={() => mapItemToTerm(it)}
                                                      style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', border: '1px solid #0176D3', borderRadius: '4px', background: 'white', color: '#0176D3', cursor: 'pointer', padding: 0 }}
                                                    >
                                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                    return (
                                    <div key={`mapped-term-${term}`} style={{
                                      border: '1px solid #e5e5e5',
                                      borderRadius: '8px',
                                      marginBottom: '8px',
                                      backgroundColor: 'white',
                                      overflow: 'hidden',
                                    }}>
                                      {/* Collapsed header — canonical term + selected value/source; expanded — term only */}
                                      <button
                                        onClick={() => setViewSourcesMappedGroup((prev) => prev === term ? null : term)}
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns: isDisc ? '20px 1.4fr 1.4fr' : (isTermExpanded ? '20px 1fr' : (termHasDisc ? '20px 1.4fr 1.4fr' : '20px 1.4fr 1fr 1fr')),
                                          columnGap: '12px',
                                          alignItems: 'center',
                                          width: '100%',
                                          padding: '10px 14px',
                                          border: 'none',
                                          background: isTermExpanded ? '#f8fbfe' : 'white',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          fontSize: '13px',
                                          color: '#2e2e2e',
                                        }}
                                      >
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="#5c5c5c"
                                          style={{ transform: isTermExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                                        >
                                          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                                        </svg>
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#001e5b' }}>
                                            {term}
                                          </div>
                                          {(isDisc || (termHasDisc && isTermExpanded) || !!singleTerm) && category && (
                                            <div style={{ fontSize: '11px', color: '#706E6B', fontWeight: 400, textTransform: 'capitalize', marginTop: '2px' }}>{category}</div>
                                          )}
                                        </div>
                                        {isDisc ? (
                                          discCleared ? (
                                            <div />
                                          ) : (
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#2e2e2e', justifySelf: 'end' }}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="#B85C00" style={{ flexShrink: 0 }}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                                            <span>{discMessage}</span>
                                          </div>
                                          )
                                        ) : !isTermExpanded && termHasDisc ? (
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#2e2e2e', justifySelf: 'end' }}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="#B85C00" style={{ flexShrink: 0 }}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                                            <span>{discMessage}</span>
                                          </div>
                                        ) : !isTermExpanded && (
                                          isUnresolvedSource ? (
                                            <>
                                              <div style={{ color: '#B85C00', fontStyle: 'italic' }}>{groupItems.length} sources conflict</div>
                                              <div />
                                            </>
                                          ) : hasAttrs && primaryItem ? (
                                            <>
                                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{primaryItem.displayValue || <span style={{ color: '#a0a0a0' }}>—</span>}</span>
                                                {primaryItem.override ? (
                                                  <span title="Override value" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                                                    <Icon category="utility" name="product_transfer" size="xx-small" style={{ fill: '#B85C00' }} />
                                                  </span>
                                                ) : (
                                                  <ConfidenceBadge score={primaryItem.confidence} />
                                                )}
                                              </div>
                                              <div style={{ color: '#2e2e2e', fontWeight: 600 }}>
                                                {primaryItem.source || <span style={{ color: '#a0a0a0', fontWeight: 400 }}>—</span>}
                                                {!isManualPref && groupItems.length > 1 && (
                                                  <span style={{ color: '#0176D3', fontWeight: 400 }}> (+{groupItems.length - 1})</span>
                                                )}
                                              </div>
                                            </>
                                          ) : (
                                            <>
                                              <div />
                                              <div />
                                            </>
                                          )
                                        )}
                                      </button>
                                      {isTermExpanded && (
                                      <div style={{ padding: '10px 14px 12px 14px', borderTop: '1px solid #e5e5e5', backgroundColor: '#fafafa' }}>
                                      {showDiscUI ? (
                                        <div style={{ marginBottom: '10px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            {mapAttrControl}
                                          </div>
                                          {!discCleared && (
                                            <div style={{ fontSize: '12px', color: '#3e3e3c', lineHeight: '17px', marginTop: '8px' }}>
                                              {discFix}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                      <>
                                      {isUnresolvedSource && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', backgroundColor: '#fef5e8', border: '1px solid #f0d9b5', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: '#5c3a00', lineHeight: '17px', marginBottom: '10px' }}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" style={{ flexShrink: 0, marginTop: '1px' }}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                                          <span>Multiple sources provide a value for this term. Select the source to use.</span>
                                        </div>
                                      )}
                                      {groupItems.length === 0 && !isManualPref && (
                                        <div style={{ fontSize: '12px', color: '#5c5c5c', lineHeight: '18px', padding: '4px 0 10px 0' }}>
                                          No attribute is mapped to this term. Map an extraction from the <strong>Unmapped</strong> tab, or enter a manual value below.
                                        </div>
                                      )}
                                      </>
                                      )}
                                      {!showDiscUI && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                          {mapAttrControl}
                                        </div>
                                      )}
                                      <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: '32px 1fr 1fr 0.9fr 1fr 40px',
                                          padding: '7px 0',
                                          marginBottom: '2px',
                                          backgroundColor: '#efefef',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          color: '#5c5c5c',
                                        }}>
                                          <div />
                                          <div style={{ padding: '0 10px' }}>Attribute</div>
                                          <div style={{ padding: '0 10px' }}>Value</div>
                                          <div style={{ padding: '0 10px' }}>Source</div>
                                          <div style={{ padding: '0 10px' }}>Override Value</div>
                                          <div />
                                        </div>
                                      {groupItems.map((it, rowIdx) => {
                                        const checked = it.itemId === preferredId;
                                        const isActiveRow = !!activeRow && activeRow.attrKey === it.attrKey && activeRow.candidateIdx === it.candidateIdx;
                                        const isLast = rowIdx === groupItems.length - 1;
                                        const rowKey = `${lineId}::${it.attrKey}::${it.candidateIdx}`;
                                        const editActive = viewSourcesHoverRow === rowKey || viewSourcesEditingRow === rowKey;
                                        // Disassociate this extraction from *this* term only (other term
                                        // associations survive). If the term is the row's primary, clear the
                                        // primary via rowMap=''; if it's an extra association, drop it from the
                                        // extras list. The row returns to the pool only when no term remains.
                                        const returnToPool = () => {
                                          const isPrimary = itemTerm(it) === term;
                                          if (isPrimary) {
                                            setViewSourcesRowMap((prev) => ({ ...prev, [rowKey]: '' }));
                                          } else {
                                            setViewSourcesExtraTerms((prev) => {
                                              const cur = prev[rowKey] || [];
                                              if (!cur.includes(term)) return prev;
                                              const nextList = cur.filter((t) => t !== term);
                                              const next = { ...prev };
                                              if (nextList.length > 0) next[rowKey] = nextList; else delete next[rowKey];
                                              return next;
                                            });
                                          }
                                          setViewSourcesActiveRow((prev) => prev && prev.attrKey === it.attrKey && prev.candidateIdx === it.candidateIdx ? null : prev);
                                          setViewSourcesTermPref((prev) => {
                                            if (prev[`${lineId}::${term}`] !== it.itemId) return prev;
                                            const next = { ...prev };
                                            delete next[`${lineId}::${term}`];
                                            return next;
                                          });
                                        };
                                        return (
                                          <div
                                            key={`vsm-${it.itemId}`}
                                            ref={(el) => { rowRefs.current[`${it.attrKey}::${it.candidateIdx}`] = el; }}
                                            onMouseEnter={() => setViewSourcesHoveredAttr(it.attrKey)}
                                            onMouseLeave={() => setViewSourcesHoveredAttr((prev) => prev === it.attrKey ? null : prev)}
                                            onClick={() => {
                                              setViewSourcesManualActive(false);
                                              setViewSourcesActiveRow({ attrKey: it.attrKey, candidateIdx: it.candidateIdx });
                                              const tabIdx = sources.indexOf(it.source);
                                              if (tabIdx >= 0) {
                                                setLineSourceViewer((prev) => prev ? { ...prev, activeIdx: tabIdx } : prev);
                                              }
                                            }}
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: '32px 1fr 1fr 0.9fr 1fr 40px',
                                              alignItems: 'stretch',
                                              borderBottom: isLast ? 'none' : '1px solid #e5e5e5',
                                              cursor: 'pointer',
                                              fontSize: '12px',
                                              color: '#2e2e2e',
                                              background: isActiveRow ? '#f0f8ff' : '#ffffff',
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }} onClick={(e) => e.stopPropagation()}>
                                              <input
                                                type="radio"
                                                name={`vsm-pref-${lineId}-${term}`}
                                                checked={checked}
                                                onChange={() => {
                                                  setViewSourcesTermPref((prev) => ({ ...prev, [`${lineId}::${term}`]: it.itemId }));
                                                  setViewSourcesActiveRow({ attrKey: it.attrKey, candidateIdx: it.candidateIdx });
                                                  const tabIdx = sources.indexOf(it.source);
                                                  if (tabIdx >= 0) {
                                                    setLineSourceViewer((prev) => prev ? { ...prev, activeIdx: tabIdx } : prev);
                                                  }
                                                }}
                                                style={{ cursor: 'pointer', margin: 0 }}
                                              />
                                            </div>
                                            <div title={it.field} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', fontWeight: 600, color: '#001e5b', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive ? ROW_DIM_STYLE : {}) }}>{it.field}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', minWidth: 0, ...(editActive ? ROW_DIM_STYLE : {}) }}>
                                              <span title={it.value || undefined} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#2e2e2e', opacity: it.override ? 0.5 : 1 }}>{it.value || <span style={{ color: '#a0a0a0' }}>—</span>}</span>
                                              {it.updated && (
                                                <span title="Updated Value" aria-label="Updated Value" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                                                  <Icon category="utility" name="refresh" size="x-small" className="slds-icon-text-error" />
                                                </span>
                                              )}
                                              <ConfidenceBadge score={it.confidence} />
                                            </div>
                                            <div title={it.source || undefined} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', color: '#2e2e2e', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive ? ROW_DIM_STYLE : {}) }}>{it.source || <span style={{ color: '#a0a0a0' }}>—</span>}</div>
                                            <div
                                              onClick={(e) => e.stopPropagation()}
                                              onMouseEnter={() => setViewSourcesHoverRow(rowKey)}
                                              onMouseLeave={() => setViewSourcesHoverRow((prev) => prev === rowKey ? null : prev)}
                                              style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', minWidth: 0, ...(dirtyCells.has(`ov:${rowKey}`) ? DIRTY_CELL_STYLE : (editActive ? EDIT_CELL_STYLE : {})) }}
                                            >
                                              {renderOverrideCell(rowKey, it.override, true)}
                                            </div>
                                            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); returnToPool(); }}
                                                title="Return to unmapped pool"
                                                aria-label="Return to unmapped pool"
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  padding: '4px',
                                                  border: 'none',
                                                  background: 'none',
                                                  color: '#0176D3',
                                                  cursor: 'pointer',
                                                }}
                                              >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="#0176D3" style={{ flexShrink: 0 }}>
                                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                                </svg>
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {/* Permanent manual-value row — no attribute, source = Manual, radio picks
                                          it as the winner. Cannot be deleted. */}
                                      {(() => {
                                        const manualEditKey = `${lineId}::${term}`;
                                        const editKeyMod = `mod:${manualEditKey}`;
                                        const manualVal = viewSourcesTermManual[manualEditKey] || '';
                                        const manualChecked = preferredId === '__manual__';
                                        const isEditing = viewSourcesEditingManual === editKeyMod;
                                        const manualEditActive = viewSourcesHoverRow === manualEditKey || isEditing;
                                        return (
                                          <div
                                            key={`vsm-manual-${term}`}
                                            onClick={() => { setViewSourcesManualActive(true); setViewSourcesActiveRow(null); }}
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: '32px 1fr 1fr 0.9fr 1fr 40px',
                                              alignItems: 'stretch',
                                              borderTop: groupItems.length > 0 ? '1px solid #e5e5e5' : 'none',
                                              fontSize: '12px',
                                              color: '#2e2e2e',
                                              background: viewSourcesManualActive ? '#f0f8ff' : '#ffffff',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }} onClick={(e) => e.stopPropagation()}>
                                              <input
                                                type="radio"
                                                name={`vsm-pref-${lineId}-${term}`}
                                                checked={manualChecked}
                                                onChange={() => {
                                                  setViewSourcesTermPref((prev) => ({ ...prev, [manualEditKey]: '__manual__' }));
                                                  if (!manualVal) setViewSourcesEditingManual(editKeyMod);
                                                }}
                                                style={{ cursor: 'pointer', margin: 0 }}
                                              />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', color: '#2e2e2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(manualEditActive ? ROW_DIM_STYLE : {}) }} title={term}>{term}</div>
                                            <div
                                              onClick={(e) => e.stopPropagation()}
                                              onMouseEnter={() => setViewSourcesHoverRow(manualEditKey)}
                                              onMouseLeave={() => setViewSourcesHoverRow((prev) => prev === manualEditKey ? null : prev)}
                                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', minWidth: 0, ...(dirtyCells.has(`man:${manualEditKey}`) ? DIRTY_CELL_STYLE : (manualEditActive ? EDIT_CELL_STYLE : {})) }}
                                            >
                                              {isEditing ? (
                                                <input
                                                  type="text"
                                                  autoFocus
                                                  defaultValue={manualVal}
                                                  placeholder="Enter a value"
                                                  onBlur={(e) => commitManual(term, e.target.value)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                                                    else if (e.key === 'Escape') { setViewSourcesEditingManual(null); }
                                                  }}
                                                  style={{ width: '100%', padding: '4px 6px', fontSize: '12px', border: '1px solid #0176D3', borderRadius: '4px', boxSizing: 'border-box', color: '#2e2e2e' }}
                                                />
                                              ) : (
                                                <>
                                                  <span
                                                    onClick={() => setViewSourcesEditingManual(editKeyMod)}
                                                    title={manualVal || 'Click to enter a value'}
                                                    style={{ flex: 1, minWidth: 0, cursor: 'text', color: manualVal ? '#2e2e2e' : '#939393', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                  >
                                                    {manualVal || <span style={{ fontStyle: 'italic' }}>Add value</span>}
                                                  </span>
                                                  {manualEditActive && (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => { e.stopPropagation(); setViewSourcesEditingManual(editKeyMod); }}
                                                      title="Edit value"
                                                      aria-label="Edit value"
                                                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#0176D3', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                                                    >
                                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                                                    </button>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', color: '#2e2e2e', fontWeight: 400, ...(manualEditActive ? ROW_DIM_STYLE : {}) }}>Manual</div>
                                            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', color: '#c9c9c9' }}>—</div>
                                            <div />
                                          </div>
                                        );
                                      })()}
                                      {showDiscUI && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); resolveTerm(); }}
                                            style={{ padding: 0, border: 'none', background: 'none', color: '#0176D3', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                          >
                                            Mark as Resolved
                                          </button>
                                        </div>
                                      )}
                                      </div>
                                      )}
                                    </div>
                                    );
                      };

                      // Reconcile-mode left hierarchy. Mirrors the main Submission Lines tree, but:
                      // only lines with a live discrepancy (plus their full ancestor chain) are shown;
                      // ancestor nodes without discrepancies render as non-selectable expandable nodes;
                      // each node that carries discrepancies shows a count badge. No checkboxes / row menu.
                      const reconcileIssueCount = (id: string): number => {
                        if (reconcileResolvedLines.has(id)) return 0;
                        const st = lineDiscrepancyState(id);
                        return st.unmappedTerms.length + st.unresolvedSource.length + st.lowConfidence.length;
                      };
                      // Selectable lines: those with discrepancies, plus the currently-open line (stays visible
                      // until Save & Next marks it resolved).
                      const reconcileErrorIds = new Set<string>(
                        submissionLines.filter((l) => l.id === lineId || reconcileIssueCount(l.id) > 0).map((l) => l.id)
                      );
                      // Visible node set = every error line plus all of its ancestors.
                      const reconcileVisibleIds = new Set<string>();
                      reconcileErrorIds.forEach((id) => {
                        reconcileVisibleIds.add(id);
                        let pid = effectiveParentId(id);
                        while (pid && !reconcileVisibleIds.has(pid)) {
                          reconcileVisibleIds.add(pid);
                          pid = effectiveParentId(pid);
                        }
                      });
                      const reconcileRoots = submissionLines.filter((l) => reconcileVisibleIds.has(l.id) && !effectiveParentId(l.id));
                      const renderReconcileNode = (node: typeof submissionLines[0], level: number = 0): React.ReactNode => {
                        const children = submissionLines.filter((l) => effectiveParentId(l.id) === node.id && reconcileVisibleIds.has(l.id));
                        const hasChildren = children.length > 0;
                        const isExpanded = !reconcileTreeCollapsed.has(node.id);
                        const issues = reconcileIssueCount(node.id);
                        const selectable = reconcileErrorIds.has(node.id);
                        const isActiveLine = node.id === lineId;
                        const canClick = selectable && !isActiveLine;
                        return (
                          <React.Fragment key={`recon-node-${node.id}`}>
                            <div
                              onClick={canClick ? () => guardNav(() => switchToLine(node.id)) : undefined}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 12px',
                                paddingLeft: `${12 + level * 16}px`,
                                borderLeft: isActiveLine ? '3px solid #0176D3' : '3px solid transparent',
                                backgroundColor: isActiveLine ? '#e8f1fb' : 'transparent',
                                cursor: canClick ? 'pointer' : 'default',
                                borderBottom: '1px solid #ececec',
                                fontSize: '13px',
                                lineHeight: '17px',
                              }}
                              onMouseEnter={(e) => { if (canClick) e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                              onMouseLeave={(e) => { if (canClick) e.currentTarget.style.backgroundColor = isActiveLine ? '#e8f1fb' : 'transparent'; }}
                            >
                              {hasChildren ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReconcileTreeCollapsed((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                                      return next;
                                    });
                                  }}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', color: '#5c5c5c', flexShrink: 0 }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                                  </svg>
                                </button>
                              ) : (
                                <span style={{ width: '14px', flexShrink: 0 }} />
                              )}
                              <span style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: selectable ? (isActiveLine ? '#001e5b' : '#0176D3') : '#5c5c5c',
                                fontWeight: isActiveLine ? 600 : (level === 0 ? 600 : 400),
                              }}>
                                {node.name}
                              </span>
                              {issues > 0 && (
                                <span style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#B85C00', backgroundColor: '#fef5e8', border: '1px solid #f0d9b5', borderRadius: '10px', padding: '0 7px', lineHeight: '16px' }}>{issues}</span>
                              )}
                            </div>
                            {isExpanded && children.map((child) => renderReconcileNode(child, level + 1))}
                          </React.Fragment>
                        );
                      };

                      return (
                        <div
                          style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: vsStandalone ? '#fff' : 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10000,
                          }}
                          onClick={vsStandalone ? undefined : closeModal}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              backgroundColor: 'white',
                              borderRadius: vsStandalone ? 0 : '8px',
                              width: vsStandalone ? '100vw' : '90vw',
                              maxWidth: vsStandalone ? '100vw' : '90vw',
                              height: vsStandalone ? '100vh' : '88vh',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                              boxShadow: vsStandalone ? 'none' : '0 8px 32px rgba(0, 0, 0, 0.24)',
                            }}
                          >
                            {vsStandalone ? (
                              /* Full-screen tab — navy Salesforce builder header, matching LOB Data full-screen. */
                              <div style={{
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                height: '48px',
                                paddingRight: '16px',
                                backgroundColor: '#032D60',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                  <button
                                    onClick={() => window.close()}
                                    title="Back"
                                    aria-label="Back"
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', width: '48px', height: '48px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                                  </button>
                                  <span style={{ fontSize: '14px', color: '#c9d4e0', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                                    {lineRecord ? `${lineRecord.lineOfBusiness || 'Commercial Property'} LOB` : 'Commercial Property LOB'}
                                  </span>
                                  <span style={{ fontSize: '14px', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginLeft: '48px' }}>
                                    {singleTerm ? `Select Source · ${singleTerm}` : isReconcile ? 'Resolve Attribute Mapping' : (lineRecord ? lineRecord.name : 'Submission Line')}
                                  </span>
                                </div>
                              </div>
                            ) : (
                            <div style={{
                              flexShrink: 0,
                              padding: '16px 24px',
                              borderBottom: '1px solid #e5e5e5',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#001e5b', margin: 0 }}>
                                {singleTerm ? 'Select Source' : isReconcile ? 'Resolve Attribute Mapping' : (lineRecord ? lineRecord.name : 'Submission Line')}
                                {singleTerm && (
                                  <span style={{ fontWeight: 400, color: '#5c5c5c', marginLeft: '10px', fontSize: '15px' }}>· {singleTerm}</span>
                                )}
                              </h2>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {!singleTerm && (
                                <button
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      vsLine: lineId,
                                      vsMode: isReconcile ? 'reconcile' : 'view',
                                      vsIdx: String(lineSourceViewer.activeIdx),
                                      vsTab: activeTab,
                                      vsSources: (lineSourceViewer.sources || []).join('|'),
                                    });
                                    window.open(`${ASSET_PREFIX}/submission-lines/${lineId}?${params.toString()}`, '_blank');
                                  }}
                                  title="Open in new tab"
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#5c5c5c">
                                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                                  </svg>
                                </button>
                                )}
                                <button
                                  onClick={closeModal}
                                  title="Close"
                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#5c5c5c">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            )}

                            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                              {/* Reconcile mode — submission-line queue selector */}
                              {isReconcile && (
                                <>
                                <div ref={reconcileQueueRef} style={{
                                  width: `${reconcileQueueWidth}px`,
                                  flexShrink: 0,
                                  borderRight: '1px solid #e5e5e5',
                                  backgroundColor: '#fafafa',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid #e5e5e5',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#5c5c5c',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                  }}>
                                    Lines with Discrepancies ({reconcileList.filter((id) => !reconcileResolvedLines.has(id) || id === lineId).length})
                                  </div>
                                  <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {reconcileRoots.length === 0 ? (
                                      <div style={{ padding: '16px', fontSize: '13px', color: '#5c5c5c' }}>No discrepancies remain.</div>
                                    ) : (
                                      reconcileRoots.map((root) => renderReconcileNode(root, 0))
                                    )}
                                  </div>
                                </div>
                                {/* Drag handle to resize the queue column */}
                                <div
                                  onMouseDown={startReconcileQueueResize}
                                  title="Drag to resize"
                                  style={{
                                    width: '6px',
                                    flexShrink: 0,
                                    cursor: 'col-resize',
                                    backgroundColor: '#e5e5e5',
                                    alignSelf: 'stretch',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0176D3'; }}
                                  onMouseLeave={(e) => { if (!reconcileQueueResizeRef.current) e.currentTarget.style.backgroundColor = '#e5e5e5'; }}
                                >
                                  <div style={{
                                    width: '4px',
                                    height: '32px',
                                    borderRadius: '2px',
                                    backgroundColor: '#939393',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    pointerEvents: 'none',
                                  }}>
                                    <span style={{ width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'white' }} />
                                    <span style={{ width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'white' }} />
                                    <span style={{ width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'white' }} />
                                  </div>
                                </div>
                                </>
                              )}
                              {/* Left pane — source dropdown above the doc viewer + scroll-marker rail */}
                              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e5e5', minWidth: 0, minHeight: 0 }}>
                                {/* Document source dropdown — sits above the canvas in every mode */}
                                {docSources.length > 0 && (
                                  <div style={{ flexShrink: 0, padding: '10px 12px', borderBottom: '1px solid #e5e5e5', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#5c5c5c', whiteSpace: 'nowrap' }}>Document</label>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                      <button
                                        type="button"
                                        onClick={() => setReconcileDocMenuOpen((o) => !o)}
                                        onBlur={() => setReconcileDocMenuOpen(false)}
                                        style={{
                                          width: '100%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '8px',
                                          padding: '6px 8px',
                                          fontSize: '13px',
                                          border: '1px solid #c9c9c9',
                                          borderRadius: '4px',
                                          color: '#2e2e2e',
                                          fontWeight: 600,
                                          backgroundColor: 'white',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                        }}
                                      >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewerSource}</span>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#5c5c5c" style={{ flexShrink: 0, transform: reconcileDocMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                                        </svg>
                                      </button>
                                      {reconcileDocMenuOpen && (
                                        <div style={{
                                          position: 'absolute',
                                          top: 'calc(100% + 4px)',
                                          left: 0,
                                          right: 0,
                                          backgroundColor: 'white',
                                          border: '1px solid #c9c9c9',
                                          borderRadius: '4px',
                                          boxShadow: '0 4px 12px rgba(0,0,0,0.16)',
                                          zIndex: 10,
                                          overflow: 'hidden',
                                        }}>
                                          {docSources.map((src, i) => {
                                            const isSel = src === viewerSource;
                                            return (
                                              <button
                                                key={`docopt-${src}-${i}`}
                                                type="button"
                                                // onMouseDown fires before the trigger's onBlur, so the click registers.
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  setLineSourceViewer((prev) => prev ? { ...prev, activeIdx: i } : prev);
                                                  setViewSourcesActiveRow(null);
                                                  setReconcileDocMenuOpen(false);
                                                }}
                                                style={{
                                                  display: 'block',
                                                  width: '100%',
                                                  padding: '8px 10px',
                                                  border: 'none',
                                                  background: isSel ? '#eaf3fc' : 'white',
                                                  color: '#2e2e2e',
                                                  fontSize: '13px',
                                                  fontWeight: isSel ? 700 : 600,
                                                  cursor: 'pointer',
                                                  textAlign: 'left',
                                                  whiteSpace: 'nowrap',
                                                }}
                                                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = '#f3f7fb'; }}
                                                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'white'; }}
                                              >
                                                {src}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Document viewer + scroll marker rail */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minWidth: 0, minHeight: 0, position: 'relative' }}>
                                  {(() => {
                                    // Spreadsheet fills the canvas top-left with no padding; its zoom
                                    // scales the cells internally, so no outer scale transform.
                                    const viewerIsSheet = docFileType(viewerSource) === 'xls';
                                    // Message states (manual value / enrichment) show a centered note on a
                                    // light-grey canvas instead of a source document — no dark canvas, no zoom.
                                    const viewerIsMessage = viewSourcesManualActive || docFileType(viewerSource) === 'json';
                                    if (viewerIsMessage) {
                                      return (
                                        <div
                                          ref={docScrollRef}
                                          style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f3f3f3', position: 'relative' }}
                                        >
                                          {viewSourcesManualActive ? (
                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px' }}>
                                              <div style={{ maxWidth: '340px' }}>
                                                <svg width="44" height="44" viewBox="0 0 24 24" fill="#B85C00" style={{ marginBottom: '14px' }}>
                                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                </svg>
                                                <div style={{ fontSize: '15px', fontWeight: 600, color: '#2e2e2e', marginBottom: '8px' }}>Manually updated value</div>
                                                <div style={{ fontSize: '13px', color: '#5c5c5c', lineHeight: '19px' }}>This value was entered manually, so there is no source document to preview.</div>
                                              </div>
                                            </div>
                                          ) : (
                                            enrichmentDoc(viewerSource)
                                          )}
                                        </div>
                                      );
                                    }
                                    return (
                                  <div
                                    ref={docScrollRef}
                                    style={{ flex: 1, overflowY: viewerIsSheet ? 'hidden' : 'auto', backgroundColor: '#525659', padding: viewerIsSheet ? 0 : '24px', position: 'relative' }}
                                  >
                                    {singleTerm && docSources.length === 0 ? (
                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bdbdbd', fontSize: '13px', textAlign: 'center' }}>
                                          <div>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="#9e9e9e" style={{ marginBottom: '12px' }}>
                                              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                                            </svg>
                                            <div>No source documents</div>
                                            <div style={{ marginTop: '8px', fontSize: '12px', maxWidth: '260px' }}>Map an attribute to this canonical term to view its source documents.</div>
                                          </div>
                                        </div>
                                      ) : lineCanonicalKey === 'a01SB00001p8B6rYAE'
                                      ? (
                                        viewerIsSheet ? (
                                          <div style={{ width: '100%', height: '100%' }}>
                                            {renderDoc(viewerSource, highlightValue)}
                                          </div>
                                        ) : (
                                        <div style={{ transform: `scale(${docZoom})`, transformOrigin: 'top center', transition: 'transform 0.12s ease-out' }}>
                                          {renderDoc(viewerSource, highlightValue)}
                                        </div>
                                        )
                                      )
                                      : (
                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bdbdbd', fontSize: '13px', textAlign: 'center' }}>
                                          <div>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="#9e9e9e" style={{ marginBottom: '12px' }}>
                                              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                                            </svg>
                                            <div>Documents go here</div>
                                            <div style={{ marginTop: '8px', fontSize: '12px' }}>{viewerSource}</div>
                                          </div>
                                        </div>
                                      )
                                    }
                                  </div>
                                    );
                                  })()}
                                  {/* Zoom toolbar — floats bottom-right of the canvas, applies to every file type */}
                                  {lineCanonicalKey === 'a01SB00001p8B6rYAE' && !(singleTerm && docSources.length === 0) && !viewSourcesManualActive && docFileType(viewerSource) !== 'json' && (
                                    <div style={{ position: 'absolute', bottom: '12px', right: '30px', display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'rgba(32,33,36,0.92)', borderRadius: '6px', padding: '3px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', zIndex: 5 }}>
                                      <button
                                        type="button"
                                        onClick={() => setDocZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                                        title="Zoom out"
                                        style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', borderRadius: '4px', fontSize: '18px', lineHeight: 1 }}
                                      >−</button>
                                      <button
                                        type="button"
                                        onClick={() => setDocZoom(1)}
                                        title="Reset zoom"
                                        style={{ minWidth: '46px', height: '26px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}
                                      >{Math.round(docZoom * 100)}%</button>
                                      <button
                                        type="button"
                                        onClick={() => setDocZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                                        title="Zoom in"
                                        style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', borderRadius: '4px', fontSize: '18px', lineHeight: 1 }}
                                      >+</button>
                                    </div>
                                  )}
                                  {/* Scroll marker rail — bookmark-shaped ticks colored by the active source */}
                                  {markerPositions.length > 0 && (() => {
                                    const activeAttrKey = viewSourcesActiveRow?.attrKey ?? null;
                                    return (
                                      <div style={{
                                        width: '18px',
                                        flexShrink: 0,
                                        backgroundColor: 'transparent',
                                        position: 'relative',
                                      }}>
                                        {markerPositions.map((m, i) => {
                                          const isActiveMarker = (!!activeAttrKey && m.attrKey === activeAttrKey)
                                            || (!!viewSourcesHoveredAttr && m.attrKey === viewSourcesHoveredAttr);
                                          return (
                                          <button
                                            key={`marker-${i}`}
                                            onClick={() => {
                                              const el = docScrollRef.current;
                                              if (el) {
                                                const target = m.fraction * (el.scrollHeight - el.clientHeight);
                                                el.scrollTo({ top: target, behavior: 'smooth' });
                                              }
                                              if (m.attrKey) {
                                                setViewSourcesExpandedAttr(m.attrKey);
                                                // Auto-pick the candidate on this source so the active highlight matches.
                                                const card = cards.find((c) => c.attrKey === m.attrKey);
                                                if (card) {
                                                  const candIdx = card.candidates.findIndex((c) => c.source === activeSourceName);
                                                  if (candIdx >= 0) {
                                                    setViewSourcesActiveRow({ attrKey: m.attrKey, candidateIdx: candIdx });
                                                  }
                                                }
                                              }
                                            }}
                                            title={m.attrKey ? `Jump to ${m.attrKey}` : 'Jump to match'}
                                            onMouseEnter={() => { if (m.attrKey) setViewSourcesHoveredAttr(m.attrKey); }}
                                            onMouseLeave={() => setViewSourcesHoveredAttr((prev) => prev === m.attrKey ? null : prev)}
                                            style={{
                                              position: 'absolute',
                                              top: `${m.fraction * 100}%`,
                                              left: 0,
                                              width: '14px',
                                              height: '14px',
                                              border: 'none',
                                              padding: 0,
                                              backgroundColor: isActiveMarker ? '#0176D3' : '#939393',
                                              opacity: isActiveMarker ? 1 : 0.7,
                                              cursor: 'pointer',
                                              transform: 'translateY(-7px)',
                                              clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                                              boxShadow: isActiveMarker ? '0 1px 2px rgba(0,0,0,0.35)' : 'none',
                                            }}
                                          />
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Right pane — canonical-term cards */}
                              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <div ref={rightPaneRef} style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                                  {!singleTerm && lineRecord && (
                                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#001e5b', marginBottom: '12px' }}>
                                      {lineRecord.name}
                                    </div>
                                  )}
                                  {/* Single-term mode — render exactly one canonical-term box, no tabs. */}
                                  {singleTerm && singleTermGroup && (
                                    renderTermBox(singleTermGroup[0], singleTermGroup[1], discTermSet.has(singleTerm) ? 'discrepancy' : 'default')
                                  )}
                                  {/* Mapped / Unmapped tabs */}
                                  {!singleTerm && (<>
                                  <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e5e5', marginBottom: '12px' }}>
                                    {([
                                      ...(discCount > 0 ? [{ key: 'discrepancies' as const, label: `Discrepancies (${discCount})` }] : []),
                                      { key: 'mapped' as const, label: `Attributes` },
                                      { key: 'unmapped' as const, label: `Extracted Data (${poolItems.length})` },
                                    ]).map((t) => {
                                      const isActive = activeTab === t.key;
                                      return (
                                        <button
                                          key={t.key}
                                          onClick={() => {
                                            setViewSourcesTab(t.key);
                                            setViewSourcesExpandedAttr(null);
                                            setViewSourcesActiveRow(null);
                                            setViewSourcesUnmappedAttr(null);
                                            setViewSourcesUnmappedGroup(null);
                                          }}
                                          style={{
                                            padding: '8px 14px',
                                            border: 'none',
                                            borderBottom: `2px solid ${isActive ? '#0176D3' : 'transparent'}`,
                                            background: 'none',
                                            color: isActive ? '#0176D3' : '#5c5c5c',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            marginBottom: '-1px',
                                          }}
                                        >
                                          {t.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {(activeTab === 'mapped' || activeTab === 'unmapped') && cards.length > 0 && (
                                    <label style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      fontSize: '12px',
                                      color: '#2e2e2e',
                                      cursor: 'pointer',
                                      marginBottom: '12px',
                                    }}>
                                      <input
                                        type="checkbox"
                                        checked={viewSourcesOnlyActiveDoc}
                                        onChange={(e) => setViewSourcesOnlyActiveDoc(e.target.checked)}
                                        style={{ accentColor: '#0176D3', cursor: 'pointer', margin: 0 }}
                                      />
                                      <span>Only show values from the selected doc</span>
                                    </label>
                                  )}
                                  {(activeTab === 'mapped' || activeTab === 'discrepancies') && cards.length > 0 && (
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '8px',
                                      backgroundColor: '#eaf3fc',
                                      border: '1px solid #b6d8f4',
                                      borderLeft: '4px solid #0176D3',
                                      borderRadius: '4px',
                                      padding: '8px 12px',
                                      fontSize: '12px',
                                      color: '#014486',
                                      lineHeight: '17px',
                                      marginBottom: '12px',
                                    }}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#0176D3" style={{ flexShrink: 0, marginTop: '1px' }}>
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                                      </svg>
                                      <span>Set an <strong>Override Value</strong> on any row to replace its extracted value while keeping the attribute and source intact.</span>
                                    </div>
                                  )}
                                  {activeTab === 'discrepancies' && shownGroups.length > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                                      <button
                                        onClick={() => {
                                          setReconcileResolvedLines((prev) => {
                                            const nextSet = new Set(prev);
                                            nextSet.add(lineId);
                                            return nextSet;
                                          });
                                          setViewSourcesTab('mapped');
                                        }}
                                        style={{ padding: '7px 14px', borderRadius: '4px', border: '1px solid #c9c9c9', background: '#fff', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                      >
                                        Mark all as resolved
                                      </button>
                                    </div>
                                  )}
                                  {activeTab === 'discrepancies' && shownGroups.length === 0 && (
                                    <div style={{ fontSize: '13px', color: '#5c5c5c', padding: '24px 0', textAlign: 'center' }}>
                                      No discrepancies for this line.
                                    </div>
                                  )}
                                  {/* Discrepancies tab — flat canonical-term boxes (no category sections);
                                      the category is a sub-line under each term. */}
                                  {activeTab === 'discrepancies' && shownGroups.map(([term, groupItems]) =>
                                    renderTermBox(term, groupItems, 'discrepancy')
                                  )}
                                  {/* Canonical tab — grouped into collapsible category sections. */}
                                  {activeTab === 'mapped' && (viewSourcesOnlyActiveDoc && mappedVisible.length === 0 ? (
                                    <div style={{ fontSize: '13px', color: '#5c5c5c', padding: '24px 0', textAlign: 'center' }}>
                                      No selected values come from {activeSourceName}.
                                    </div>
                                  ) : modalSections.map((section) => {
                                    const isSecOpen = isCanonicalCatOpen(section.category, section.dataCount > 0);
                                    return (
                                    <div key={`vs-sec-${section.category}`} style={{ border: '1px solid #e5e5e5', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                                      <button
                                        onClick={() => toggleCanonicalCat(section.category, isSecOpen)}
                                        style={{
                                          width: '100%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '10px 14px',
                                          background: '#fafafa',
                                          border: 'none',
                                          borderBottom: isSecOpen ? '1px solid #e5e5e5' : 'none',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                        }}
                                      >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#0176D3" style={{ transform: isSecOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                                            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                                          </svg>
                                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>{section.category}</span>
                                          <span style={{ fontSize: '11px', color: '#706E6B' }}>· {section.dataCount} of {section.groups.length} mapped</span>
                                        </span>
                                      </button>
                                      {isSecOpen && (<div style={{ padding: '8px' }}>{section.groups.map(([term, groupItems]) =>
                                        renderTermBox(term, groupItems, 'default')
                                      )}</div>)}
                                    </div>
                                    );
                                  }))}

                                  {/* Extracted Data tab — full inventory of every extraction (mapped or not) */}
                                  {activeTab === 'unmapped' && (poolItems.length === 0 ? (
                                    <div style={{ fontSize: '13px', color: '#5c5c5c', padding: '24px 0', textAlign: 'center' }}>
                                      No extracted data for this line.
                                    </div>
                                  ) : extractedSorted.length === 0 ? (
                                    <div style={{ fontSize: '13px', color: '#5c5c5c', padding: '24px 0', textAlign: 'center' }}>
                                      No extracted values come from {activeSourceName}.
                                    </div>
                                  ) : (
                                    <div style={{
                                      border: '1px solid #e5e5e5',
                                      borderRadius: '8px',
                                      backgroundColor: 'white',
                                      overflow: 'hidden',
                                    }}>
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1.2fr 1fr 0.9fr 1fr 116px',
                                        borderBottom: '1px solid #e5e5e5',
                                        backgroundColor: '#fafafa',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: '#5c5c5c',
                                        alignItems: 'center',
                                      }}>
                                        <div style={{ padding: '8px 12px' }}>Attribute</div>
                                        <div style={{ padding: '8px 12px' }}>Value</div>
                                        <div style={{ padding: '8px 12px' }}>Source</div>
                                        <div style={{ padding: '8px 12px' }}>Override Value</div>
                                        <div style={{ padding: '8px 12px' }}>Status</div>
                                      </div>
                                      {extractedSorted.map((card, rowIdx) => {
                                        const rowKey = `${lineId}::${card.attrKey}::${card.candidateIdx}`;
                                        const isSelected = !!activeRow && activeRow.attrKey === card.attrKey && activeRow.candidateIdx === card.candidateIdx;
                                        const editActive = viewSourcesHoverRow === rowKey || viewSourcesEditingRow === rowKey;
                                        const isLast = rowIdx === extractedSorted.length - 1;
                                        const { associated, selected } = itemAssociations(card);
                                        const status = selected.length > 0 ? 'Selected' : associated.length > 0 ? 'Associated' : 'Unassociated';
                                        const statusStyle = status === 'Selected'
                                          ? { color: '#2E844A', backgroundColor: '#e7f5ec', border: '1px solid #b5e0c4' }
                                          : status === 'Associated'
                                            ? { color: '#0176D3', backgroundColor: '#eef4ff', border: '1px solid #c3dbf7' }
                                            : { color: '#5c5c5c', backgroundColor: '#f3f3f3', border: '1px solid #dddbda' };
                                        return (
                                          <div
                                            key={card.itemId}
                                            ref={(el) => { rowRefs.current[`${card.attrKey}::${card.candidateIdx}`] = el; }}
                                            onMouseEnter={() => setViewSourcesHoveredAttr(card.attrKey)}
                                            onMouseLeave={() => setViewSourcesHoveredAttr((prev) => prev === card.attrKey ? null : prev)}
                                            onClick={() => {
                                              if (isSelected) {
                                                setViewSourcesActiveRow(null);
                                              } else {
                                                setViewSourcesActiveRow({ attrKey: card.attrKey, candidateIdx: card.candidateIdx });
                                                const tabIdx = sources.indexOf(card.source);
                                                if (tabIdx >= 0) {
                                                  setLineSourceViewer((prev) => prev ? { ...prev, activeIdx: tabIdx } : prev);
                                                }
                                              }
                                            }}
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: '1.2fr 1fr 0.9fr 1fr 116px',
                                              alignItems: 'stretch',
                                              width: '100%',
                                              borderBottom: isLast ? 'none' : '1px solid #e5e5e5',
                                              background: isSelected ? '#f0f8ff' : 'white',
                                              cursor: 'pointer',
                                              textAlign: 'left',
                                              fontSize: '12px',
                                              color: '#2e2e2e',
                                            }}
                                          >
                                            <div title={card.field} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', fontWeight: 600, color: '#001e5b', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive ? ROW_DIM_STYLE : {}) }}>{card.field}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', minWidth: 0, color: '#2e2e2e', ...(editActive ? ROW_DIM_STYLE : {}) }}>
                                              <span title={card.value || undefined} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: card.override ? 0.5 : 1 }}>{card.value || <span style={{ color: '#a0a0a0' }}>—</span>}</span>
                                              {card.updated && (
                                                <span title="Updated Value" aria-label="Updated Value" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                                                  <Icon category="utility" name="refresh" size="x-small" className="slds-icon-text-error" />
                                                </span>
                                              )}
                                            </div>
                                            <div title={card.source || undefined} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', color: '#2e2e2e', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive ? ROW_DIM_STYLE : {}) }}>{card.source || <span style={{ color: '#a0a0a0' }}>—</span>}</div>
                                            <div
                                              onClick={(e) => e.stopPropagation()}
                                              onMouseEnter={() => setViewSourcesHoverRow(rowKey)}
                                              onMouseLeave={() => setViewSourcesHoverRow((prev) => prev === rowKey ? null : prev)}
                                              style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', ...(dirtyCells.has(`ov:${rowKey}`) ? DIRTY_CELL_STYLE : (editActive ? EDIT_CELL_STYLE : {})) }}
                                            >
                                              {renderOverrideCell(rowKey, card.override, true)}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '10px 12px', ...(editActive ? ROW_DIM_STYLE : {}) }} onClick={(e) => e.stopPropagation()}>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (statusPopover && statusPopover.key === rowKey) {
                                                    setStatusPopover(null);
                                                  } else {
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    setStatusPopover({ key: rowKey, top: r.bottom + 4, left: Math.max(8, r.right - 260), associated, selected });
                                                  }
                                                }}
                                                title="View canonical-term associations"
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '4px',
                                                  padding: '3px 8px',
                                                  borderRadius: '11px',
                                                  fontSize: '11px',
                                                  fontWeight: 600,
                                                  cursor: 'pointer',
                                                  ...statusStyle,
                                                }}
                                              >
                                                {status}
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                  </>)}
                                </div>
                              </div>
                            </div>

                            <div style={{
                              flexShrink: 0,
                              padding: '12px 24px',
                              borderTop: '1px solid #e5e5e5',
                              backgroundColor: '#fafafa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: isReconcile ? 'space-between' : 'flex-end',
                              gap: '12px',
                            }}>
                              {isReconcile ? (
                                <>
                                  {(() => {
                                    const linesRemaining = reconcileList.filter((id) => !reconcileResolvedLines.has(id) && lineDiscrepancyState(id).hasAny).length;
                                    return (
                                      <div style={{ fontSize: '12px', color: linesRemaining > 0 ? '#B85C00' : '#2E844A', fontWeight: 600 }}>
                                        {linesRemaining > 0
                                          ? `${linesRemaining} submission line${linesRemaining === 1 ? '' : 's'} remaining`
                                          : 'All submission lines resolved'}
                                      </div>
                                    );
                                  })()}
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={goReconPrev}
                                      disabled={reconcileIdx <= 0}
                                      style={{ padding: '8px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', backgroundColor: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: reconcileIdx <= 0 ? 'not-allowed' : 'pointer', opacity: reconcileIdx <= 0 ? 0.5 : 1 }}
                                    >
                                      Previous
                                    </button>
                                    <button
                                      onClick={goReconSkip}
                                      style={{ padding: '8px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', backgroundColor: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                      Skip
                                    </button>
                                    <button
                                      onClick={goReconSaveNext}
                                      style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                      Save &amp; Next
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => { cancelDirty(); closeModal(); }}
                                    style={{
                                      padding: '8px 20px',
                                      border: '1px solid #c9c9c9',
                                      borderRadius: '4px',
                                      backgroundColor: 'white',
                                      color: '#001e5b',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => { saveDirty(); closeModal(); }}
                                    style={{
                                      padding: '8px 20px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      backgroundColor: '#0176D3',
                                      color: 'white',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Save
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* View on Map Modal */}
                    {mapModalLineId && (() => {
                      const modalLocations = submissionLines
                        .filter((l) => l.lineType === 'Location' && !!locationCoordinates[l.id])
                        .map((l) => {
                          const c = locationCoordinates[l.id];
                          return {
                            id: l.id,
                            name: l.name,
                            lat: c.lat,
                            lng: c.lng,
                            address: c.address,
                            insuredValue: l.insuredValue,
                            premium: l.premiumAllocation,
                          };
                        });
                      const launchName = submissionLines.find((l) => l.id === mapModalLineId)?.name;
                      return (
                        <div
                          onClick={() => setMapModalLineId(null)}
                          style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            zIndex: 9000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              width: '94vw',
                              maxWidth: '1500px',
                              maxHeight: '90vh',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                padding: '16px 24px',
                                borderBottom: '1px solid #e5e5e5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#001e5b' }}>
                                Location Map{launchName ? ` · ${launchName}` : ''}
                              </div>
                              <button
                                onClick={() => setMapModalLineId(null)}
                                aria-label="Close"
                                title="Close"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  border: 'none',
                                  background: 'none',
                                  borderRadius: '50%',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#5c5c5c',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                              </button>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <LocationsMap locations={modalLocations} initialSelectedId={mapModalLineId} height="78vh" />
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Move Submission Lines Modal */}
                    {isMoveOpen && (() => {
                      const moveIds = moveSourceIds ?? Array.from(treeSelectedIds);
                      const selectedLines = moveIds
                        .map((id) => submissionLines.find((l) => l.id === id))
                        .filter((l): l is typeof submissionLines[0] => !!l);

                      const allowedTargetTypesFor = (lineType: string): string[] => {
                        if (lineType === 'Building') return ['Location'];
                        if (lineType === 'Equipment / Contents') return ['Building'];
                        if (lineType === 'Coverage') return ['Location', 'Building', 'Equipment / Contents'];
                        return [];
                      };

                      const eligible = selectedLines.filter((l) => allowedTargetTypesFor(l.lineType).length > 0);
                      const ineligible = selectedLines.filter((l) => allowedTargetTypesFor(l.lineType).length === 0);

                      let intersectedTypes: string[] = [];
                      if (eligible.length > 0) {
                        intersectedTypes = allowedTargetTypesFor(eligible[0].lineType);
                        for (let i = 1; i < eligible.length; i++) {
                          const next = allowedTargetTypesFor(eligible[i].lineType);
                          intersectedTypes = intersectedTypes.filter((t) => next.includes(t));
                        }
                      }

                      const selectedIdSet = new Set(selectedLines.map((l) => l.id));
                      const isDescendantOfAnySelected = (candidateId: string): boolean => {
                        let cur: string | null = candidateId;
                        const seen = new Set<string>();
                        while (cur && !seen.has(cur)) {
                          seen.add(cur);
                          if (selectedIdSet.has(cur)) return true;
                          cur = effectiveParentId(cur);
                        }
                        return false;
                      };

                      const candidateTargets = submissionLines.filter((l) =>
                        intersectedTypes.includes(l.lineType) && !selectedIdSet.has(l.id) && !isDescendantOfAnySelected(l.id)
                      );
                      const validTargetIds = new Set(candidateTargets.map((t) => t.id));

                      // Ancestor chain (ids, root-first) for a line via effective parents.
                      const ancestorIdsOf = (lineId: string): string[] => {
                        const chain: string[] = [];
                        let pid = effectiveParentId(lineId);
                        const seen = new Set<string>();
                        while (pid && !seen.has(pid)) {
                          seen.add(pid);
                          chain.unshift(pid);
                          pid = effectiveParentId(pid);
                        }
                        return chain;
                      };

                      // Target hierarchy: every valid target plus its lineage (ancestors), so the
                      // user sees where a move lands even when the intermediate parents themselves
                      // aren't valid destinations. Search matches a target by its own name or any
                      // ancestor's name; the whole matching lineage stays visible.
                      const moveQuery = moveSearch.trim().toLowerCase();
                      const targetVisibleIds = new Set<string>();
                      candidateTargets.forEach((t) => {
                        const chain = ancestorIdsOf(t.id);
                        if (moveQuery) {
                          const names = [t.name, ...chain.map((id) => submissionLines.find((l) => l.id === id)?.name || '')];
                          if (!names.some((n) => n.toLowerCase().includes(moveQuery))) return;
                        }
                        targetVisibleIds.add(t.id);
                        chain.forEach((id) => targetVisibleIds.add(id));
                      });
                      const moveTreeRoots = submissionLines.filter(
                        (l) => targetVisibleIds.has(l.id) && !effectiveParentId(l.id)
                      );
                      const isMoveNodeOpen = (id: string) => !moveExpanded.has(id);
                      const toggleMoveNode = (id: string) => {
                        setMoveExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id); else next.add(id);
                          return next;
                        });
                      };
                      const highlightName = (name: string): React.ReactNode => {
                        if (!moveQuery) return name;
                        const i = name.toLowerCase().indexOf(moveQuery);
                        if (i < 0) return name;
                        return (
                          <>
                            {name.slice(0, i)}
                            <mark style={{ backgroundColor: '#fff3c4', padding: 0 }}>{name.slice(i, i + moveQuery.length)}</mark>
                            {name.slice(i + moveQuery.length)}
                          </>
                        );
                      };
                      const renderMoveNode = (line: typeof submissionLines[0], level: number): React.ReactNode => {
                        if (!targetVisibleIds.has(line.id)) return null;
                        const kids = submissionLines.filter(
                          (l) => effectiveParentId(l.id) === line.id && targetVisibleIds.has(l.id)
                        );
                        const selectable = validTargetIds.has(line.id);
                        const open = isMoveNodeOpen(line.id);
                        const isChosen = moveTargetId === line.id;
                        return (
                          <React.Fragment key={line.id}>
                            <div
                              onClick={() => { if (selectable) setMoveTargetId(line.id); }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 8px',
                                paddingLeft: `${8 + level * 16}px`,
                                cursor: selectable ? 'pointer' : 'default',
                                borderLeft: isChosen ? '3px solid #0176D3' : '3px solid transparent',
                                borderBottom: '1px solid #f3f3f3',
                                backgroundColor: isChosen ? '#e8f1fb' : 'transparent',
                                fontSize: '13px',
                                lineHeight: '18px',
                              }}
                              onMouseEnter={(e) => { if (selectable && !isChosen) e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                              onMouseLeave={(e) => { if (!isChosen) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              {selectable ? (
                                <input
                                  type="radio"
                                  name="moveTarget"
                                  checked={isChosen}
                                  onChange={() => setMoveTargetId(line.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ margin: 0, cursor: 'pointer', flexShrink: 0 }}
                                />
                              ) : (
                                <span style={{ width: '13px', flexShrink: 0 }} />
                              )}
                              {kids.length > 0 ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleMoveNode(line.id); }}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', color: '#0176D3', flexShrink: 0 }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                                  </svg>
                                </button>
                              ) : (
                                <span style={{ width: '14px', flexShrink: 0 }} />
                              )}
                              <span
                                title={!selectable ? 'Not a valid destination' : undefined}
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: isChosen ? '#001e5b' : selectable ? '#0176D3' : '#939393',
                                  fontWeight: isChosen ? 600 : (level === 0 ? 600 : 400),
                                }}
                              >
                                {highlightName(line.name)}
                              </span>
                            </div>
                            {open && kids.map((k) => renderMoveNode(k, level + 1))}
                          </React.Fragment>
                        );
                      };

                      const closeModal = () => {
                        setIsMoveOpen(false);
                        setMoveTargetId(null);
                        setMoveSourceIds(null);
                        setMoveSearch('');
                        setMoveExpanded(new Set());
                      };

                      const blocked = ineligible.length > 0 || (eligible.length > 0 && intersectedTypes.length === 0);

                      const handleConfirm = () => {
                        if (!moveTargetId || blocked) return;
                        setMovedParentOverrides((prev) => {
                          const next = { ...prev };
                          eligible.forEach((l) => { next[l.id] = moveTargetId; });
                          return next;
                        });
                        setTreeSelectedIds(new Set());
                        closeModal();
                      };

                      return (
                        <div
                          onClick={closeModal}
                          style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            zIndex: 9999,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '640px',
                              maxWidth: '95vw',
                              maxHeight: '90vh',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                            }}
                          >
                            <div style={{
                              padding: '16px 24px',
                              borderBottom: '1px solid #e5e5e5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}>
                              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#001e5b' }}>
                                Move Submission Lines
                              </h2>
                              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} aria-label="Close">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5c5c5c">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                              </button>
                            </div>

                            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                              <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                  Selected ({selectedLines.length})
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#2e2e2e', lineHeight: '20px' }}>
                                  {selectedLines.map((l) => (
                                    <li key={l.id}>
                                      <span style={{ fontWeight: 600 }}>{l.name}</span>{' '}
                                      <span style={{ color: '#5c5c5c', fontSize: '12px' }}>({l.lineType})</span>
                                      {allowedTargetTypesFor(l.lineType).length === 0 && (
                                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#c23934', fontWeight: 600 }}>
                                          not movable
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {ineligible.length > 0 && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '8px',
                                  padding: '10px 12px',
                                  backgroundColor: '#fdecea',
                                  border: '1px solid #f5b7b1',
                                  borderLeft: '4px solid #c23934',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  color: '#7a1f1f',
                                  marginBottom: '12px',
                                  lineHeight: '17px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#c23934" style={{ flexShrink: 0, marginTop: '1px' }}>
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                  </svg>
                                  <div>
                                    Some selected lines cannot be moved. Only Buildings, Equipment / Contents, and Coverages are reparentable.
                                  </div>
                                </div>
                              )}

                              {eligible.length > 0 && intersectedTypes.length === 0 && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '8px',
                                  padding: '10px 12px',
                                  backgroundColor: '#fdecea',
                                  border: '1px solid #f5b7b1',
                                  borderLeft: '4px solid #c23934',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  color: '#7a1f1f',
                                  marginBottom: '12px',
                                  lineHeight: '17px',
                                }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#c23934" style={{ flexShrink: 0, marginTop: '1px' }}>
                                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                                  </svg>
                                  <div>
                                    No common destination type. Buildings move only under Locations; Equipment / Contents only under Buildings. Coverages can move under any of those, but cannot be combined with Buildings or Equipment in a single move.
                                  </div>
                                </div>
                              )}

                              {eligible.length > 0 && intersectedTypes.length > 0 && (
                                <>
                                  <div style={{
                                    fontSize: '12px',
                                    color: '#5c5c5c',
                                    backgroundColor: '#eef4ff',
                                    border: '1px solid #cfe0ff',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    marginBottom: '12px',
                                    lineHeight: '17px',
                                  }}>
                                    {eligible.length > 1 ? 'These lines' : 'This line'} can only be moved under{' '}
                                    <strong style={{ color: '#001e5b' }}>{intersectedTypes.join(', ')}</strong>{' '}
                                    node{intersectedTypes.length > 1 ? 's' : ''}. Valid destinations are highlighted below; other
                                    nodes are shown only to place them in context and can't be selected.
                                  </div>

                                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                    Choose new parent
                                  </div>
                                  {candidateTargets.length === 0 ? (
                                    <div style={{ fontSize: '13px', color: '#5c5c5c', padding: '12px', border: '1px solid #e5e5e5', borderRadius: '6px' }}>
                                      No valid targets available.
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', pointerEvents: 'none' }}>
                                          <Icon category="utility" name="search" size="xx-small" style={{ fill: '#939393' }} />
                                        </span>
                                        <input
                                          type="text"
                                          value={moveSearch}
                                          onChange={(e) => setMoveSearch(e.target.value)}
                                          placeholder="Search destinations"
                                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 26px 7px 28px', fontSize: '13px', border: '1px solid #c9c9c9', borderRadius: '4px', color: '#2e2e2e' }}
                                        />
                                        {moveSearch && (
                                          <button
                                            onClick={() => setMoveSearch('')}
                                            aria-label="Clear search"
                                            style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', padding: '2px', display: 'inline-flex', color: '#939393' }}
                                          >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                                          </button>
                                        )}
                                      </div>
                                      <div style={{ border: '1px solid #e5e5e5', borderRadius: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                                        {moveTreeRoots.length === 0 ? (
                                          <div style={{ padding: '16px', fontSize: '13px', color: '#5c5c5c' }}>
                                            No destinations match “{moveSearch}”.
                                          </div>
                                        ) : (
                                          moveTreeRoots.map((r) => renderMoveNode(r, 0))
                                        )}
                                      </div>
                                    </>
                                  )}
                                </>
                              )}
                            </div>

                            <div style={{
                              padding: '12px 24px',
                              backgroundColor: '#fafafa',
                              borderTop: '1px solid #e5e5e5',
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: '8px',
                            }}>
                              <button
                                onClick={closeModal}
                                style={{
                                  padding: '8px 16px',
                                  border: '1px solid #c9c9c9',
                                  borderRadius: '4px',
                                  backgroundColor: 'white',
                                  color: '#001e5b',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleConfirm}
                                disabled={blocked || !moveTargetId}
                                style={{
                                  padding: '8px 16px',
                                  border: 'none',
                                  borderRadius: '4px',
                                  backgroundColor: blocked || !moveTargetId ? '#a0c5e8' : '#0176D3',
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: blocked || !moveTargetId ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Move
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Create Submission Line Modal */}
                    {isCreateLineOpen && (() => {
                      const parentLine = createLineParentId
                        ? submissionLines.find((l) => l.id === createLineParentId)
                        : null;
                      const setField = (k: string, v: string) =>
                        setCreateLineForm((prev) => ({ ...prev, [k]: v }));
                      const canSave = createLineForm.name.trim().length > 0;
                      // Selectable parents when launched from "Add": any container-type line in this LOB.
                      const parentOptions = submissionLines
                        .filter((l) => ['LOB', 'Location', 'Building', 'Equipment / Contents'].includes(l.lineType))
                        .sort((a, b) => a.name.localeCompare(b.name));

                      const labelStyle: React.CSSProperties = {
                        fontSize: '12px', color: '#3e3e3c', fontWeight: 400, marginBottom: '4px', display: 'block',
                      };
                      const inputStyle: React.CSSProperties = {
                        width: '100%', fontSize: '13px', color: '#080707',
                        border: '1px solid #c9c9c9', borderRadius: '4px', padding: '7px 10px',
                        backgroundColor: 'white', boxSizing: 'border-box',
                      };
                      const readonlyStyle: React.CSSProperties = {
                        ...inputStyle, backgroundColor: '#f3f3f3', color: '#5c5c5c',
                      };
                      const reqMark = <abbr title="required" style={{ color: '#c23934', textDecoration: 'none', marginRight: '2px' }}>*</abbr>;

                      return (
                        <div
                          onClick={closeCreateLine}
                          style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '640px', maxWidth: '92vw', maxHeight: '90vh',
                              backgroundColor: 'white', borderRadius: '8px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                              display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            }}
                          >
                            {/* Header */}
                            <div style={{ position: 'relative', padding: '20px 48px', borderBottom: '1px solid #e5e5e5', textAlign: 'center' }}>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: '#080707', lineHeight: '24px' }}>
                                {createLineEditId ? 'Edit Submission Line' : 'New Submission Line'}
                              </div>
                              <button
                                onClick={closeCreateLine}
                                title="Close"
                                style={{
                                  position: 'absolute', top: '14px', right: '14px',
                                  width: '32px', height: '32px', border: 'none', background: 'none',
                                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  borderRadius: '50%',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <svg width="16" height="16" viewBox="0 0 52 52" fill="#706E6B">
                                  <path d="M31 25.4l13-13c.6-.6.6-1.5 0-2.1l-2.3-2.3c-.6-.6-1.5-.6-2.1 0l-13 13c-.4.4-1 .4-1.4 0l-13-13c-.6-.6-1.5-.6-2.1 0L7.9 10.3c-.6.6-.6 1.5 0 2.1l13 13c.4.4.4 1 0 1.4l-13 13c-.6.6-.6 1.5 0 2.1l2.3 2.3c.6.6 1.5.6 2.1 0l13-13c.4-.4 1-.4 1.4 0l13 13c.6.6 1.5.6 2.1 0l2.3-2.3c.6-.6.6-1.5 0-2.1l-13-13c-.5-.4-.5-1 0-1.4z"/>
                                </svg>
                              </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '20px 24px', overflowY: 'auto', backgroundColor: '#fafaf9' }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#080707', marginBottom: '16px' }}>
                                Line Information
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                <div>
                                  <label style={labelStyle}>{reqMark}Line Name</label>
                                  <input
                                    autoFocus
                                    type="text"
                                    value={createLineForm.name}
                                    onChange={(e) => setField('name', e.target.value)}
                                    placeholder="e.g. Location 4 - Dallas Depot"
                                    style={inputStyle}
                                  />
                                </div>
                                <div>
                                  <label style={labelStyle}>Parent Record</label>
                                  {createLineParentLocked ? (
                                    <input
                                      type="text"
                                      readOnly
                                      value={parentLine ? parentLine.name : 'None (top-level line)'}
                                      title={parentLine ? parentLine.name : undefined}
                                      style={readonlyStyle}
                                    />
                                  ) : parentLine ? (
                                    // Selected state: SLDS lookup "pill" — icon + record name + clear (✕).
                                    <div style={{
                                      display: 'flex', alignItems: 'center', gap: '8px',
                                      border: '1px solid #c9c9c9', borderRadius: '4px', padding: '5px 8px 5px 10px',
                                      backgroundColor: 'white', boxSizing: 'border-box',
                                    }}>
                                      <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                                        <Icon category="standard" name="record" size="x-small" />
                                      </span>
                                      <span style={{ flex: 1, minWidth: 0, fontSize: '13px', color: '#080707', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={parentLine.name}>
                                        {parentLine.name}
                                      </span>
                                      <button
                                        onClick={() => { setCreateLineParentId(null); setParentLookupQuery(''); setParentLookupOpen(false); }}
                                        title="Clear selection"
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 52 52" fill="#706E6B">
                                          <path d="M31 25.4l13-13c.6-.6.6-1.5 0-2.1l-2.3-2.3c-.6-.6-1.5-.6-2.1 0l-13 13c-.4.4-1 .4-1.4 0l-13-13c-.6-.6-1.5-.6-2.1 0L7.9 10.3c-.6.6-.6 1.5 0 2.1l13 13c.4.4.4 1 0 1.4l-13 13c-.6.6-.6 1.5 0 2.1l2.3 2.3c.6.6 1.5.6 2.1 0l13-13c.4-.4 1-.4 1.4 0l13 13c.6.6 1.5.6 2.1 0l2.3-2.3c.6-.6.6-1.5 0-2.1l-13-13c-.5-.4-.5-1 0-1.4z"/>
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    // Empty state: search input + results dropdown.
                                    <div style={{ position: 'relative' }}>
                                      <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', pointerEvents: 'none' }}>
                                          <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                            <path d="M49.3 44.7L37.9 33.3c2.3-3.1 3.6-6.9 3.6-11 0-10.3-8.4-18.7-18.7-18.7S4.1 12 4.1 22.3 12.5 41 22.8 41c4.1 0 7.9-1.3 11-3.6l11.4 11.4c.6.6 1.5.6 2.1 0l2-2c.5-.6.5-1.5 0-2.1zM10.1 22.3c0-7 5.7-12.7 12.7-12.7s12.7 5.7 12.7 12.7S29.8 35 22.8 35s-12.7-5.7-12.7-12.7z"/>
                                          </svg>
                                        </span>
                                        <input
                                          type="text"
                                          value={parentLookupQuery}
                                          onChange={(e) => { setParentLookupQuery(e.target.value); setParentLookupOpen(true); }}
                                          onFocus={() => setParentLookupOpen(true)}
                                          onBlur={() => setTimeout(() => setParentLookupOpen(false), 150)}
                                          placeholder="Search Submission Lines..."
                                          style={{ ...inputStyle, paddingLeft: '30px' }}
                                        />
                                      </div>
                                      {parentLookupOpen && (() => {
                                        const q = parentLookupQuery.trim().toLowerCase();
                                        const matches = parentOptions.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 8);
                                        return (
                                          <div style={{
                                            position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 20,
                                            backgroundColor: 'white', border: '1px solid #d8dde6', borderRadius: '4px',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.18)', maxHeight: '240px', overflowY: 'auto',
                                          }}>
                                            {matches.length === 0 ? (
                                              <div style={{ padding: '10px 12px', fontSize: '13px', color: '#5c5c5c' }}>No matches</div>
                                            ) : matches.map((p) => (
                                              <button
                                                key={p.id}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => { setCreateLineParentId(p.id); setParentLookupOpen(false); }}
                                                style={{
                                                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
                                                  border: 'none', background: 'none', cursor: 'pointer', padding: '8px 12px',
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                              >
                                                <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                                                  <Icon category="standard" name="record" size="x-small" />
                                                </span>
                                                <span style={{ flex: 1, minWidth: 0 }}>
                                                  <span style={{ display: 'block', fontSize: '13px', color: '#080707', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                                  <span style={{ display: 'block', fontSize: '11px', color: '#5c5c5c' }}>{p.lineType}</span>
                                                </span>
                                              </button>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <label style={labelStyle}>Line Type</label>
                                  <select
                                    value={createLineForm.lineType}
                                    onChange={(e) => setField('lineType', e.target.value)}
                                    style={inputStyle}
                                  >
                                    {['Location', 'Building', 'Equipment / Contents', 'Coverage'].map((t) => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label style={labelStyle}>Line of Business</label>
                                  <select
                                    value={createLineForm.lineOfBusiness}
                                    onChange={(e) => setField('lineOfBusiness', e.target.value)}
                                    style={inputStyle}
                                  >
                                    {['Property', 'General Liability', 'Business Auto'].map((t) => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label style={labelStyle}>Status</label>
                                  <select
                                    value={createLineForm.status}
                                    onChange={(e) => setField('status', e.target.value)}
                                    style={inputStyle}
                                  >
                                    {['Active', 'Draft', 'On Hold', 'Inactive'].map((t) => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label style={labelStyle}>Owner</label>
                                  <input
                                    type="text"
                                    value={createLineForm.owner}
                                    onChange={(e) => setField('owner', e.target.value)}
                                    placeholder="e.g. Martha (UW Team Lead)"
                                    style={inputStyle}
                                  />
                                </div>
                              </div>

                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#080707', marginBottom: '16px' }}>
                                Financial Information
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                  <label style={labelStyle}>Insured Value</label>
                                  <input type="number" value={createLineForm.insuredValue} onChange={(e) => setField('insuredValue', e.target.value)} placeholder="0" style={inputStyle} />
                                </div>
                                <div>
                                  <label style={labelStyle}>Coverage Limit</label>
                                  <input type="number" value={createLineForm.coverageLimit} onChange={(e) => setField('coverageLimit', e.target.value)} placeholder="0" style={inputStyle} />
                                </div>
                                <div>
                                  <label style={labelStyle}>Deductible</label>
                                  <input type="number" value={createLineForm.deductible} onChange={(e) => setField('deductible', e.target.value)} placeholder="0" style={inputStyle} />
                                </div>
                                <div>
                                  <label style={labelStyle}>Premium Allocation</label>
                                  <input type="number" value={createLineForm.premiumAllocation} onChange={(e) => setField('premiumAllocation', e.target.value)} placeholder="0" style={inputStyle} />
                                </div>
                              </div>
                            </div>

                            {/* Footer */}
                            <div style={{
                              padding: '12px 24px', backgroundColor: '#fafaf9', borderTop: '1px solid #e5e5e5',
                              display: 'flex', justifyContent: 'flex-end', gap: '4px',
                            }}>
                              <button
                                onClick={closeCreateLine}
                                style={{
                                  minWidth: '80px', height: '32px', padding: '0 16px',
                                  border: '1px solid #c9c9c9', borderRadius: '4px',
                                  backgroundColor: 'white', color: '#0176D3', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f4f6f9'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                              >
                                Cancel
                              </button>
                              {!createLineEditId && (
                                <button
                                  onClick={() => { openCreateLine(createLineParentId, createLineParentLocked); }}
                                  disabled={!canSave}
                                  style={{
                                    minWidth: '96px', height: '32px', padding: '0 16px',
                                    border: '1px solid #c9c9c9', borderRadius: '4px',
                                    backgroundColor: 'white', color: canSave ? '#0176D3' : '#a0c5e8',
                                    fontSize: '13px', fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed',
                                  }}
                                  onMouseEnter={(e) => { if (canSave) e.currentTarget.style.backgroundColor = '#f4f6f9'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                >
                                  Save &amp; New
                                </button>
                              )}
                              <button
                                onClick={closeCreateLine}
                                disabled={!canSave}
                                style={{
                                  minWidth: '80px', height: '32px', padding: '0 16px',
                                  border: '1px solid ' + (canSave ? '#0176D3' : '#a0c5e8'), borderRadius: '4px',
                                  backgroundColor: canSave ? '#0176D3' : '#a0c5e8', color: 'white',
                                  fontSize: '13px', fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed',
                                }}
                                onMouseEnter={(e) => { if (canSave) e.currentTarget.style.backgroundColor = '#014486'; }}
                                onMouseLeave={(e) => { if (canSave) e.currentTarget.style.backgroundColor = '#0176D3'; }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Delete confirmation — a delete cascades to descendants, so the modal
                        names the target(s) and how many child records will go with them. */}
                    {deleteConfirmIds && deleteConfirmIds.length > 0 && (() => {
                      const parentOf = (id: string): string | null => {
                        const ov = movedParentOverrides[id];
                        if (ov !== undefined) return ov || null;
                        const l = mockSubmissionLines.find((x) => x.id === id);
                        return l?.parentLineId || null;
                      };
                      const selectedIds = deleteConfirmIds;
                      const single = selectedIds.length === 1;
                      const target = single
                        ? (getMergedSubmissionLine(selectedIds[0]) || mockSubmissionLines.find((x) => x.id === selectedIds[0]))
                        : null;
                      // Collect all descendants (breadth-first) so we can warn about the cascade.
                      // Seed the frontier with every selected line and skip lines already in the selection.
                      const descendants: string[] = [];
                      const selectedSet = new Set(selectedIds);
                      let frontier = [...selectedIds];
                      const guard = new Set<string>(selectedIds);
                      while (frontier.length) {
                        const next: string[] = [];
                        mockSubmissionLines.forEach((l) => {
                          if (deletedLineIds.has(l.id) || guard.has(l.id)) return;
                          if (frontier.includes(parentOf(l.id) || '')) {
                            descendants.push(l.id);
                            guard.add(l.id);
                            next.push(l.id);
                          }
                        });
                        frontier = next;
                      }
                      const childCount = descendants.length;
                      const confirmDelete = () => {
                        setDeletedLineIds((prev) => {
                          const nextSet = new Set(prev);
                          selectedIds.forEach((id) => nextSet.add(id));
                          descendants.forEach((d) => nextSet.add(d));
                          return nextSet;
                        });
                        setTreeSelectedIds((prev) => {
                          const nextSet = new Set(prev);
                          selectedIds.forEach((id) => nextSet.delete(id));
                          descendants.forEach((d) => nextSet.delete(d));
                          return nextSet;
                        });
                        if (
                          (selectedSubmissionLineId && selectedSet.has(selectedSubmissionLineId)) ||
                          descendants.includes(selectedSubmissionLineId || '')
                        ) {
                          setSelectedSubmissionLineId(null);
                        }
                        setDeleteConfirmIds(null);
                      };
                      const heading = single
                        ? `Delete ${target ? target.name : 'this submission line'}?`
                        : `Delete ${selectedIds.length} submission lines?`;
                      return (
                        <Modal
                          isOpen
                          prompt="warning"
                          size="small"
                          onRequestClose={() => setDeleteConfirmIds(null)}
                          heading={heading}
                          footer={[
                            <Button key="cancel" label="Cancel" onClick={() => setDeleteConfirmIds(null)} />,
                            <Button key="delete" label="Delete" onClick={confirmDelete} />,
                          ]}
                        >
                          <div style={{ padding: '12px 20px', fontSize: '14px', color: '#3e3e3c', lineHeight: '20px' }}>
                            {single ? (
                              childCount > 0 ? (
                                <>This will also delete its <strong>{childCount} child record{childCount === 1 ? '' : 's'}</strong>. This action can&apos;t be undone.</>
                              ) : (
                                <>This action can&apos;t be undone.</>
                              )
                            ) : (
                              childCount > 0 ? (
                                <>This will delete the <strong>{selectedIds.length} selected submission lines</strong> and their <strong>{childCount} child record{childCount === 1 ? '' : 's'}</strong>. This action can&apos;t be undone.</>
                              ) : (
                                <>This will delete the <strong>{selectedIds.length} selected submission lines</strong>. This action can&apos;t be undone.</>
                              )
                            )}
                          </div>
                        </Modal>
                      );
                    })()}

                    {/* Cross-LOB Discrepancies Modal */}
                    {isCrossLobOpen && (() => {
                      const allCrossLobIds = Object.keys(crossLobDiscrepancies)
                        .map((id) => submissionLines.find((l) => l.id === id))
                        .filter((l): l is typeof submissionLines[0] => !!l)
                        .map((l) => l.id);
                      const totalCl = allCrossLobIds.length;
                      const safeClIdx = totalCl === 0 ? 0 : Math.min(crossLobLineIdx, totalCl - 1);
                      const activeClId = allCrossLobIds[safeClIdx] || null;
                      const activeClLine = activeClId ? submissionLines.find((l) => l.id === activeClId) || null : null;
                      const activeClRows: CrossLobRow[] = activeClId ? crossLobDiscrepancies[activeClId] || [] : [];
                      const resolvedClCount = crossLobResolvedLines.size;
                      const remainingClIds = allCrossLobIds.filter((id) => !crossLobResolvedLines.has(id));
                      const remainingClTotal = remainingClIds.length;
                      const remainingClPosition = activeClId && !crossLobResolvedLines.has(activeClId)
                        ? remainingClIds.indexOf(activeClId) + 1
                        : 0;

                      const closeClModal = () => setIsCrossLobOpen(false);
                      const goClPrev = () => {
                        if (safeClIdx > 0) setCrossLobLineIdx(safeClIdx - 1);
                      };
                      const goClSkip = () => {
                        if (safeClIdx < totalCl - 1) setCrossLobLineIdx(safeClIdx + 1);
                        else closeClModal();
                      };
                      const goClSaveNext = () => {
                        if (!activeClId) return;
                        setCrossLobResolvedLines((prev) => {
                          const next = new Set(prev);
                          next.add(activeClId);
                          return next;
                        });
                        const remaining = allCrossLobIds.filter((id, i) => i !== safeClIdx && !crossLobResolvedLines.has(id));
                        if (remaining.length === 0) {
                          closeClModal();
                          return;
                        }
                        if (safeClIdx >= totalCl - 1) {
                          const nextIdx = allCrossLobIds.findIndex((id, i) => i !== safeClIdx && !crossLobResolvedLines.has(id));
                          if (nextIdx >= 0) setCrossLobLineIdx(nextIdx);
                          else closeClModal();
                        } else {
                          setCrossLobLineIdx(safeClIdx + 1);
                        }
                      };

                      return (
                        <div
                          style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onClick={closeClModal}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '1200px',
                              maxWidth: '95vw',
                              height: '85vh',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                            }}
                          >
                            <div style={{
                              padding: '16px 24px',
                              borderBottom: '1px solid #e5e5e5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Icon
                                  category="utility"
                                  name="merge"
                                  size="small"
                                  className="slds-icon-text-warning"
                                />
                                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#001e5b' }}>
                                  Cross-LOB Discrepancies
                                </h2>
                              </div>
                              <button
                                onClick={closeClModal}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                aria-label="Close"
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5c5c5c">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                              </button>
                            </div>

                            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                              {/* Left rail — affected lines */}
                              <div style={{
                                width: '300px',
                                borderRight: '1px solid #e5e5e5',
                                backgroundColor: '#fafafa',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                              }}>
                                <div style={{
                                  padding: '12px 16px',
                                  borderBottom: '1px solid #e5e5e5',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#5c5c5c',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                }}>
                                  Affected Lines ({totalCl - resolvedClCount})
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                  {totalCl - resolvedClCount === 0 ? (
                                    <div style={{ padding: '16px', fontSize: '13px', color: '#5c5c5c' }}>
                                      No cross-LOB discrepancies remain.
                                    </div>
                                  ) : (
                                    allCrossLobIds
                                      .filter((id) => !crossLobResolvedLines.has(id))
                                      .map((id) => {
                                        const line = submissionLines.find((l) => l.id === id);
                                        if (!line) return null;
                                        const isActive = id === activeClId;
                                        const parentChain: string[] = [];
                                        let pid = effectiveParentId(line.id);
                                        while (pid) {
                                          const p = submissionLines.find((l) => l.id === pid);
                                          if (!p) break;
                                          if (p.lineType !== 'LOB') parentChain.unshift(p.name);
                                          pid = effectiveParentId(p.id);
                                        }
                                        const parentPath = parentChain.length ? `${parentChain.join(' / ')} /` : null;
                                        return (
                                          <div
                                            key={id}
                                            onClick={() => {
                                              const idx = allCrossLobIds.indexOf(id);
                                              if (idx >= 0) setCrossLobLineIdx(idx);
                                            }}
                                            style={{
                                              padding: '10px 16px',
                                              borderLeft: isActive ? '3px solid #0176D3' : '3px solid transparent',
                                              backgroundColor: isActive ? '#e8f1fb' : 'transparent',
                                              cursor: 'pointer',
                                              borderBottom: '1px solid #ececec',
                                            }}
                                            onMouseEnter={(e) => {
                                              if (!isActive) e.currentTarget.style.backgroundColor = '#f3f7fb';
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                                            }}
                                          >
                                            {parentPath && (
                                              <div style={{ fontSize: '11px', color: '#5c5c5c', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {parentPath}
                                              </div>
                                            )}
                                            <div style={{
                                              fontSize: '13px',
                                              fontWeight: 600,
                                              color: isActive ? '#001e5b' : '#0176D3',
                                              lineHeight: '17px',
                                            }}>
                                              {line.name}
                                            </div>
                                          </div>
                                        );
                                      })
                                  )}
                                </div>
                              </div>

                              {/* Right pane — table */}
                              <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                                {!activeClLine ? (
                                  <div style={{ fontSize: '13px', color: '#5c5c5c' }}>Select an affected line on the left.</div>
                                ) : (
                                  <>
                                    <div style={{ marginBottom: '12px' }}>
                                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b' }}>{activeClLine.name}</div>
                                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginTop: '4px' }}>
                                        Attribute values changed for the same physical entity in another line of business. Choose which updates to apply here.
                                      </div>
                                    </div>
                                    <div style={{
                                      border: '1px solid #c9c9c9',
                                      borderRadius: '8px',
                                      overflow: 'hidden',
                                      backgroundColor: 'white',
                                    }}>
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1.4fr 1.2fr 1fr 1.2fr 1fr 1fr 110px',
                                        backgroundColor: '#fafafa',
                                        borderBottom: '1px solid #c9c9c9',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: '#5c5c5c',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.4px',
                                      }}>
                                        <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5' }}>Canonical Attribute</div>
                                        <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5' }}>Current Value</div>
                                        <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5' }}>Current Source</div>
                                        <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5' }}>New Value</div>
                                        <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5' }}>New Value LOB</div>
                                        <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5' }}>New Source</div>
                                        <div style={{ padding: '10px 12px', textAlign: 'center' }}>Use New Value</div>
                                      </div>
                                      {activeClRows.map((row, i) => {
                                        const checkboxKey = `${activeClId}::${row.attribute}`;
                                        const checked = !!crossLobUseNewValue[checkboxKey];
                                        const isLast = i === activeClRows.length - 1;
                                        return (
                                          <div
                                            key={row.attribute}
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: '1.4fr 1.2fr 1fr 1.2fr 1fr 1fr 110px',
                                              borderBottom: isLast ? 'none' : '1px solid #e5e5e5',
                                              backgroundColor: i % 2 === 0 ? '#fbfbfb' : 'white',
                                              fontSize: '13px',
                                              alignItems: 'center',
                                            }}
                                          >
                                            <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5', color: '#001e5b', fontWeight: 600 }}>{row.attribute}</div>
                                            <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5', color: '#2e2e2e' }}>{row.currentValue}</div>
                                            <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5', color: '#0176D3', fontWeight: 600 }}>{row.currentSource}</div>
                                            <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5', color: '#2e2e2e' }}>{row.newValue}</div>
                                            <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5', color: '#2e2e2e' }}>{row.newValueLob}</div>
                                            <div style={{ padding: '10px 12px', borderRight: '1px solid #e5e5e5', color: '#0176D3', fontWeight: 600 }}>{row.newSource}</div>
                                            <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                  const next = e.target.checked;
                                                  setCrossLobUseNewValue((prev) => {
                                                    const n = { ...prev };
                                                    if (next) n[checkboxKey] = true;
                                                    else delete n[checkboxKey];
                                                    return n;
                                                  });
                                                }}
                                                style={{ accentColor: '#0176D3', cursor: 'pointer', margin: 0, width: '16px', height: '16px' }}
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Footer */}
                            <div style={{
                              padding: '12px 24px',
                              borderTop: '1px solid #e5e5e5',
                              backgroundColor: '#fafafa',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c' }}>
                                {remainingClTotal === 0
                                  ? 'All cross-LOB discrepancies resolved.'
                                  : `Line ${remainingClPosition} of ${remainingClTotal}`}
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={goClPrev}
                                  disabled={safeClIdx === 0 || totalCl === 0}
                                  style={{
                                    padding: '8px 16px',
                                    border: '1px solid #c9c9c9',
                                    borderRadius: '4px',
                                    backgroundColor: 'white',
                                    color: '#001e5b',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: safeClIdx === 0 || totalCl === 0 ? 'not-allowed' : 'pointer',
                                    opacity: safeClIdx === 0 || totalCl === 0 ? 0.5 : 1,
                                  }}
                                >
                                  Previous
                                </button>
                                <button
                                  onClick={goClSkip}
                                  disabled={totalCl === 0}
                                  style={{
                                    padding: '8px 16px',
                                    border: '1px solid #c9c9c9',
                                    borderRadius: '4px',
                                    backgroundColor: 'white',
                                    color: '#001e5b',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: totalCl === 0 ? 'not-allowed' : 'pointer',
                                    opacity: totalCl === 0 ? 0.5 : 1,
                                  }}
                                >
                                  Skip
                                </button>
                                <button
                                  onClick={goClSaveNext}
                                  disabled={totalCl === 0 || !activeClId}
                                  style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    backgroundColor: totalCl === 0 || !activeClId ? '#a0c5e8' : '#0176D3',
                                    color: 'white',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: totalCl === 0 || !activeClId ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Save & Next
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Unsaved-changes guard — fires when switching line/tab with pending edits.
                        A raw fixed-div dialog (not SLDS Modal) so it stacks above the reconcile
                        modal's z-index 10000 overlay when triggered from within it. */}
                    {pendingNavAction && (
                      <div
                        onClick={() => setPendingNavAction(null)}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020 }}
                      >
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ backgroundColor: 'white', borderRadius: '8px', width: '480px', maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.24)', overflow: 'hidden' }}
                        >
                          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#B85C00" style={{ flexShrink: 0 }}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                            <span style={{ fontSize: '16px', fontWeight: 600, color: '#001e5b' }}>Discard unsaved changes?</span>
                          </div>
                          <div style={{ padding: '20px 24px', fontSize: '14px', color: '#3e3e3c', lineHeight: '20px' }}>
                            You have edits that haven&apos;t been saved. If you leave now, those changes will be lost.
                          </div>
                          <div style={{ padding: '12px 24px', backgroundColor: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              onClick={() => setPendingNavAction(null)}
                              style={{ padding: '0 16px', height: '32px', borderRadius: '4px', border: '1px solid #c9c9c9', backgroundColor: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Keep editing
                            </button>
                            <button
                              onClick={() => { const act = pendingNavAction; cancelDirty(); setPendingNavAction(null); act && act(); }}
                              style={{ padding: '0 16px', height: '32px', borderRadius: '4px', border: 'none', backgroundColor: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Discard changes
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
      })()}
        {statusPopover && (
          <>
            <div
              onClick={() => setStatusPopover(null)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10010 }}
            />
            <div style={{
              position: 'fixed',
              top: statusPopover.top,
              left: statusPopover.left,
              zIndex: 10011,
              width: '260px',
              maxHeight: '320px',
              overflowY: 'auto',
              backgroundColor: 'white',
              border: '1px solid #c9c9c9',
              borderRadius: '6px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              padding: '12px 14px',
              fontSize: '12px',
              color: '#2e2e2e',
            }}>
              {statusPopover.selected.length === 0 && statusPopover.associated.length === 0 ? (
                <div style={{ color: '#5c5c5c' }}>Not associated with any canonical term.</div>
              ) : (
                <>
                  {statusPopover.selected.length > 0 && (
                    <div style={{ marginBottom: statusPopover.associated.length > 0 ? '12px' : 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#2E844A', marginBottom: '6px' }}>Selected in</div>
                      {statusPopover.selected.map((t) => (
                        <div key={t} style={{ padding: '3px 0', color: '#2e2e2e' }}>{t}</div>
                      ))}
                    </div>
                  )}
                  {statusPopover.associated.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0176D3', marginBottom: '6px' }}>Associated with</div>
                      {statusPopover.associated.map((t) => (
                        <div key={t} style={{ padding: '3px 0', color: '#2e2e2e' }}>{t}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
        {showSaveToast && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#2E844A',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 10000,
            fontSize: '14px',
            fontWeight: 500
          }}>
            Changes saved
          </div>
        )}
    </>
  );
}
