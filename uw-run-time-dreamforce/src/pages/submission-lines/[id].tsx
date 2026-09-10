import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  Button,
  ButtonGroup,
  Combobox,
  Icon,
  IconSettings,
  Modal
} from '@salesforce/design-system-react';
import GlobalHeader from '@/components/Navigation/GlobalHeader';
import { mockSubmissions } from '@/data/mockSubmissions';
import { mockSubmissionLines, applyLineOverrides, getMergedSubmissionLine } from '@/data/mockSubmissionLines';
import { InsuranceSubmissionLine } from '@/types/InsuranceSubmission';
import { locationCoordinates } from '@/data/mockLocationCoordinates';

const LocationsMap = dynamic(() => import('@/components/Map/LocationsMap'), { ssr: false });
import { mockEmailThreads, mockSlackMessages } from '@/data/mockCommunicationData';
import { mockDocuments } from '@/data/mockDocumentsData';
import PendingTask from '@/components/Tasks/PendingTask';
import NewTaskModal, { NewTaskInput } from '@/components/Tasks/NewTaskModal';
import ActivityLog from '@/components/Activity/ActivityLog';
import ActivityItem, { ActivityItemProps } from '@/components/Activity/ActivityItem';
// DemoFlowController removed - submission lines use their own step counter
import { useDemoFlow } from '@/contexts/DemoFlowContext';
import { AgentActivityPanel } from '@/components/AgentActivityPanel';
import EmailComposerModal from '@/components/Email/EmailComposerModal';
import ClassifyDocumentModal from '@/components/Documents/ClassifyDocumentModal';
import SubmissionLinesContainer from '@/components/SubmissionLines/SubmissionLinesContainer';
import ProductMappingContainer from '@/components/ProductMapping/ProductMappingContainer';
import { stepConfigurations } from '@/data/demoStepData';

// Base path prefix for static assets under public/ (empty locally, set for GitHub Pages).
const ASSET_PREFIX = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || '';

// Static, extraction-independent file overviews. Generated as soon as a document
// arrives and never change based on downstream extraction/reconciliation.
const STATIC_DOCUMENT_SUMMARIES: Record<string, string> = {
  'doc-1': 'This file contains two ACORD forms — ACORD 125 (Commercial Insurance Application) and ACORD 140 (Property Section) — covering the applicant and property information for the submission.',
  'doc-3': 'This file contains one ACORD form — ACORD 126 (Commercial General Liability Section) — covering the general liability portion of the submission.',
};
const DEFAULT_DOCUMENT_SUMMARY = 'This file contains the submitted document along with a high-level overview of its contents.';

// Dummy submission lookup options for the "Move To Submission" modal.
const MOVE_SUBMISSION_OPTIONS: { id: string; name: string; account: string; stage: string }[] = [
  { id: 'sub-1', name: 'Summit Manufacturing New Business', account: 'Summit Manufacturing Co.', stage: 'Data Reconciliation' },
  { id: 'sub-2', name: 'Riverside Logistics Renewal', account: 'Riverside Logistics LLC', stage: 'Clearance' },
  { id: 'sub-3', name: 'Cedar Grove Healthcare New Business', account: 'Cedar Grove Healthcare', stage: 'Qualifying Checks' },
  { id: 'sub-4', name: 'Atlas Retail Group New Business', account: 'Atlas Retail Group', stage: 'Extraction' },
  { id: 'sub-5', name: 'Blue Harbor Marine Renewal', account: 'Blue Harbor Marine Inc.', stage: 'Appetite Review' },
];

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
// 2 = enrichment retrieved (candidates visible but unmapped), 3 = enriched & mapped
// (canonical attributes appear + discrepancies to resolve), 4 = pricing & quoting (all resolved).
const TOTAL_LINE_STEPS = 4;
const LINE_STEP_LABELS: Record<number, string> = {
  1: 'Enrichment Pending',
  2: 'Enrichment Retrieved',
  3: 'Enriched & Mapped',
  4: 'Pricing & Quoting',
};

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

export default function SubmissionLineDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { currentStep } = useDemoFlow();
  const [mounted, setMounted] = useState(false);
  const [selectedTab, setSelectedTab] = useState('submission-lines');

  useEffect(() => {
    setMounted(true);
    // Clear any stale localStorage submission-line edits from earlier (pre-session-only) sessions
    // so a fresh reload always starts from the mock data.
    try {
      const stale: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('submissionLine_')) stale.push(k);
      }
      stale.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }, []);
  const [selectedCommTab, setSelectedCommTab] = useState<'email' | 'slack'>('email');
  const [selectedEmailId, setSelectedEmailId] = useState('email-1');
  const [expandedEmailIds, setExpandedEmailIds] = useState<Set<string>>(new Set());
  const [readEmailIds, setReadEmailIds] = useState<Set<string>>(new Set());
  const [dismissedAttentionIds, setDismissedAttentionIds] = useState<Set<string>>(new Set());
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [moveToSubmission, setMoveToSubmission] = useState<{ messageId: string; subject: string } | null>(null);
  const [moveSubmissionQuery, setMoveSubmissionQuery] = useState('');
  const [moveSubmissionId, setMoveSubmissionId] = useState<string | null>(null);
  const [selectedSlackThreadId, setSelectedSlackThreadId] = useState('slack-1');
  const [selectedDocumentId, setSelectedDocumentId] = useState('doc-1');
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
  const [markerPositions, setMarkerPositions] = useState<Array<{ fraction: number; top: number; attrKey: string | null }>>([]);
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
  const [lineStep, setLineStep] = useState(1);
  // Enrichment tasks the user has clicked "Run" on at line step 1 — flips them to an in-progress
  // manual state (mirrors the Data Completion Check task in Submission step 4).
  const [runEnrichmentTaskIds, setRunEnrichmentTaskIds] = useState<Set<string>>(new Set());
  // Move modal state
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
    'a01SB00001p8B6rYAE::Roof Covering': 'Roof Covering',
    'a01SB00001p8B6rYAE::Roof Age': 'Roof Age',
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
  }));
  // Merged duplicate groups (session-scoped). Keyed by sorted-ids resolution key.
  // Each entry holds the source ids in the order the user resolved them.
  const [mergedGroups, setMergedGroups] = useState<Record<string, string[]>>({});
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [showAgentActivity, setShowAgentActivity] = useState(false);
  const [selectedAgentTask, setSelectedAgentTask] = useState<any>(null);
  const [emailComposerTaskId, setEmailComposerTaskId] = useState<string | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [classifyDocumentId, setClassifyDocumentId] = useState<string | null>(null);
  const [userCreatedTasks, setUserCreatedTasks] = useState<NewTaskInput[]>([]);
  const [isPendingTasksExpanded, setIsPendingTasksExpanded] = useState(true);
  const [leftPanelTab, setLeftPanelTab] = useState<'tasks' | 'activity'>('tasks');
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [depHighlightTaskId, setDepHighlightTaskId] = useState<string | null>(null);
  const depCircleRefs = useRef<Map<string, HTMLElement>>(new Map());
  const depCardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const depContainerRef = useRef<HTMLDivElement | null>(null);
  const [depConnectorTick, setDepConnectorTick] = useState(0);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const columnButtonRef = useRef<HTMLButtonElement>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('submissionLinesColumns');
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    }
    return new Set(['name', 'type', 'lob', 'stage', 'status', 'insuredValue', 'limit', 'deductible']);
  });

  // Load submission line data, layering any persisted edits from localStorage on top of the mock.
  const getSubmissionLineData = (lineId: string | string[] | undefined) => {
    if (!lineId || Array.isArray(lineId)) return null;
    return getMergedSubmissionLine(lineId);
  };

  // Drive the detail-panel slide animation off the selected line. Opening/switching mounts the
  // panel immediately and flips `panelOpen` true on the next frame so the transform transitions in.
  // Clearing the selection keeps the panel mounted (via `panelLineId`) while it slides out, then
  // unmounts once the transition finishes.
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

  // Editable submission line state
  const [editableSubmissionLine, setEditableSubmissionLine] = useState(() => getSubmissionLineData(id));
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  // Explicit-save dirty model for the Details fields: edits stay live on `editableSubmissionLine`
  // but only persist to sessionStorage on Save. `detailDirty` drives the SLDS dirty-cell fill +
  // sticky footer; `detailReverts` holds per-field restore closures (captured on first edit).
  const [detailDirty, setDetailDirty] = useState<Set<string>>(new Set());
  const detailReverts = useRef<Record<string, () => void>>({});
  const detailIsDirty = detailDirty.size > 0;
  const DETAIL_DIRTY_STYLE: React.CSSProperties = { backgroundColor: '#fdf6e3', boxShadow: 'inset 3px 0 0 #B85C00', borderRadius: '2px' };
  const markDetailDirty = (field: string, before: any) => {
    if (!detailReverts.current[field]) detailReverts.current[field] = () => setEditableSubmissionLine((prev: any) => (prev ? { ...prev, [field]: before } : prev));
    setDetailDirty((prev) => { if (prev.has(field)) return prev; const next = new Set(prev); next.add(field); return next; });
  };
  const saveDetailDirty = () => {
    if (editableSubmissionLine && id) {
      try {
        sessionStorage.setItem(`submissionLine_${id}`, JSON.stringify(editableSubmissionLine));
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 3000);
      } catch (e) { console.error('Error saving changes:', e); }
    }
    detailReverts.current = {};
    setDetailDirty(new Set());
  };
  const cancelDetailDirty = () => {
    Object.values(detailReverts.current).forEach((fn) => { try { fn(); } catch { /* best-effort */ } });
    detailReverts.current = {};
    setDetailDirty(new Set());
    setEditingField(null);
  };
  const [detailPendingNav, setDetailPendingNav] = useState<(() => void) | null>(null);
  const guardDetailNav = (action: () => void) => { if (detailIsDirty) setDetailPendingNav(() => action); else action(); };
  // The Details-tab save/cancel footer is pinned to the viewport bottom (position:fixed) and
  // width-matched to the right content column via measured metrics, so it stays visible while
  // scrolling and rides up with the column's bottom edge once that edge scrolls into view.
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const [detailFooterMetrics, setDetailFooterMetrics] = useState<{ left: number; width: number; bottom: number } | null>(null);
  useEffect(() => {
    if (!detailIsDirty) { setDetailFooterMetrics(null); return; }
    const measure = () => {
      const el = detailSectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDetailFooterMetrics({ left: r.left, width: r.width, bottom: Math.max(0, window.innerHeight - r.bottom) });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [detailIsDirty]);

  const line = editableSubmissionLine;
  const submission = line ? mockSubmissions.find((s) => s.id === line.insuranceSubmissionId) || null : null;

  // The Verisk enrichment-complete notification is surfaced (consumed by GlobalHeader across the
  // app) only while the enrichment lifecycle is at step 3 — the moment enrichment has been mapped
  // to the canonical model. Stepping away clears it, so it is available only in step 3 regardless
  // of moving back and forth.
  useEffect(() => {
    if (!mounted || !line || line.lineOfBusiness !== 'Property') return;
    try {
      if (lineStep === 3) {
        const payload = {
          id: 'notif-verisk-enrichment',
          title: 'Data enrichment complete',
          body: `Verisk 360 enrichment finished for ${line.name}. 18 enriched attributes are ready to review.`,
          time: 'Just now',
          unread: true,
          href: `/submission-lines/${line.id}`,
        };
        localStorage.setItem('uw_runtime_notification', JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('uw-runtime-notification', { detail: payload }));
      } else {
        localStorage.removeItem('uw_runtime_notification');
        window.dispatchEvent(new CustomEvent('uw-runtime-notification', { detail: { id: 'notif-verisk-enrichment', remove: true } }));
      }
    } catch {
      // ignore
    }
  }, [mounted, lineStep, line]);

  // Re-measure dep connectors on resize / DOM mutation
  useEffect(() => {
    const onResize = () => setDepConnectorTick((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Compute scroll-rail marker positions for the View Sources doc viewer.
  // Re-runs whenever the modal opens, the active source tab changes, or the active
  // row changes (since the active row drives the highlight in the doc).
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
  }, [lineSourceViewer?.activeIdx, lineSourceViewer?.lineId, viewSourcesActiveRow, viewSourcesExpandedAttr, viewSourcesUnmappedAttr, viewSourcesUnmappedGroup, viewSourcesTab]);
  useLayoutEffect(() => {
    if (!depContainerRef.current) return;
    const ro = new ResizeObserver(() => setDepConnectorTick((n) => n + 1));
    ro.observe(depContainerRef.current);
    depCardRefs.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  });

  // Update dropdown position when opened
  useEffect(() => {
    if (showColumnSelector && columnButtonRef.current) {
      const rect = columnButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      });
    }
  }, [showColumnSelector]);

  // Reload submission line data when ID changes or when mounted (so localStorage edits land after hydration).
  useEffect(() => {
    setEditableSubmissionLine(getSubmissionLineData(id));
  }, [id, mounted]);

  // Session-scoped persistence for resolution state now lives inside SubmissionLinesContainer
  // (the shared component that renders the Submission Lines tab). Keeping the effects here too
  // would double-write the shared `lobDataResolutionSession` key and clobber the container's
  // live state, so they were removed when the tab was extracted.

  // Redirect to submission page if step < 9
  useEffect(() => {
    if (mounted && currentStep < 9 && line) {
      router.push(`/submissions/${line.insuranceSubmissionId}`);
    }
  }, [mounted, currentStep, line, router]);

  useEffect(() => {
    if (sourcePickerAnchor) {
      const editKey = `${sourcePickerAnchor.lineId}::${sourcePickerAnchor.attrKey}`;
      setSourcePickerActiveTab(submissionLineSourceIdx[editKey] ?? 0);
    }
  }, [sourcePickerAnchor, submissionLineSourceIdx]);

  // Re-open the View Sources / Reconcile modal when arriving via an "Open in new tab" link
  // (?vsLine=…&vsMode=…&vsIdx=…&vsTab=…&vsSources=…). Runs once after mount.
  const vsAutoOpenRef = useRef(false);
  // Sticky Discrepancies-tab membership: terms that have surfaced as discrepancies for the open
  // line stay in the tab until the user clicks "Mark as Resolved" — associating an attribute
  // resolves the live discrepancy but must not drop the box mid-review. Re-snapshots per line.
  const discStickyRef = useRef<{ lineId: string | null; terms: Set<string> }>({ lineId: null, terms: new Set() });
  const [vsStandalone, setVsStandalone] = useState(false);
  // Full-screen LOB Data mode — opened in a new tab via ?lobFullScreen=1. Renders only
  // the LOB Data tab content (no global header / page header / side column / step controller),
  // as it would embed inside a Salesforce builder canvas.
  const [lobFullScreen, setLobFullScreen] = useState(false);
  useEffect(() => {
    if (!mounted || !router.isReady) return;
    if (router.query.lobFullScreen === '1') {
      setLobFullScreen(true);
      setSelectedTab('submission-lines');
    }
  }, [mounted, router.isReady, router.query.lobFullScreen]);
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

  const handleFieldEdit = (fieldName: string, value: any) => {
    if (line) {
      // Mark dirty on the first change of this field, capturing its pristine value for revert.
      if ((line as any)[fieldName] !== value) markDetailDirty(fieldName, (line as any)[fieldName]);
      setEditableSubmissionLine({
        ...line,
        [fieldName]: value
      });
    }
  };

  const handleFieldClick = (fieldName: string) => {
    setEditingField(fieldName);
  };

  // Blur just closes the inline editor now — persistence is deferred to the Save footer button.
  const handleFieldBlur = () => {
    setEditingField(null);
  };

  // Resolve the display name of a line's parent, honoring any local reparenting overrides.
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
  const EditableField = ({ fieldName, label, value, type = 'text', isLink = false }: {
    fieldName: string;
    label: string;
    value: any;
    type?: 'text' | 'number' | 'date' | 'checkbox';
    isLink?: boolean;
  }) => {
    // Submission lines always show all field values
    const shouldShowValue = true;
    const displayValue = shouldShowValue ? value : '-';

    const isDirtyField = detailDirty.has(fieldName);
    return (
      <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>{label}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(isDirtyField ? DETAIL_DIRTY_STYLE : {}) }}>
          {editingField === fieldName ? (
            type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => handleFieldEdit(fieldName, e.target.checked)}
                onBlur={handleFieldBlur}
                autoFocus
                style={{ margin: 0 }}
              />
            ) : (
              <input
                type={type}
                value={value || ''}
                onChange={(e) => handleFieldEdit(fieldName, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                onBlur={handleFieldBlur}
                autoFocus
                style={{
                  fontSize: '13px',
                  color: '#001e5b',
                  border: '1px solid #0176D3',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  flex: 1,
                  marginRight: '8px'
                }}
              />
            )
          ) : (
            <div style={{ fontSize: '13px', color: isLink && shouldShowValue ? '#0176D3' : '#001e5b', flex: 1 }}>
              {type === 'checkbox' ? (
                <input type="checkbox" checked={value || false} disabled style={{ margin: 0 }} />
              ) : !shouldShowValue ? (
                '-'
              ) : (type === 'number' && (fieldName.includes('Premium') || fieldName.includes('Value'))) ? (
                `$${value?.toLocaleString() || '0'}`
              ) : (
                value || ''
              )}
            </div>
          )}
          <button
            onClick={() => handleFieldClick(fieldName)}
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

  if (!mounted || !line) {
    return (
      <>
        <GlobalHeader />
        <div className="record-page-container">
          <div className="slds-text-align_center slds-m-vertical_xx-large">
            {!mounted ? (
              <div>Loading...</div>
            ) : (
              <>
                <h1 className="slds-text-heading_large">Submission Line not found</h1>
                <button
                  className="slds-button slds-button_brand slds-m-top_medium"
                  onClick={() => router.back()}
                >
                  Go Back
                </button>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  if (!mounted || currentStep < 9) {
    return null;
  }

  const isLOBLine = line.lineType === 'LOB';

  // For non-LOB lines, show a simple record page
  if (!isLOBLine) {
    const parseAttributes = (attrs: string | null | undefined): Array<{ key: string; value: string }> => {
      if (!attrs) return [];
      return attrs.split(',').map((pair) => {
        const idx = pair.indexOf(':');
        if (idx === -1) return { key: pair.trim(), value: '' };
        return { key: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
      });
    };
    const attributes = parseAttributes(line.lineAttributes);

    return (
      <IconSettings iconPath={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons`}>
        <div style={{ backgroundColor: '#f3f3f3', minHeight: '100vh' }}>
          <GlobalHeader />

          <div style={{ padding: '16px' }}>
            {/* Page Header */}
            <div style={{ backgroundColor: 'white', marginBottom: '16px' }}>
              <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#5867E8',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg style={{ width: '20px', height: '20px', fill: 'white' }} viewBox="0 0 52 52">
                    <path d="M39.5 6h-27C10.6 6 9 7.6 9 9.5v33c0 1.9 1.6 3.5 3.5 3.5h27c1.9 0 3.5-1.6 3.5-3.5v-33C43 7.6 41.4 6 39.5 6zM35 40H17c-.8 0-1.5-.7-1.5-1.5v-25c0-.8.7-1.5 1.5-1.5h18c.8 0 1.5.7 1.5 1.5v25c0 .8-.7 1.5-1.5 1.5z"/>
                  </svg>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Submission Line</div>
                  <h1 style={{ fontSize: '28px', fontWeight: 400, color: '#001e5b', margin: 0, lineHeight: '35px', marginBottom: '16px' }}>
                    {line.name}
                  </h1>

                  <div style={{ display: 'flex', gap: '80px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Submission</div>
                      <a
                        href={`/submissions/${line.insuranceSubmissionId}`}
                        onClick={(e) => {
                          e.preventDefault();
                          guardDetailNav(() => router.push(`/submissions/${line.insuranceSubmissionId}`));
                        }}
                        style={{ fontSize: '13px', color: '#0250d9', textDecoration: 'underline', lineHeight: '18px', cursor: 'pointer' }}
                      >
                        {submission?.name || line.insuranceSubmissionId}
                      </a>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Line Type</div>
                      <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>{line.lineType}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>LOB</div>
                      <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>{line.lineOfBusiness}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Status</div>
                      <span style={{
                        backgroundColor: line.status === 'Active' ? '#2E844A' : '#C9C9C9',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        {line.status}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Owner</div>
                      <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>{line.owner || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ backgroundColor: 'white', marginBottom: '1px' }}>
              <div style={{ display: 'flex', gap: '24px', padding: '0 16px', borderBottom: '1px solid #e5e5e5' }}>
                <button
                  onClick={() => guardDetailNav(() => setSelectedTab('details'))}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '12px 0',
                    fontSize: '13px',
                    fontWeight: selectedTab === 'details' ? 600 : 400,
                    color: selectedTab === 'details' ? '#0176D3' : '#706E6B',
                    borderBottom: selectedTab === 'details' ? '2px solid #0176D3' : '2px solid transparent',
                    cursor: 'pointer',
                    marginBottom: '-1px'
                  }}
                >
                  Details
                </button>
                <button
                  onClick={() => guardDetailNav(() => setSelectedTab('related'))}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '12px 0',
                    fontSize: '13px',
                    fontWeight: selectedTab === 'related' ? 600 : 400,
                    color: selectedTab === 'related' ? '#0176D3' : '#706E6B',
                    borderBottom: selectedTab === 'related' ? '2px solid #0176D3' : '2px solid transparent',
                    cursor: 'pointer',
                    marginBottom: '-1px'
                  }}
                >
                  Related
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div style={{ backgroundColor: 'white', padding: '16px' }}>
              {selectedTab === 'details' && (
                <div>
                  {/* Line Information Section */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ padding: '12px 16px', backgroundColor: '#f3f3f3', borderRadius: '4px 4px 0 0', fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>
                      Line Information
                    </div>
                    <div style={{ backgroundColor: 'white', padding: '16px', border: '1px solid #e5e5e5', borderTop: 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <EditableField fieldName="name" label="Line Name" value={line.name} />
                        <EditableField fieldName="lineType" label="Line Type" value={line.lineType} />
                        <EditableField fieldName="lineOfBusiness" label="Line of Business" value={line.lineOfBusiness} />
                        <EditableField fieldName="status" label="Status" value={line.status} />
                        <EditableField fieldName="owner" label="Owner" value={line.owner || ''} />
                        <EditableField fieldName="parentRecord" label="Parent Record" value={parentRecordName(line)} isLink />
                      </div>
                    </div>
                  </div>

                  {/* Financial Information Section */}
                  {(line.coverageLimit || line.deductible || line.premiumAllocation || line.insuredValue) && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ padding: '12px 16px', backgroundColor: '#f3f3f3', borderRadius: '4px 4px 0 0', fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>
                        Financial Information
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '16px', border: '1px solid #e5e5e5', borderTop: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          {line.insuredValue && (
                            <EditableField fieldName="insuredValue" label="Insured Value" value={line.insuredValue} type="number" />
                          )}
                          {line.coverageLimit && (
                            <EditableField fieldName="coverageLimit" label="Coverage Limit" value={line.coverageLimit} type="number" />
                          )}
                          {line.deductible && (
                            <EditableField fieldName="deductible" label="Deductible" value={line.deductible} type="number" />
                          )}
                          {line.premiumAllocation && (
                            <EditableField fieldName="premiumAllocation" label="Premium Allocation" value={line.premiumAllocation} type="number" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attributes Section */}
                  {attributes.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ padding: '12px 16px', backgroundColor: '#f3f3f3', borderRadius: '4px 4px 0 0', fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>
                        Attributes
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '16px', border: '1px solid #e5e5e5', borderTop: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          {attributes.map((attr, idx) => (
                            <div key={idx}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>{attr.key}</div>
                              <div style={{ fontSize: '13px', color: '#001e5b' }}>{attr.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedTab === 'related' && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#5c5c5c', fontSize: '13px' }}>
                  No related records to display
                </div>
              )}
            </div>
          </div>

          {/* Sticky Save/Cancel footer — appears only with unsaved Details edits. */}
          {detailIsDirty && (
            <div style={{ position: 'sticky', bottom: 0, padding: '12px 24px', backgroundColor: '#fafaf9', borderTop: '1px solid #dddbda', boxShadow: '0 -2px 6px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', zIndex: 20 }}>
              <span style={{ position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#5c5c5c' }}>You have unsaved changes.</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={cancelDetailDirty} style={{ padding: '6px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', background: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveDetailDirty} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          )}

          {/* Discard-changes guard — fires when leaving with unsaved Details edits. */}
          {detailPendingNav && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '420px', maxWidth: '90vw', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.24)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#B85C00"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#001e5b' }}>Discard unsaved changes?</h2>
                </div>
                <div style={{ padding: '20px 24px', fontSize: '13px', color: '#2e2e2e', lineHeight: '19px' }}>
                  You have unsaved edits on this record. Leaving now will discard them.
                </div>
                <div style={{ padding: '12px 24px', backgroundColor: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button onClick={() => setDetailPendingNav(null)} style={{ padding: '6px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', background: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Keep editing</button>
                  <button onClick={() => { const act = detailPendingNav; cancelDetailDirty(); setDetailPendingNav(null); act && act(); }} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Discard changes</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </IconSettings>
    );
  }

  // Submission lines always use Step 9 data
  const step9Config = (stepConfigurations as any)[9]?.submission;

  // Use Step 9 data
  const documents = step9Config?.documents || mockDocuments;
  const slackMessages = step9Config?.slackMessages || mockSlackMessages;
  const emailThreads = step9Config?.emails || mockEmailThreads;

  // Submission line specific activities (only after mounted to avoid hydration issues)
  const activities: ActivityItemProps[] = mounted ? [
    // At line step 3 the Data Reconciliation agentic task has completed and moves out of the task
    // list into the activity feed.
    ...(lineStep >= 3 && line.lineOfBusiness === 'Property' ? [
      {
        id: 'act-line-reconciliation',
        title: 'Data Reconciliation Complete',
        description: `${line.name} · Reconciliation Agent`,
        completedBy: 'Reconciliation Agent',
        timestamp: '10:07 AM · May 13',
        status: 'completed' as const,
        details: 'Reconciled the Verisk 360 enrichment data against the canonical Commercial Property data model. High-confidence attributes were auto-mapped; ambiguous attributes were routed to the Unmapped Attributes pool for underwriter review.',
        detailsList: [
          'Auto-mapped construction, roof, and geospatial attributes',
          'Standardized enriched values to canonical formats',
          'Flagged ambiguous attributes as unmapped'
        ]
      }
    ] : []),
    // At line step 2+ the Verisk enrichment has completed and is logged in the activity feed.
    ...(lineStep >= 2 && line.lineOfBusiness === 'Property' ? [
      {
        id: 'act-verisk-enrichment',
        title: 'Verisk Data Enrichment Complete',
        description: `${line.name} · Enrichment API`,
        completedBy: 'Verisk 360',
        timestamp: '10:03 AM · May 13',
        status: 'completed' as const,
        details: 'Retrieved 18 enriched property, geospatial, and CAT-exposure attributes from the Verisk 360 property enrichment API.',
        detailsList: [
          'Construction, roof, and building characteristics',
          'Geospatial coordinates and FEMA flood zone',
          'CAT exposure: earthquake, wildfire, hail',
          'Fire protection and water supply data'
        ]
      }
    ] : []),
    {
      id: 'act-line-created',
      title: 'Submission Line Created',
      description: `${line.name} · System Task`,
      completedBy: 'System',
      timestamp: '9:42 AM · May 13',
      status: 'completed' as const,
      warningMessage: 'Data discrepancies and duplicate values found. Review and resolve before proceeding to quoting.',
      details: `${line.lineOfBusiness} submission line created with extracted data from ACORD forms and broker email.`,
      detailsList: [
        'Line type: LOB',
        'Coverage details extracted',
        'Financial data populated',
        'Requires review for discrepancies'
      ]
    }
  ] : [];

  // At the pricing & quoting step (line step 4) every discrepancy on the Property line is resolved,
  // so nothing needs attention any longer.
  const isPricingStep = mounted && !!line && line.lineOfBusiness === 'Property' && lineStep >= 4;

  const attentionActivities: ActivityItemProps[] = isPricingStep ? [] : activities.filter(
    (a: ActivityItemProps) => (a.warningMessage || a.errorMessage) && !dismissedAttentionIds.has(a.id)
  );

  // Needs Attention is a set of clickable notifications, not task/activity tiles.
  const attentionNotifications = attentionActivities.map((act) => {
    const isError = !!act.errorMessage;
    const raw = String(act.warningMessage ?? act.errorMessage ?? '');
    let title = act.title;
    if (/discrepan|duplicate/i.test(raw)) title = 'Data discrepancies found';
    else if (isError) title = `${act.title} failed`;
    return {
      id: act.id,
      isError,
      title,
      message: act.errorMessage || act.warningMessage,
      onClick: () => setSelectedTab('submission-lines'),
    };
  });

  // Submission line specific pending tasks (only after mounted to avoid hydration issues).
  // Task set follows the enrichment lifecycle line step:
  //   1 — manual "Run <vendor> enrichment" tasks (enrichment not yet run)
  //   2 — enrichment tasks complete + agentic Data Reconciliation running on the received Verisk data
  //   3 — reconciliation complete + the manual discrepancy-review task
  const reconciliationAgentSteps = [
    {
      id: 'lr-step-1',
      title: 'Load Enriched Attributes',
      description: 'Loaded the Verisk 360 enrichment response for Location 1 — Chicago Warehouse: 18 property, geospatial, and CAT-exposure attributes retrieved via the property enrichment API.',
      status: 'completed' as const,
      timestamp: '10:04 AM',
    },
    {
      id: 'lr-step-2',
      title: 'Normalize Enriched Values',
      description: 'Standardized enriched field formats — construction class to the ISO taxonomy, coordinates to decimal degrees, distances to miles, and currency values to USD.',
      status: 'completed' as const,
      timestamp: '10:05 AM',
    },
    {
      id: 'lr-step-3',
      title: 'Match to Canonical Model',
      description: 'Matched enriched attributes to canonical terms in the Commercial Property data model. High-confidence matches (Construction Type, Year Built, Square Footage, roof + geospatial attributes) auto-mapped.',
      status: 'in-progress' as const,
      timestamp: '10:06 AM',
    },
    {
      id: 'lr-step-4',
      title: 'Flag Ambiguous Attributes',
      description: 'Will route enriched attributes without a confident canonical match (e.g. Foundation Type, Distance to Coast, Water Supply Type) to the Unmapped Attributes pool for underwriter review.',
      status: 'pending' as const,
    },
  ];

  // The demo only shows the Verisk enrichment run. Each enrichment task exposes a "Run" command
  // (via hasRunTask); clicking Run flips it to an in-progress manual state (see runEnrichmentTaskIds).
  const enrichmentManualTasks = [
    {
      id: 'task-run-verisk',
      title: 'Run Verisk enrichment',
      assignedTo: line.name,
      parentLabel: submission?.name,
      taskType: 'Manual Task',
      progressType: 'normal',
      status: 'not-started',
      description: 'Call the Verisk 360 property enrichment API to retrieve building, geospatial, and CAT-exposure attributes for this location.',
      hasRunTask: true,
    },
  ];

  const reviewDiscrepanciesTask = {
    id: 'task-review-discrepancies',
    title: 'Review Submission Line for Discrepancies',
    assignedTo: line.name,
    parentLabel: submission?.name,
    taskType: 'Manual Task',
    progressType: 'normal',
    status: 'not-started',
    description: 'Review and resolve data discrepancies and duplicate values found during line creation',
    hasMarkComplete: true,
  };

  // At step 4 (Pricing & Quoting) every discrepancy is resolved — the discrepancy-review task is
  // replaced by a manual task to map the line to a product and generate a quote.
  const mapProductTask = {
    id: 'task-map-product-quote',
    title: 'Map Product and Quote',
    assignedTo: line.name,
    parentLabel: submission?.name,
    taskType: 'Manual Task',
    progressType: 'normal',
    status: 'not-started',
    description: 'Review the product mapping for this submission line and generate a quote.',
    hasRunTask: true,
    runTaskLabel: 'Review Product Mapping',
    openProductMapping: true,
  };

  const pendingTasks = (mounted && line.lineOfBusiness === 'Property')
    ? (lineStep <= 1
        ? [
            ...enrichmentManualTasks.map((t) => (
              runEnrichmentTaskIds.has(t.id) ? { ...t, status: 'in-progress' } : t
            )),
            reviewDiscrepanciesTask,
          ]
        : lineStep === 2
          ? [
              // Verisk enrichment task is complete at step 2 and drops out of the task list —
              // only the running Data Reconciliation and the ongoing discrepancy review remain.
              {
                id: 'task-line-reconciliation',
                title: 'Data Reconciliation',
                type: 'agentic' as const,
                assignedTo: 'Agent',
                agentName: 'Reconciliation Agent',
                status: 'in-progress',
                description: 'Reconcile the received Verisk enrichment data against the canonical Commercial Property data model.',
                dependentOn: 'Run Verisk enrichment',
                agentSteps: reconciliationAgentSteps,
              },
              reviewDiscrepanciesTask,
            ]
          : lineStep === 3
            ? [
                // At step 3 the Data Reconciliation task is complete and moves to the activity feed —
                // only the discrepancy review remains in the task list.
                reviewDiscrepanciesTask,
              ]
            : [
                // Step 4 (Pricing & Quoting): discrepancies are resolved; the review task is replaced
                // by the product-mapping / quote task.
                mapProductTask,
              ])
    : [];

  // Handler for opening agent activity panel
  const handleTaskClick = (task: any) => {
    if (task.type === 'agentic' && task.agentSteps) {
      setSelectedAgentTask(task);
      setShowAgentActivity(true);
    }
  };

  return (
    <IconSettings iconPath={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons`}>
      <div style={{ backgroundColor: '#f3f3f3', minHeight: '100vh', ...(vsStandalone ? { height: '100vh', overflow: 'hidden' } : {}) }}>
        {!lobFullScreen && !vsStandalone && <GlobalHeader />}

        {/* Salesforce builder chrome — only in the standalone full-screen tab */}
        {lobFullScreen && (
          <div>
            {/* Navy toolbar */}
            <div style={{
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
                <span style={{ fontSize: '14px', color: '#c9d4e0', whiteSpace: 'nowrap', marginLeft: '16px' }}>Commercial Property LOB</span>
                <span style={{ fontSize: '14px', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginLeft: '48px' }}>LOB Data</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: lobFullScreen ? '0' : '16px' }}>
          {/* Page Header - White background */}
          {!lobFullScreen && (<>
          <div style={{ backgroundColor: 'white', marginBottom: '0', position: 'relative' }}>
            {!isHeaderCompact ? (
              // Expanded Header
              <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                {/* Icon */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#5867E8',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg style={{ width: '20px', height: '20px', fill: 'white' }} viewBox="0 0 52 52">
                    <path d="M39.5 6h-27C10.6 6 9 7.6 9 9.5v33c0 1.9 1.6 3.5 3.5 3.5h27c1.9 0 3.5-1.6 3.5-3.5v-33C43 7.6 41.4 6 39.5 6zM35 40H17c-.8 0-1.5-.7-1.5-1.5v-25c0-.8.7-1.5 1.5-1.5h18c.8 0 1.5.7 1.5 1.5v25c0 .8-.7 1.5-1.5 1.5z"/>
                  </svg>
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  {/* Label */}
                  <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Submission Line</div>

                  {/* Title */}
                  <h1 style={{ fontSize: '28px', fontWeight: 400, color: '#001e5b', margin: 0, lineHeight: '35px', marginBottom: '16px' }}>
                    {line.name}
                  </h1>

                  {/* Details row */}
                  <div style={{ display: 'flex', gap: '80px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Submission</div>
                      <a
                        href={`/submissions/${line.insuranceSubmissionId}`}
                        onClick={(e) => {
                          e.preventDefault();
                          guardDetailNav(() => router.push(`/submissions/${line.insuranceSubmissionId}`));
                        }}
                        style={{ fontSize: '13px', color: '#0250d9', textDecoration: 'underline', lineHeight: '18px', cursor: 'pointer' }}
                      >
                        {submission?.name || line.insuranceSubmissionId}
                      </a>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Line Type</div>
                      <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>{line.lineType}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>LOB</div>
                      <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>{line.lineOfBusiness}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Status</div>
                      <span style={{
                        backgroundColor: line.status === 'Active' ? '#2E844A' : '#C9C9C9',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        {line.status}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Owner</div>
                      <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>{line.owner || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <ButtonGroup id="page-header-actions">
                    <Button label="Edit" />
                  </ButtonGroup>
                </div>
              </div>
            ) : (
              // Compact Header
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Icon */}
                <div style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: '#5867E8',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg style={{ width: '16px', height: '16px', fill: 'white' }} viewBox="0 0 52 52">
                    <path d="M39.5 6h-27C10.6 6 9 7.6 9 9.5v33c0 1.9 1.6 3.5 3.5 3.5h27c1.9 0 3.5-1.6 3.5-3.5v-33C43 7.6 41.4 6 39.5 6zM35 40H17c-.8 0-1.5-.7-1.5-1.5v-25c0-.8.7-1.5 1.5-1.5h18c.8 0 1.5.7 1.5 1.5v25c0 .8-.7 1.5-1.5 1.5z"/>
                  </svg>
                </div>

                {/* Title */}
                <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#001e5b', margin: 0, lineHeight: '24px', flex: 1 }}>
                  {line.name}
                </h1>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{
                    backgroundColor: '#e5e5e5',
                    color: '#2e2e2e',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    {line.lineType}
                  </div>
                  <div style={{
                    backgroundColor: '#e5e5e5',
                    color: '#2e2e2e',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    {line.lineOfBusiness}
                  </div>
                </div>

                {/* Stage Badge */}
                <div style={{
                  backgroundColor: '#032D60',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500
                }}>
                  Intake and Clearance
                </div>

                {/* Overflow Menu */}
                <div style={{ position: 'relative' }}>
                  <Button
                    iconCategory="utility"
                    iconName="threedots_vertical"
                    iconSize="small"
                    variant="icon"
                  />
                </div>
              </div>
            )}

            {/* Toggle Arrow at Bottom Center */}
            <button
              onClick={() => setIsHeaderCompact(!isHeaderCompact)}
              style={{
                position: 'absolute',
                bottom: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'white',
                border: '1px solid #c9c9c9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                padding: 0
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="#5c5c5c"
                style={{
                  transform: isHeaderCompact ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              >
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
              </svg>
            </button>
          </div>

          {/* Progress Path - above the line summary; stays visible when header is collapsed */}
          <div style={{
            marginTop: '16px',
            marginBottom: '0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', flex: 1, height: '32px' }}>
              {(() => {
                const stages = [
                  'Intake and Clearance',
                  'Data Enrichment',
                  'Risk Evaluation',
                  'Pricing and Quoting',
                  'Binding and Policy Issuance',
                ];
                // On landing (line step 1-3) the line sits in Data Enrichment (index 1);
                // at step 4 it advances to Pricing and Quoting (index 3). Prior stages are complete.
                const currentIdx = lineStep >= 4 ? 3 : 1;
                return stages.map((label, idx) => {
                  const state = idx < currentIdx ? 'complete' : idx === currentIdx ? 'current' : 'incomplete';
                  const bg = state === 'current' ? '#032D60' : state === 'complete' ? '#2E844A' : '#C9C9C9';
                  const fg = state === 'incomplete' ? '#706E6B' : 'white';
                  const clipPath = idx === 0
                    ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                    : idx === stages.length - 1
                      ? 'polygon(12px 0, 100% 0, 100% 100%, 12px 100%, 0 50%)'
                      : 'polygon(12px 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0 50%)';
                  return (
                    <div key={label} style={{
                      position: 'relative',
                      flex: 1,
                      backgroundColor: bg,
                      color: fg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 400,
                      clipPath,
                      ...(idx > 0 ? { marginLeft: '-1px' } : {})
                    }}>
                      {label}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Mark as Complete button */}
            <button className="slds-button slds-button_brand" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 16px',
              whiteSpace: 'nowrap'
            }}>
              <svg style={{ width: '14px', height: '14px', fill: 'white' }} viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Mark as Complete
            </button>
          </div>

          {/* Line Summary Card */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #c9c9c9',
            borderRadius: '12px',
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            <div style={{
              backgroundColor: '#f1f6fa',
              borderBottom: isSummaryExpanded ? '1px solid #c9c9c9' : 'none',
              padding: '8px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="#001e5b"
                    style={{
                      transform: isSummaryExpanded ? 'rotate(180deg)' : 'rotate(90deg)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                  </svg>
                </button>
                <Icon
                  assistiveText={{ label: 'Sparkles' }}
                  category="utility"
                  name="sparkles"
                  size="x-small"
                />
                <span style={{ fontSize: '16px', fontWeight: 600, color: 'black' }}>Line Summary</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#5c5c5c' }}>Created 2 hours ago</span>
                <button
                  title="Sync"
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 52 52" fill="#0176D3">
                    <use href={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#sync`} />
                  </svg>
                </button>
              </div>
            </div>
            {isSummaryExpanded && (
              <div style={{ padding: '12px 16px' }}>
                {currentStep === 1 && (
                  <p style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px', margin: 0 }}>
                    Email has been received from Niki Paoloni representing Vanguard Insurance Partners
                  </p>
                )}
                {currentStep === 2 && (
                  <p style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px', margin: 0 }}>
                    Email has been received from Niki Paoloni representing Vanguard Insurance Partners
                  </p>
                )}
                {currentStep === 3 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      Manual classification of <strong>ACORD 126 - Commercial General Liability.pdf</strong> is complete. Partial Extraction is now re-running to pull the General Liability fields into the submission record.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><strong>Manual classification:</strong> Pages 1-9 mapped to <strong>ACORD 126</strong> by Martha (UW Team Lead).</li>
                      <li><strong>Extraction in progress:</strong> Coverage limits, operations classification, and prior claims history being extracted from ACORD 126.</li>
                      <li><strong>Already extracted:</strong> ACORD 125 and ACORD 140 fields from the combined Commercial Application & Property Section PDF.</li>
                    </ul>
                  </div>
                )}
                {currentStep === 4 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      Email received from Niki Paoloni (Vanguard Insurance Partners) submitting NexGen Biologics Inc — a 12-year-old pharmaceutical manufacturer ($47.2M revenue, 285 employees) — for new business across Property, General Liability, and Business Auto.
                    </p>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>Document extraction complete:</p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><strong>ACORD 125</strong> — Legal entity NexGen Biologics Inc, FEIN 47-3829104, NAICS 325412 (Pharmaceutical Preparation Manufacturing), based in San Jose, CA. Effective date 06/01/2026.</li>
                      <li><strong>ACORD 140</strong> — 3 California locations totalling $19.5M TIV. All fire-resistive construction, Protection Class 3, sprinklered with central station alarms.</li>
                      <li><strong>ACORD 126</strong> — General Liability $1M / $2M limits requested, GL class 50714. Two minor prior claims totalling $34,800 over the past 3 years.</li>
                    </ul>
                  </div>
                )}
                {currentStep === 5 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      Three qualifying checks were performed by Martha (UW Team Lead) on the NexGen Biologics submission. Two passed cleanly; one is pending broker confirmation.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><strong>Data Completion Check — Incomplete.</strong> Legal entity, FEIN, address, NAICS, and broker info confirmed. Missing: 5-year loss runs, Schedule of Vehicles for Business Auto (8 vehicles), and written confirmation of all operating states. Broker follow-up required.</li>
                      <li><strong>Appetite Check — Within appetite (with caveat).</strong> NAICS 325412 is on the approved class list, $47.2M revenue is within target range, 12 years in business clears the 5-year minimum. <span style={{ color: '#B85C00', fontWeight: 600 }}>Warning:</span> no operating states listed in the submission — geographic footprint cannot be confirmed.</li>
                      <li><strong>Clearance Check — Eligible to quote.</strong> No duplicate submission for the same insured/effective date, producer Vanguard Insurance Partners is actively appointed and licensed, no declinations within the last 24 months.</li>
                    </ul>
                  </div>
                )}
                {currentStep === 6 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      Broker follow-up complete. Niki Paoloni replied confirming the geographic footprint, clearing the open item from the Appetite Check.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><strong>Operating states confirmed:</strong> California (3 insured properties — San Jose × 2, Hayward), Arizona (Phoenix sales office, leased), and Nevada (Las Vegas sales office, leased). No warehouses or owned vehicles outside California.</li>
                      <li><strong>Appetite Check status:</strong> Ready to be re-evaluated against the confirmed three-state footprint.</li>
                      <li><strong>Next step:</strong> Complete Data Extraction is on hold pending the underwriter's go-ahead to create submission lines.</li>
                    </ul>
                  </div>
                )}
                {currentStep === 7 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      Data Completion, Appetite, and Clearance checks have all been completed. The Complete Data Extraction agent is now running an end-to-end pass across the submission documents and email thread.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><strong>Qualifying checks:</strong> Data Completion, Appetite, and Clearance — all passed and logged in the activity feed.</li>
                      <li><strong>Complete Data Extraction:</strong> Agent running deep extraction across ACORD 125, 140, 126, and the broker email thread to populate Property, General Liability, and Business Auto data.</li>
                      <li><strong>Open work:</strong> Data Reconciliation is on hold pending Complete Data Extraction.</li>
                    </ul>
                  </div>
                )}
                {currentStep === 8 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      Complete Data Extraction has finished — extraction requests across both documents are complete. The Data Reconciliation agent is now grouping the raw extracted data into lines of business and creating the corresponding submission lines.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><strong>Complete Data Extraction:</strong> Completed and logged in the activity feed; all extraction requests on both documents now Complete.</li>
                      <li><strong>Data Reconciliation:</strong> Agent reconciling fields across sources, identifying lines of business, and creating Property, General Liability, and Business Auto submission lines.</li>
                    </ul>
                  </div>
                )}
                {currentStep === 9 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      Data Reconciliation is complete. The reconciliation agent identified Property and General Liability lines of business and created the corresponding submission lines, but flagged data discrepancies and duplicate values that need underwriter review on each line.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><strong>Lines of business identified:</strong> Property and General Liability. Business Auto could not be created — Schedule of Vehicles is still missing.</li>
                      <li><strong>Submission lines created:</strong> Commercial Property and General Liability submission lines materialized with the reconciled data.</li>
                      <li><strong>Open work:</strong> Data discrepancies and duplicate values flagged on both lines — resolve from the respective line of business.</li>
                    </ul>
                  </div>
                )}
                {currentStep === 10 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      All attribute-mapping discrepancies and duplicate locations on the Commercial Property line have been resolved. The line is fully reconciled and ready for pricing and quoting.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><strong>Reconciliation complete:</strong> Chicago Warehouse address conflict resolved and every flagged attribute mapped to its canonical term.</li>
                      <li><strong>Duplicates resolved:</strong> The San Jose and Austin location pairs have been reviewed and merged where appropriate.</li>
                      <li><strong>Next step:</strong> Generate a quote for this line from the submission record — pricing rolls up from the coverage-level premiums on this line's hierarchy.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          </>)}

          {/* Main Content Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: lobFullScreen ? '1fr' : (isLeftCollapsed ? '1fr 56px' : '70% 30%'), gap: '16px', marginTop: lobFullScreen ? '0' : (isHeaderCompact ? '24px' : '16px'), transition: 'grid-template-columns 0.2s' }}>
            {/* Left Column - Needs Attention + Pending Tasks + Activity Log */}
            {lobFullScreen ? null : isLeftCollapsed ? (
              <div
                onClick={() => setIsLeftCollapsed(false)}
                title="Expand"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsLeftCollapsed(false); }}
                style={{
                  gridColumn: 2,
                  backgroundColor: 'white',
                  border: '1px solid #e5e5e5',
                  borderRadius: '12px',
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  alignSelf: 'flex-start',
                  cursor: 'pointer'
                }}
              >
                <style>{`
                  @keyframes collapsedTaskSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                  @keyframes collapsedTaskPulseAgentic {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(150, 2, 199, 0); }
                    50% { box-shadow: 0 0 0 3px rgba(150, 2, 199, 0.2); }
                  }
                  @keyframes collapsedTaskPulseManual {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(184, 92, 0, 0); }
                    50% { box-shadow: 0 0 0 3px rgba(184, 92, 0, 0.2); }
                  }
                  @keyframes collapsedAgenticBounce {
                    0%, 60%, 100% { transform: translateY(0); }
                    70% { transform: translateY(-4px); }
                    80% { transform: translateY(0); }
                    87% { transform: translateY(-2px); }
                    94% { transform: translateY(0); }
                  }
                `}</style>

                {/* Expand chevron */}
                <div style={{
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: '1px solid #e5e5e5',
                  width: '100%'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#5c5c5c">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>

                {/* Needs Attention - count badge in pastel amber */}
                {(() => {
                  const count = attentionActivities.length;
                  const hasItems = count > 0;
                  return (
                    <div title={`Needs Attention: ${count}`} style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: hasItems ? '#fef5e8' : '#f3f3f3',
                      border: `1px solid ${hasItems ? '#f5b87c' : '#c9c9c9'}`,
                      color: hasItems ? '#5c3a00' : '#5c5c5c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 700
                    }}>
                      {count}
                    </div>
                  );
                })()}

                {/* Divider */}
                {pendingTasks.length > 0 && (
                  <div style={{ width: '24px', height: '1px', backgroundColor: '#e5e5e5' }} />
                )}

                {/* Pending Tasks - one icon per task; styled to match badge palette */}
                {pendingTasks.map((task: any) => {
                  const isAgentic = task.type === 'agentic';

                  let bg = '#f3f3f3';
                  let border = '#c9c9c9';
                  let iconColor = '#5c5c5c';
                  let label = 'Pending';

                  if (task.status === 'in-progress' && isAgentic) {
                    bg = 'linear-gradient(to left, rgba(2, 80, 217, 0.12), rgba(150, 2, 199, 0.12))';
                    border = '#9602c7';
                    iconColor = '#5a1a73';
                    label = 'Agentic in progress';
                  } else if (task.status === 'in-progress') {
                    bg = '#fef5e8';
                    border = '#f5b87c';
                    iconColor = '#B85C00';
                    label = 'In progress';
                  } else if (task.status === 'on-hold') {
                    bg = '#f3f3f3';
                    border = '#939393';
                    iconColor = '#5c5c5c';
                    label = 'On hold';
                  } else if (task.status === 'pending') {
                    bg = '#eaf3fc';
                    border = '#0176D3';
                    iconColor = '#0176D3';
                    label = 'Manual task';
                  } else if (task.status === 'completed') {
                    bg = '#e7f5ec';
                    border = '#2E844A';
                    iconColor = '#1a4f2c';
                    label = 'Completed';
                  } else if (task.status === 'error') {
                    bg = '#fdecea';
                    border = '#c23934';
                    iconColor = '#c23934';
                    label = 'Error';
                  }

                  const iconSvg = (task.status === 'in-progress' && isAgentic) ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#agenticBarGradLine)" style={{ animation: 'collapsedAgenticBounce 2s ease-in-out infinite' }}>
                      <defs>
                        <linearGradient id="agenticBarGradLine" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#9602c7"/>
                          <stop offset="100%" stopColor="#0250d9"/>
                        </linearGradient>
                      </defs>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ) : task.status === 'in-progress' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={iconColor} style={{ animation: 'collapsedTaskSpin 1.1s linear infinite' }}>
                      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                    </svg>
                  ) : task.status === 'on-hold' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={iconColor}>
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : task.status === 'completed' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={iconColor}>
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  ) : task.status === 'error' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={iconColor}>
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={iconColor}>
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  );

                  const isActive = task.status === 'in-progress';
                  const activeAnim = isAgentic ? 'collapsedTaskPulseAgentic' : 'collapsedTaskPulseManual';
                  return (
                    <div
                      key={task.id}
                      title={`${task.title} — ${label}`}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: bg,
                        border: `1px solid ${border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        ...(isActive ? { animation: `${activeAnim} 2s ease-in-out infinite` } : {})
                      }}
                    >
                      {iconSvg}
                    </div>
                  );
                })}

                {/* Divider */}
                {activities.length > 0 && (
                  <div style={{ width: '24px', height: '1px', backgroundColor: '#e5e5e5' }} />
                )}

                {/* Activities - one circle per activity using pastel + dark border + dark icon */}
                {activities.map((activity: ActivityItemProps) => {
                  const hasWarning = activity.status === 'completed' && !!activity.warningMessage;
                  const hasError = !!activity.errorMessage;

                  let bg = '#f3f3f3';
                  let border = '#c9c9c9';
                  let iconColor = '#5c5c5c';

                  if (hasError) {
                    bg = '#fdecea';
                    border = '#c23934';
                    iconColor = '#c23934';
                  } else if (hasWarning) {
                    bg = '#fef5e8';
                    border = '#f5b87c';
                    iconColor = '#B85C00';
                  } else if (activity.status === 'completed') {
                    bg = '#e7f5ec';
                    border = '#2E844A';
                    iconColor = '#1a4f2c';
                  } else if (activity.status === 'in-progress') {
                    bg = '#eaf3fc';
                    border = '#0176D3';
                    iconColor = '#0176D3';
                  }

                  const iconSvg = hasError ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={iconColor}>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                  ) : hasWarning ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={iconColor}>
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  ) : activity.status === 'completed' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={iconColor}>
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={iconColor}>
                      <circle cx="12" cy="12" r="6" />
                    </svg>
                  );

                  return (
                    <div
                      key={activity.id}
                      title={activity.title}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: bg,
                        border: `1px solid ${border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box'
                      }}
                    >
                      {iconSvg}
                    </div>
                  );
                })}
              </div>
            ) : (
            <div style={{ gridColumn: 2, paddingRight: '8px' }}>
              {/* Collapse toggle */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
                <button
                  onClick={() => setIsLeftCollapsed(true)}
                  title="Collapse"
                  style={{
                    border: '1px solid #e5e5e5',
                    background: 'white',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#5c5c5c">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                </button>
              </div>

              {/* Needs Attention Section — at Pricing & Quoting all items are resolved,
                  so this shows the 0-state (count 0 + empty message). */}
              <div style={{ marginBottom: '16px' }}>
                {(() => {
                  const count = attentionActivities.length;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#2e2e2e' }}>
                        Needs Attention
                      </h3>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'white',
                        backgroundColor: count > 0 ? '#B85C00' : '#939393',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        minWidth: '20px',
                        textAlign: 'center',
                        lineHeight: '16px'
                      }}>
                        {count}
                      </span>
                    </div>
                  );
                })()}
                {(() => {
                  if (attentionActivities.length === 0) {
                    return (
                      <div style={{
                        padding: '8px 0',
                        color: '#706E6B',
                        fontSize: '13px'
                      }}>
                        No tasks or activities require your attention right now
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {attentionNotifications.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: '12px 14px',
                            backgroundColor: 'white',
                            border: '1px solid #e5e5e5',
                            borderRadius: '8px'
                          }}
                        >
                          <div
                            onClick={n.onClick}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              cursor: 'pointer'
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill={n.isError ? '#c23934' : '#B85C00'} style={{ flexShrink: 0, marginTop: '1px' }}>
                              {n.isError ? (
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                              ) : (
                                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                              )}
                            </svg>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: n.isError ? '#c23934' : '#B85C00',
                                lineHeight: '18px',
                                marginBottom: '2px'
                              }}>
                                {n.title}
                              </div>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', lineHeight: '17px' }}>
                                {n.message}
                              </div>
                            </div>
                          </div>
                          <div style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid #e5e5e5',
                            display: 'flex',
                            justifyContent: 'center'
                          }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDismissedAttentionIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(n.id);
                                  return next;
                                });
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
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Tasks / Activity tabs */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e5e5e5',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {([
                    { key: 'tasks', label: 'Tasks', count: pendingTasks.length },
                    { key: 'activity', label: 'Activity Log', count: activities.length },
                  ] as const).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setLeftPanelTab(t.key)}
                      style={{
                        padding: '8px 12px',
                        border: 'none',
                        background: 'none',
                        fontSize: '15px',
                        fontWeight: leftPanelTab === t.key ? 600 : 400,
                        color: leftPanelTab === t.key ? '#0176D3' : '#706E6B',
                        borderBottom: leftPanelTab === t.key ? '2px solid #0176D3' : '2px solid transparent',
                        marginBottom: '-1px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {t.label}
                      {t.count > 0 && (
                        <span style={{
                          fontSize: '11px',
                          color: leftPanelTab === t.key ? '#0176D3' : '#5c5c5c',
                          backgroundColor: leftPanelTab === t.key ? '#e8f1fb' : '#e5e5e5',
                          padding: '1px 7px',
                          borderRadius: '12px',
                          fontWeight: 600
                        }}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {leftPanelTab === 'tasks' && (
                  <button
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      color: '#0176D3',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    onClick={() => setIsNewTaskModalOpen(true)}
                  >
                    New Task
                  </button>
                )}
              </div>


              {/* Render Pending Tasks - only on Tasks tab */}
              {leftPanelTab === 'tasks' && (() => {
                const parentsOf = new Map<string, string[]>();
                const tasksByTitle = new Map<string, any>();
                pendingTasks.forEach((t: any) => tasksByTitle.set(t.title, t));
                pendingTasks.forEach((t: any) => {
                  const raw = t.dependentOn;
                  const parentTitles: string[] = !raw
                    ? []
                    : Array.isArray(raw)
                      ? raw
                      : [raw];
                  const parentIds = parentTitles
                    .map((title) => tasksByTitle.get(title)?.id)
                    .filter((x): x is string => !!x);
                  parentsOf.set(t.id, parentIds);
                });

                const depthOf = new Map<string, number>();
                const computeDepth = (id: string): number => {
                  if (depthOf.has(id)) return depthOf.get(id)!;
                  const ps = parentsOf.get(id) || [];
                  if (ps.length === 0) { depthOf.set(id, 0); return 0; }
                  const d = Math.max(...ps.map(computeDepth)) + 1;
                  depthOf.set(id, d);
                  return d;
                };
                pendingTasks.forEach((t: any) => computeDepth(t.id));

                const ordered = [...pendingTasks].sort((a: any, b: any) => {
                  const da = depthOf.get(a.id) || 0;
                  const db = depthOf.get(b.id) || 0;
                  if (da !== db) return da - db;
                  return pendingTasks.indexOf(a) - pendingTasks.indexOf(b);
                });
                const indexOfId = new Map<string, number>();
                ordered.forEach((t: any, i: number) => indexOfId.set(t.id, i));

                // Direct-only highlight: only the clicked task and its direct parents
                const highlighted = new Set<string>();
                if (depHighlightTaskId) {
                  highlighted.add(depHighlightTaskId);
                  (parentsOf.get(depHighlightTaskId) || []).forEach((p) => highlighted.add(p));
                }
                const dimOthers = !!depHighlightTaskId;

                const INDENT = 48;
                const CIRCLE_SIZE = 32;
                const GUTTER_OFFSET = 14;
                const ROW_GAP = 8;

                const containerRect = depContainerRef.current?.getBoundingClientRect();
                const cardLeftOf = (id: string) => {
                  const el = depCardRefs.current.get(id);
                  if (!el || !containerRect) return null;
                  const r = el.getBoundingClientRect();
                  return {
                    x: r.left - containerRect.left,
                    yMid: r.top - containerRect.top + r.height / 2,
                  };
                };
                void depConnectorTick;

                return (
                <div ref={depContainerRef} style={{ marginBottom: '16px', position: 'relative' }}>
                  <svg
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
                  >
                    {containerRect && ordered.flatMap((task: any) => {
                      const ps = parentsOf.get(task.id) || [];
                      if (ps.length === 0) return [];
                      const childCircle = depCircleRefs.current.get(task.id);
                      if (!childCircle) return [];
                      const cr = childCircle.getBoundingClientRect();
                      const childCx = cr.left - containerRect.left;
                      const childCy = cr.top - containerRect.top + cr.height / 2;
                      return ps.map((pid: string) => {
                        const pCard = cardLeftOf(pid);
                        if (!pCard) return null;
                        const isHi = highlighted.has(task.id) && highlighted.has(pid);
                        const stroke = isHi ? '#0176D3' : '#c9c9c9';
                        const opacity = dimOthers && !isHi ? 0.25 : 1;
                        const gutterX = childCx - GUTTER_OFFSET;
                        const d = `M ${pCard.x} ${pCard.yMid} L ${gutterX} ${pCard.yMid} L ${gutterX} ${childCy} L ${childCx} ${childCy}`;
                        return (
                          <path
                            key={`${pid}->${task.id}`}
                            d={d}
                            stroke={stroke}
                            strokeWidth={isHi ? 2 : 1}
                            fill="none"
                            opacity={opacity}
                          />
                        );
                      }).filter(Boolean);
                    })}
                  </svg>

                  {ordered.map((task: any) => {
                    const depth = depthOf.get(task.id) || 0;
                    const ps = parentsOf.get(task.id) || [];
                    const parentCount = ps.length;
                    const isManuallyCreated = userCreatedTasks.some((t) => t.id === task.id);
                    const hideStatusBadge = task.id === 'task-classify-doc' || task.hideStatusBadge === true;
                    const isHi = highlighted.has(task.id);
                    const dim = dimOthers && !isHi;
                    const isActive = depHighlightTaskId === task.id;
                    return (
                    <div key={task.id} style={{
                      position: 'relative',
                      paddingLeft: depth * INDENT,
                      marginBottom: `${ROW_GAP}px`,
                      opacity: dim ? 0.35 : 1,
                      filter: dim ? 'blur(0.5px)' : 'none',
                      transition: 'opacity 0.15s, filter 0.15s'
                    }}>
                      <div
                        ref={(el) => {
                          if (el) depCardRefs.current.set(task.id, el);
                          else depCardRefs.current.delete(task.id);
                        }}
                        style={{ position: 'relative' }}
                      >
                        {parentCount > 0 && (
                          <button
                            type="button"
                            ref={(el) => {
                              if (el) depCircleRefs.current.set(task.id, el);
                              else depCircleRefs.current.delete(task.id);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDepHighlightTaskId((prev) => prev === task.id ? null : task.id);
                            }}
                            title={`${parentCount} dependenc${parentCount === 1 ? 'y' : 'ies'}`}
                            style={{
                              position: 'absolute',
                              left: -CIRCLE_SIZE / 2,
                              top: 14,
                              width: `${CIRCLE_SIZE}px`,
                              height: `${CIRCLE_SIZE}px`,
                              borderRadius: '50%',
                              border: '1px solid',
                              borderColor: isActive ? '#0176D3' : '#c9c9c9',
                              backgroundColor: isActive ? '#0176D3' : 'white',
                              color: isActive ? 'white' : '#5c5c5c',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              zIndex: 2,
                              boxShadow: isActive ? '0 0 0 2px rgba(1,118,211,0.18)' : 'none'
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 52 52"
                              fill={isActive ? 'white' : '#0176D3'}
                              aria-hidden="true"
                            >
                              <use href={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#hierarchy`} />
                            </svg>
                          </button>
                        )}
                    <PendingTask
                      hideDependencyIcon
                      id={task.id}
                      title={task.title}
                      assignedTo={task.assignedTo}
                      parentLabel={task.parentLabel}
                      taskType={isManuallyCreated ? 'Manually Created' : (task.dependentOn ? 'Dependent Task' : 'Stage Task')}
                      isManuallyCreated={isManuallyCreated}
                      hideStatusBadge={hideStatusBadge}
                      progressType={task.type === 'agentic' ? 'agentic' : 'normal'}
                      status={task.status}
                      onHoldReason={task.onHoldReason}
                      description={task.description || ''}
                      runTaskLabel={task.runTaskLabel}
                      dependentOn={task.dependentOn}
                      agenticSteps={task.agentSteps?.map((step: any) => ({
                        id: step.id,
                        title: step.title,
                        status: step.status,
                        timestamp: step.timestamp || '',
                        details: step.title === 'Email Analysis' ? (
                          <>
                            Analyzing{' '}
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedTab('communication');
                                setSelectedCommTab('email');
                                setSelectedEmailId('email-1');
                              }}
                              style={{ color: '#0176D3', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              email
                            </a>
                            {' '}content from{' '}
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedTab('communication');
                                setSelectedCommTab('email');
                                setSelectedEmailId('email-1');
                              }}
                              style={{ color: '#0176D3', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              Niki Paoloni
                            </a>
                            {' '}requesting commercial property and general liability insurance coverage for{' '}
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedTab('details');
                              }}
                              style={{ color: '#0176D3', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              NexGen Biologics
                            </a>
                            .
                          </>
                        ) : step.title === 'Document Identification' ? (
                          <>
                            Analysing{' '}
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedTab('documents');
                                setSelectedDocumentId('doc-1');
                              }}
                              style={{ color: '#0176D3', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              ACORD 125 + 140 - Commercial Application & Property Section.pdf
                            </a>
                            {' '}and{' '}
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedTab('documents');
                                setSelectedDocumentId('doc-3');
                              }}
                              style={{ color: '#0176D3', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              ACORD 126 - Commercial General Liability.pdf
                            </a>
                            {' '}to identify documents.
                          </>
                        ) : step.description,
                      }))}
                      onDraftEmail={task.hasDraftEmail ? () => setEmailComposerTaskId(task.id) : undefined}
                      onRunTask={
                        task.openProductMapping
                          ? () => setSelectedTab('product-mapping')
                          : task.hasRunTask && task.status === 'not-started'
                            ? () => setRunEnrichmentTaskIds((prev) => new Set(prev).add(task.id))
                            : isManuallyCreated && !task.hasDraftEmail
                              ? () => console.log('Run task', task.id)
                              : undefined
                      }
                      onClassify={
                        task.targetDocumentId
                          ? () => setClassifyDocumentId(task.targetDocumentId)
                          : undefined
                      }
                      onMarkComplete={
                        task.hasMarkComplete
                          ? () => console.log('Mark task complete', task.id)
                          : undefined
                      }
                      onEdit={() => console.log('Edit task')}
                      onDelete={() => console.log('Delete task')}
                    />
                      </div>
                    </div>
                    );
                  })}
                </div>
                );
              })()}

              {/* Activity Log - shown on Activity tab */}
              {leftPanelTab === 'activity' && (
                <ActivityLog
                  activities={activities}
                  showViewAll={true}
                  showHeading={false}
                  onViewAll={() => console.log('View all activities')}
                />
              )}
            </div>
            )}

            {/* Right Column - Tabs and Content */}
            <div ref={detailSectionRef} style={{ gridColumn: 1, gridRow: 1, backgroundColor: 'white', borderRadius: lobFullScreen ? '0' : '12px', overflow: 'visible', minHeight: lobFullScreen ? '100vh' : (isHeaderCompact ? 'calc(100vh - 200px)' : 'calc(100vh - 350px)'), display: 'flex', flexDirection: 'column' }}>
              {/* Tabs */}
              {!lobFullScreen && (
              <div style={{
                borderBottom: '1px solid #dddbda',
                display: 'flex',
                padding: '0 16px',
                backgroundColor: 'white'
              }}>
                {['LOB Data', 'Product Mapping', 'Email', 'Documents', 'Details', 'Related'].map((tab) => {
                  const tabKey = tab === 'LOB Data' ? 'submission-lines' : tab === 'Email' ? 'communication' : tab.toLowerCase().replace(' ', '-');
                  const showDocumentsError = false; // Not applicable for submission lines
                  const showSubmissionLinesWarning = tab === 'LOB Data' && line.lineOfBusiness === 'Property';
                  return (
                  <button
                    key={tab}
                    onClick={() => guardDetailNav(() => setSelectedTab(tabKey))}
                    style={{
                      padding: '16px 16px 14px 16px',
                      border: 'none',
                      background: 'none',
                      fontSize: '13px',
                      fontWeight: selectedTab === tabKey ? 600 : 400,
                      color: selectedTab === tabKey ? '#0176D3' : '#706E6B',
                      borderBottom: selectedTab === tabKey ? '2px solid #0176D3' : '2px solid transparent',
                      marginBottom: '-1px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {tab}
                    {showDocumentsError && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#c23934" aria-label="Error">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                    )}
                    {showSubmissionLinesWarning && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" aria-label="Warning">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                      </svg>
                    )}
                  </button>
                  );
                })}
                {/* View full screen — opens the LOB Data experience in a standalone new tab
                    (as it would render inside a Salesforce builder canvas). */}
                {selectedTab === 'submission-lines' && (
                  <button
                    onClick={() => window.open(`${ASSET_PREFIX}/submission-lines/${id}?lobFullScreen=1`, '_blank')}
                    title="Open the LOB Data experience full screen in a new tab"
                    style={{
                      marginLeft: 'auto',
                      alignSelf: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: '1px solid #0176D3',
                      background: 'white',
                      color: '#0176D3',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                    </svg>
                    View full screen
                  </button>
                )}
              </div>
              )}

              {/* Communication Content - Gmail-like 2-column layout with vertical tabs */}
              {selectedTab === 'communication' && (() => {
                const selectedEmail = emailThreads.find(e => e.id === selectedEmailId);
                const channelName = submission?.name ? `#${submission.name.toLowerCase().replace(/\s+/g, '-')}` : '#submission';
                // Treat all emails as a single thread (oldest first for chronological display)
                const threadMessages = [...emailThreads].reverse();
                const latestMessage = emailThreads[0];
                const threadSubject = (latestMessage?.subject || '').replace(/^Re:\s*/i, '');
                const threadParticipants = Array.from(
                  new Set(emailThreads.map((e) => e.from))
                );
                const isMessageExpanded = (msgId: string) => {
                  // Latest message expanded by default; others collapsed unless user toggled
                  if (expandedEmailIds.has(msgId)) return true;
                  if (expandedEmailIds.has(`!${msgId}`)) return false;
                  return msgId === latestMessage?.id;
                };
                const toggleMessage = (msgId: string) => {
                  const wasExpanded = isMessageExpanded(msgId);
                  // Opening a collapsed tile marks it as read.
                  if (!wasExpanded) {
                    setReadEmailIds((prev) => {
                      if (prev.has(msgId)) return prev;
                      const next = new Set(prev);
                      next.add(msgId);
                      return next;
                    });
                  }
                  setExpandedEmailIds((prev) => {
                    const next = new Set(prev);
                    next.delete(msgId);
                    next.delete(`!${msgId}`);
                    if (wasExpanded) {
                      next.add(`!${msgId}`);
                    } else {
                      next.add(msgId);
                    }
                    return next;
                  });
                };

                // Per-message overflow menu (rendered beside the timestamp).
                const renderMessageMenu = (msg: any) => (
                  <div style={{ position: 'relative', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <Button
                      assistiveText={{ icon: 'More actions' }}
                      iconCategory="utility"
                      iconName="down"
                      iconVariant="border-filled"
                      variant="icon"
                      title="More actions"
                      onClick={(e: any) => { e.stopPropagation(); setMessageMenuId(messageMenuId === msg.id ? null : msg.id); }}
                    />
                    {messageMenuId === msg.id && (
                      <>
                        <div onClick={(e) => { e.stopPropagation(); setMessageMenuId(null); }} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', backgroundColor: 'white', border: '1px solid #e5e5e5', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.16)', zIndex: 20, minWidth: '190px', padding: '4px 0' }}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); setMoveToSubmission({ messageId: msg.id, subject: msg.subject || threadSubject }); setMessageMenuId(null); setMoveSubmissionQuery(''); setMoveSubmissionId(null); }}
                            style={{ display: 'flex', alignItems: 'center', width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: '13px', color: '#001e5b', textAlign: 'left' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            Move To Submission
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );

                // Left thread-list panel is hidden (kept in code); flip to bring it back.
                const showThreadPanel = false;

                return (
                  <div style={{ display: 'flex', flex: 1 }}>
                    {/* Left Column - Single Thread Card (only for email) — hidden via showThreadPanel */}
                    {showThreadPanel && selectedCommTab === 'email' && latestMessage && (
                      <div style={{
                        width: '320px',
                        borderRight: '1px solid #e5e5e5',
                        flexShrink: 0
                      }}>
                        <div
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #e5e5e5',
                            cursor: 'pointer',
                            backgroundColor: '#f3f3f3'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            {/* Avatar */}
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: '#E0E5EE',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#001e5b',
                              flexShrink: 0
                            }}>
                              {latestMessage.fromInitials}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Header row - participants + count + date */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                <span style={{
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: '#001e5b',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                  marginRight: '8px'
                                }}>
                                  {threadParticipants.join(', ')}
                                  {threadMessages.length > 1 && (
                                    <span style={{ color: '#5c5c5c', fontWeight: 400 }}>
                                      {' '}({threadMessages.length})
                                    </span>
                                  )}
                                </span>
                                <span style={{
                                  fontSize: '11px',
                                  color: '#5c5c5c',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {latestMessage.date}
                                </span>
                              </div>

                              {/* Subject */}
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#001e5b',
                                marginBottom: '4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {threadSubject}
                              </div>

                              {/* Preview - latest message */}
                              <div style={{
                                fontSize: '12px',
                                color: '#5c5c5c',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                {threadMessages.some((m) => m.hasAttachment) && (
                                  <svg style={{ width: '14px', height: '14px', fill: '#5c5c5c', flexShrink: 0 }} viewBox="0 0 24 24">
                                    <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                                  </svg>
                                )}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {latestMessage.preview}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Right Column - Thread View (Gmail-style collapsible messages) */}
                    {selectedCommTab === 'email' && latestMessage && (
                      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                        {/* Thread Subject */}
                        <div style={{
                          fontSize: '20px',
                          fontWeight: 400,
                          color: '#2e2e2e',
                          marginBottom: '16px',
                          paddingBottom: '12px',
                          borderBottom: '1px solid #e5e5e5'
                        }}>
                          {threadSubject}
                          <span style={{ fontSize: '13px', color: '#5c5c5c', marginLeft: '8px' }}>
                            ({threadMessages.length})
                          </span>
                        </div>

                        {/* Thread Messages (oldest first, latest at bottom) */}
                        {threadMessages.map((msg, idx) => {
                          const expanded = isMessageExpanded(msg.id);
                          const isRead = msg.sent || readEmailIds.has(msg.id);
                          return (
                            <div
                              key={msg.id}
                              style={{
                                border: '1px solid #e5e5e5',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                backgroundColor: 'white',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Collapsible Header */}
                              <div
                                onClick={() => toggleMessage(msg.id)}
                                style={{
                                  display: 'flex',
                                  gap: '12px',
                                  padding: '12px 16px',
                                  cursor: 'pointer',
                                  alignItems: 'center',
                                  backgroundColor: (expanded || isRead) ? '#f3f3f3' : 'white',
                                  borderBottom: expanded ? '1px solid #e5e5e5' : 'none'
                                }}
                              >
                                {/* Avatar */}
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: '#E0E5EE',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#001e5b',
                                  flexShrink: 0
                                }}>
                                  {msg.fromInitials}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {expanded ? (
                                    <>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#001e5b' }}>
                                          {msg.from}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                          <span style={{ fontSize: '12px', color: '#5c5c5c' }}>
                                            {msg.date} · {msg.fullDate}
                                          </span>
                                          {renderMessageMenu(msg)}
                                        </div>
                                      </div>
                                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#2e2e2e', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {msg.subject || threadSubject}
                                      </div>
                                      <div style={{ fontSize: '12px', color: '#5c5c5c' }}>
                                        to {msg.to}
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: isRead ? 400 : 700, color: '#001e5b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {msg.from}
                                        </div>
                                        <div style={{ fontSize: '13px', fontWeight: isRead ? 400 : 700, color: '#2e2e2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {msg.subject || threadSubject}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#5c5c5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {msg.preview}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                        <span style={{ fontSize: '12px', color: '#5c5c5c', whiteSpace: 'nowrap' }}>
                                          {msg.date}
                                        </span>
                                        {renderMessageMenu(msg)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Expanded Body */}
                              {expanded && (
                                <div style={{ padding: '16px 16px 16px 60px' }}>
                                  {/* Body */}
                                  <div style={{
                                    fontSize: '13px',
                                    color: '#2e2e2e',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '18px',
                                    marginBottom: '12px'
                                  }}>
                                    {msg.body}
                                  </div>

                                  {/* Attachments */}
                                  {msg.attachments && msg.attachments.length > 0 && (
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                      {msg.attachments.map((attachment, index) => (
                                        <div
                                          key={index}
                                          style={{
                                            backgroundColor: 'white',
                                            border: '1px solid #c9c9c9',
                                            borderRadius: '12px',
                                            padding: '4px 8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            height: '26px'
                                          }}
                                        >
                                          <svg style={{ width: '14px', height: '14px', fill: '#001e5b' }} viewBox="0 0 52 52">
                                            <path d="M43.1 19.7l-12-12c-.3-.3-.7-.4-1.1-.4H13c-1.1 0-2 .9-2 2v33c0 1.1.9 2 2 2h26c1.1 0 2-.9 2-2V20.8c0-.4-.2-.8-.5-1.1zM32 11.4l7.6 7.6H32v-7.6z"/>
                                          </svg>
                                          {attachment}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Action buttons - only on the latest message */}
                                  {idx === threadMessages.length - 1 && (
                                    <div style={{ display: 'flex', gap: '24px' }}>
                                      <button className="slds-button slds-button_neutral" style={{ fontSize: '13px', padding: '4px 0', border: 'none', background: 'none', color: '#0250d9' }}>Reply</button>
                                      <button className="slds-button slds-button_neutral" style={{ fontSize: '13px', padding: '4px 0', border: 'none', background: 'none', color: '#0250d9' }}>Reply All</button>
                                      <button className="slds-button slds-button_neutral" style={{ fontSize: '13px', padding: '4px 0', border: 'none', background: 'none', color: '#0250d9' }}>Forward</button>
                                      <button className="slds-button slds-button_neutral" style={{ fontSize: '13px', padding: '4px 0', border: 'none', background: 'none', color: '#0250d9' }}>Comment</button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Slack - Full width channel view */}
                    {selectedCommTab === 'slack' && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'white' }}>
                        {/* Channel Header */}
                        <div style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #e5e5e5',
                          backgroundColor: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <Icon
                            assistiveText={{ label: 'Channel' }}
                            category="utility"
                            name="slack"
                            size="x-small"
                          />
                          <span style={{ fontSize: '16px', fontWeight: 700, color: '#001e5b' }}>
                            {channelName}
                          </span>
                          <span style={{ fontSize: '13px', color: '#5c5c5c', marginLeft: '8px' }}>
                            {slackMessages.length} messages
                          </span>
                        </div>

                        {/* Messages Area */}
                        <div style={{
                          flex: 1,
                          padding: '16px',
                          backgroundColor: 'white'
                        }}>
                          {slackMessages.map((message, index) => {
                            const showDateDivider = index === 0 || slackMessages[index - 1].date !== message.date;

                            return (
                              <React.Fragment key={message.id}>
                                {/* Date Divider */}
                                {showDateDivider && (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    margin: '16px 0',
                                    gap: '12px'
                                  }}>
                                    <div style={{
                                      flex: 1,
                                      height: '1px',
                                      backgroundColor: '#e5e5e5'
                                    }}/>
                                    <span style={{
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      color: '#001e5b',
                                      padding: '2px 8px',
                                      border: '1px solid #e5e5e5',
                                      borderRadius: '16px',
                                      backgroundColor: 'white'
                                    }}>
                                      {message.date}
                                    </span>
                                    <div style={{
                                      flex: 1,
                                      height: '1px',
                                      backgroundColor: '#e5e5e5'
                                    }}/>
                                  </div>
                                )}

                                {/* Message */}
                                <div style={{
                                  display: 'flex',
                                  gap: '12px',
                                  marginBottom: '12px',
                                  padding: '8px',
                                  borderRadius: '4px',
                                  transition: 'background-color 0.1s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fafafa';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}>
                                  {/* Avatar */}
                                  <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '4px',
                                    backgroundColor: '#E0E5EE',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#001e5b',
                                    flexShrink: 0
                                  }}>
                                    {message.senderInitials}
                                  </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* Sender and time */}
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#001e5b' }}>
                                        {message.sender}
                                      </span>
                                      <span style={{ fontSize: '12px', color: '#5c5c5c' }}>
                                        {message.time}
                                      </span>
                                    </div>

                                    {/* Message text */}
                                    <div style={{
                                      fontSize: '15px',
                                      color: '#1d1c1d',
                                      lineHeight: '1.5',
                                      wordBreak: 'break-word'
                                    }}>
                                      {message.text}
                                    </div>

                                    {/* Reactions */}
                                    {message.reactions.length > 0 && (
                                      <div style={{
                                        display: 'flex',
                                        gap: '6px',
                                        marginTop: '6px',
                                        flexWrap: 'wrap'
                                      }}>
                                        {message.reactions.map((reaction, idx) => (
                                          <div
                                            key={idx}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              padding: '2px 8px',
                                              border: '1px solid #c9c9c9',
                                              borderRadius: '12px',
                                              backgroundColor: 'white',
                                              fontSize: '13px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            <span>{reaction.emoji}</span>
                                            <span style={{ fontSize: '12px', color: '#5c5c5c', fontWeight: 600 }}>
                                              {reaction.count}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>

                        {/* Message Input */}
                        <div style={{
                          padding: '16px',
                          borderTop: '1px solid #e5e5e5',
                          backgroundColor: 'white'
                        }}>
                          <div style={{
                            border: '1px solid #c9c9c9',
                            borderRadius: '8px',
                            padding: '12px',
                            backgroundColor: 'white'
                          }}>
                            <input
                              type="text"
                              placeholder={`Message ${channelName}`}
                              style={{
                                width: '100%',
                                border: 'none',
                                outline: 'none',
                                fontSize: '15px',
                                color: '#001e5b',
                                fontFamily: 'inherit'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Submission Lines Content — extracted to a shared component so the Submission
                  record page's "Lines of business" tab can render the identical experience. */}
              {selectedTab === 'submission-lines' && line && (
                <SubmissionLinesContainer
                  submissionId={line.insuranceSubmissionId}
                  lobFilter={line.lineOfBusiness}
                  showResolutionCards
                  lineStep={lineStep}
                  vsStandalone={vsStandalone}
                  setVsStandalone={setVsStandalone}
                />
              )}

              {/* Product Mapping Tab — product-fit scoring & bundle attribute mapping */}
              {selectedTab === 'product-mapping' && line && (
                <ProductMappingContainer
                  submissionId={line.insuranceSubmissionId}
                  lob={line.lineOfBusiness}
                />
              )}

              {/* Details Tab Content - Submission Line Fields */}
              {selectedTab === 'details' && (
                <div style={{ padding: '16px' }}>
                  {/* Line Information Section */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: '#f3f3f3',
                      borderBottom: '1px solid #e5e5e5',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#001e5b'
                    }}>
                      Line Information
                    </div>
                    <div style={{ backgroundColor: 'white', padding: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <EditableField fieldName="name" label="Line Name" value={line.name} />
                        <EditableField fieldName="lineType" label="Line Type" value={line.lineType} />
                        <EditableField fieldName="lineOfBusiness" label="Line of Business" value={line.lineOfBusiness} />
                        <EditableField fieldName="status" label="Status" value={line.status} />
                        <EditableField fieldName="owner" label="Owner" value={line.owner || ''} />
                        <EditableField fieldName="parentRecord" label="Parent Record" value={parentRecordName(line)} isLink />
                      </div>
                    </div>
                  </div>

                  {/* Financial Information Section */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: '#f3f3f3',
                      borderBottom: '1px solid #e5e5e5',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#001e5b'
                    }}>
                      Financial Information
                    </div>
                    <div style={{ backgroundColor: 'white', padding: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <EditableField fieldName="insuredValue" label="Insured Value" value={line.insuredValue || 0} type="number" />
                        <EditableField fieldName="coverageLimit" label="Coverage Limit" value={line.coverageLimit || 0} type="number" />
                        <EditableField fieldName="deductible" label="Deductible" value={line.deductible || 0} type="number" />
                        <EditableField fieldName="premiumAllocation" label="Premium Allocation" value={line.premiumAllocation || 0} type="number" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Documents Content - Two panel layout */}
              {/* Documents Content - Two panel layout */}
              {selectedTab === 'documents' && (() => {
                const selectedDocument = documents.find(d => d.id === selectedDocumentId);

                // Helper function to get file icon name from file extension
                const getFileIcon = (fileName: string) => {
                  const extension = fileName.split('.').pop()?.toLowerCase();
                  switch (extension) {
                    case 'pdf':
                      return 'pdf';
                    case 'xls':
                    case 'xlsx':
                      return 'excel';
                    case 'doc':
                    case 'docx':
                      return 'word';
                    case 'ppt':
                    case 'pptx':
                      return 'ppt';
                    case 'zip':
                      return 'zip';
                    case 'jpg':
                    case 'jpeg':
                    case 'png':
                    case 'gif':
                      return 'image';
                    default:
                      return 'attachment';
                  }
                };

                return (
                  <div style={{ display: 'flex', flex: 1 }}>
                    {/* Left Column - Documents List */}
                    <div style={{
                      width: '380px',
                      borderRight: '1px solid #e5e5e5',
                      flexShrink: 0,
                      backgroundColor: 'white'
                    }}>
                      {/* Upload Button */}
                      <div style={{
                        padding: '16px',
                        borderBottom: '1px solid #e5e5e5',
                        backgroundColor: 'white'
                      }}>
                        <Button
                          label="Upload Documents"
                          iconCategory="utility"
                          iconName="upload"
                          iconPosition="left"
                          variant="brand"
                          style={{ width: '100%' }}
                        />
                      </div>

                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedDocumentId(doc.id)}
                          style={{
                            padding: '16px',
                            borderBottom: '1px solid #e5e5e5',
                            cursor: 'pointer',
                            backgroundColor: selectedDocumentId === doc.id ? '#f3f3f3' : 'white',
                            transition: 'background-color 0.1s'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedDocumentId !== doc.id) {
                              e.currentTarget.style.backgroundColor = '#fafafa';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedDocumentId !== doc.id) {
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            {/* Document Icon */}
                            <div style={{
                              flexShrink: 0
                            }}>
                              <Icon
                                assistiveText={{ label: doc.name }}
                                category="doctype"
                                name={getFileIcon(doc.name)}
                                size="medium"
                              />
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Document name */}
                              <div style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#001e5b',
                                marginBottom: '4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {doc.name}
                              </div>

                              {/* Document type */}
                              <div style={{
                                fontSize: '12px',
                                color: '#5c5c5c',
                                marginBottom: '6px'
                              }}>
                                {doc.type} • {doc.pageCount} pages
                              </div>

                              {/* Status badge - semantic light fill + dark border (Extraction Complete badge suppressed in list; only the in-progress / pending / failed states are surfaced here) */}
                              {doc.status !== 'Extraction Complete' && doc.status !== 'Analyzed' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                  {(() => {
                                    const isInProgress = doc.status === 'Extraction in Progress' || doc.status === 'Classification in Progress';
                                    const isPending = doc.status === 'Pending Analysis';
                                    let bg = '#fef5e8', border = '#B85C00', color = '#B85C00';
                                    if (isInProgress || isPending) { bg = '#f3f3f3'; border = '#5c5c5c'; color = '#3a3a3a'; }
                                    return (
                                      <span style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        lineHeight: '14px',
                                        backgroundColor: bg,
                                        color: color,
                                        border: `1px solid ${border}`
                                      }}>
                                        {doc.status}
                                      </span>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Meta info */}
                              <div style={{
                                fontSize: '11px',
                                color: '#5c5c5c'
                              }}>
                                {doc.uploadDate} • {doc.uploadedBy} • {doc.size}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Right Column - Document Insights */}
                    <div style={{ flex: 1, padding: '20px', backgroundColor: 'white' }}>
                      {selectedDocument && (
                        <div>
                          {/* Document Header */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            paddingBottom: '16px',
                            borderBottom: '1px solid #e5e5e5',
                            marginBottom: '20px'
                          }}>
                            <Icon
                              assistiveText={{ label: selectedDocument.name }}
                              category="doctype"
                              name={getFileIcon(selectedDocument.name)}
                              size="small"
                            />
                            <div style={{ flex: 1 }}>
                              <h2 style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                color: '#001e5b',
                                margin: 0,
                                marginBottom: '4px'
                              }}>
                                {selectedDocument.name}
                              </h2>
                              <div style={{ fontSize: '13px', color: '#5c5c5c' }}>
                                {selectedDocument.type} • {selectedDocument.pageCount} pages • {selectedDocument.size}
                              </div>
                            </div>
                            <ButtonGroup variant="list">
                              {[
                                <Button key="view" label="View" variant="neutral" />,
                                <Button key="classify-extract" label="Classify and Extract" variant="neutral" onClick={() => setClassifyDocumentId(selectedDocument.id)} />,
                              ].filter(Boolean)}
                            </ButtonGroup>
                          </div>

                          {/* Document Information + Extractions (UnderwritingSubmissionDocument / ...DocumentSection) */}
                          {(() => {
                            const exReqs: any[] = (selectedDocument as any).extractionRequests || [];
                            const clsStatus = selectedDocument.status === 'Unable to Classify' ? 'Needs Manual'
                              : selectedDocument.status === 'Classification in Progress' ? 'In Progress'
                              : (exReqs.length > 0 || selectedDocument.status === 'Analyzed' || selectedDocument.status === 'Extraction in Progress') ? 'Done'
                              : 'Not Started';
                            const extStatus = exReqs.some((r: any) => r.status === 'Failed') ? 'Error'
                              : (exReqs.length > 0 && exReqs.every((r: any) => r.status === 'Complete')) ? 'Done'
                              : (exReqs.some((r: any) => r.status === 'In Progress') || selectedDocument.status === 'Extraction in Progress') ? 'In Progress'
                              : 'Not Started';
                            const statusPill = (text: string) => {
                              let bg = '#f3f3f3', border = '#5c5c5c', color = '#3a3a3a';
                              if (text === 'Done') { bg = '#e7f5ec'; border = '#2E844A'; color = '#1a4f2c'; }
                              else if (text === 'Error') { bg = '#fdecea'; border = '#c23934'; color = '#7a1f1f'; }
                              else if (text === 'Needs Manual') { bg = '#fef5e8'; border = '#B85C00'; color = '#8a4500'; }
                              return (
                                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', lineHeight: '14px', backgroundColor: bg, color, border: `1px solid ${border}` }}>{text}</span>
                              );
                            };
                            const infoField = (label: string, value: React.ReactNode) => (
                              <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>{label}</div>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>{value}</div>
                              </div>
                            );
                            const classificationRequestId = `CLR-${String(selectedDocument.id).replace(/\D/g, '') || '0'}`;
                            return (
                              <>
                                {/* Document Information */}
                                <div style={{ marginBottom: '24px' }}>
                                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b', marginBottom: '12px' }}>
                                    Document Information
                                  </h3>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      {infoField('Underwriting Submission', <span style={{ color: '#0176D3' }}>{submission?.name || '—'}</span>)}
                                      {infoField('Classification Status', statusPill(clsStatus))}
                                      {infoField('Extraction Status', statusPill(extStatus))}
                                      {infoField('Content Document', selectedDocument.name)}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      {infoField('Content Document Version', 'v1')}
                                      {infoField('Email Message', <span style={{ color: '#0176D3' }}>{`Submission Email — ${(selectedDocument as any).uploadedBy || 'Broker'}`}</span>)}
                                      {infoField('Classification Request ID', classificationRequestId)}
                                    </div>
                                  </div>
                                </div>

                                {/* Extractions — one section row per completed extraction request */}
                                {exReqs.length > 0 && clsStatus === 'Done' && (
                                  <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b', marginBottom: '12px' }}>
                                      Extractions
                                    </h3>
                                    <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr 0.9fr 0.7fr 1.3fr',
                                        padding: '10px 12px',
                                        backgroundColor: '#f3f3f3',
                                        borderBottom: '1px solid #e5e5e5',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: '#5c5c5c'
                                      }}>
                                        <span>Document Category</span>
                                        <span>Document Type</span>
                                        <span>Location</span>
                                        <span>Confidence</span>
                                        <span>Extraction Template / Agent</span>
                                      </div>
                                      {exReqs.map((req: any, idx: number) => {
                                        const t: string = req.type || '';
                                        const documentCategory = req.documentCategory
                                          || (/property|commercial application|general liability|business auto/i.test(t) ? 'ACORD' : 'Other');
                                        const documentType = req.documentType
                                          || (/commercial application/i.test(t) ? 'ACORD 125'
                                            : /property/i.test(t) ? 'ACORD 140'
                                            : /general liability/i.test(t) ? 'ACORD 126'
                                            : /business auto/i.test(t) ? 'ACORD 129'
                                            : t);
                                        const pages = (selectedDocument as any).pageCount || exReqs.length;
                                        const seg = Math.max(1, Math.floor(pages / exReqs.length));
                                        const startIndex = idx * seg + 1;
                                        const endIndex = idx === exReqs.length - 1 ? pages : (idx + 1) * seg;
                                        const confidence = [98, 96, 94, 92, 90][idx] ?? 90;
                                        return (
                                          <div
                                            key={req.id}
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: '1fr 1fr 0.9fr 0.7fr 1.3fr',
                                              padding: '10px 12px',
                                              borderBottom: idx < exReqs.length - 1 ? '1px solid #e5e5e5' : 'none',
                                              backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                                              alignItems: 'center'
                                            }}
                                          >
                                            <span style={{ fontSize: '13px', color: '#001e5b' }}>{documentCategory}</span>
                                            <span style={{ fontSize: '13px', color: '#001e5b' }}>{documentType}</span>
                                            <span style={{ fontSize: '13px', color: '#5c5c5c' }}>{`Pages ${startIndex}–${endIndex}`}</span>
                                            <span style={{ fontSize: '13px', color: '#2E844A', fontWeight: 600 }}>{`${confidence}%`}</span>
                                            <span style={{ fontSize: '13px', color: '#5c5c5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${documentType} Extraction Template`}>{`${documentType} Extraction Template`}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* Unable to classify - manual classification required (shown above the summary) */}
                          {selectedDocument.status === 'Unable to Classify' && (
                            <div style={{
                              textAlign: 'center',
                              padding: '48px 24px',
                              backgroundColor: '#fef5e8',
                              border: '1px solid #f5d9a8',
                              borderRadius: '8px',
                              marginBottom: '24px'
                            }}>
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="#B85C00" style={{ marginBottom: '12px' }}>
                                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                              </svg>
                              <h3 style={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#B85C00',
                                marginBottom: '8px'
                              }}>
                                Unable to Classify
                              </h3>
                              <p style={{
                                fontSize: '13px',
                                color: '#5c5c5c',
                                margin: '0 0 16px 0'
                              }}>
                                The system could not automatically identify the forms in this document. Please classify it manually to continue extraction.
                              </p>
                              <button
                                onClick={() => setClassifyDocumentId(selectedDocument.id)}
                                style={{
                                  padding: '8px 24px',
                                  border: 'none',
                                  borderRadius: '4px',
                                  backgroundColor: '#0176D3',
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Classify
                              </button>
                            </div>
                          )}

                          {/* AI Summary — static overview, shown as soon as the document arrives (no box) */}
                          <div style={{ marginBottom: '24px' }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px'
                            }}>
                              <Icon
                                assistiveText={{ label: 'AI Insights' }}
                                category="utility"
                                name="sparkles"
                                size="x-small"
                              />
                              <h3 style={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#001e5b',
                                margin: 0
                              }}>
                                AI Summary
                              </h3>
                            </div>
                            <p style={{
                              fontSize: '14px',
                              color: '#2e2e2e',
                              lineHeight: '1.5',
                              margin: 0
                            }}>
                              {STATIC_DOCUMENT_SUMMARIES[selectedDocument.id] || DEFAULT_DOCUMENT_SUMMARY}
                            </p>
                          </div>

                          {((selectedDocument.status === 'Pending Analysis' || selectedDocument.status === 'Extraction in Progress') && !selectedDocument.insights.summary && selectedDocument.insights.keyFindings.length === 0 && selectedDocument.insights.extractedData.length === 0) ? (
                            // Pending/In Progress state — only when no prior insights exist
                            <div style={{
                              textAlign: 'center',
                              padding: '48px 24px',
                              backgroundColor: '#fafafa',
                              borderRadius: '8px'
                            }}>
                              <Icon
                                assistiveText={{ label: 'Analyzing' }}
                                category="utility"
                                name="clock"
                                size="large"
                                style={{ marginBottom: '16px' }}
                              />
                              <h3 style={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#001e5b',
                                marginBottom: '8px'
                              }}>
                                {selectedDocument.status === 'Extraction in Progress'
                                  ? 'Extraction in Progress'
                                  : 'Analysis Pending'}
                              </h3>
                              <p style={{
                                fontSize: '13px',
                                color: '#5c5c5c',
                                margin: 0
                              }}>
                                {selectedDocument.status === 'Extraction in Progress'
                                  ? 'AI agent is currently extracting data from this document. Insights will be available once extraction is complete.'
                                  : 'AI agent will analyze this document shortly. You\'ll be notified when insights are ready.'}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {selectedTab !== 'communication' && selectedTab !== 'submission-lines' && selectedTab !== 'details' && selectedTab !== 'documents' && (
                <div style={{ padding: '48px', textAlign: 'center', color: '#706E6B' }}>
                  No {selectedTab.replace('-', ' ')} to display
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Save/Cancel footer — pinned to the viewport bottom (position:fixed) so it stays visible
            while scrolling, width-matched to the right content column, and clamped to that column's
            bottom edge once it scrolls into view. Shown only with unsaved Details edits. */}
        {detailIsDirty && detailFooterMetrics && (
          <div style={{ position: 'fixed', left: detailFooterMetrics.left, width: detailFooterMetrics.width, bottom: detailFooterMetrics.bottom, boxSizing: 'border-box', padding: '12px 24px', backgroundColor: '#fafaf9', borderTop: '1px solid #dddbda', boxShadow: '0 -2px 6px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', zIndex: 20 }}>
            <span style={{ position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#5c5c5c' }}>You have unsaved changes.</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={cancelDetailDirty} style={{ padding: '6px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', background: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDetailDirty} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        )}

        {/* Save Toast Notification */}
        {showSaveToast && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#032D60',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 10000,
            animation: 'slideIn 0.3s ease-out'
          }}>
            <svg style={{ width: '16px', height: '16px', fill: '#4BCA81' }} viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Changes saved</span>
          </div>
        )}

        <style jsx>{`
          @keyframes slideIn {
            from {
              transform: translateY(100px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>

        {/* Submission Line Step Controller — walks the local enrichment lifecycle
            (independent of the global demo step, which stays capped at 9). */}
        {!lobFullScreen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#032D60',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10000,
          }}
        >
          {/* Reset demo state — clears all merges, attribute edits, source picks, and reconciliations */}
          <button
            onClick={() => {
              if (!confirm('Reset all demo resolution state? This clears any merges, attribute edits, source picks, and reconciliations and restores the original mock data.')) return;
              try {
                sessionStorage.removeItem('lobDataResolutionSession');
                Object.keys(sessionStorage)
                  .filter((k) => k.startsWith('submissionLine_'))
                  .forEach((k) => sessionStorage.removeItem(k));
              } catch {
                // ignore
              }
              window.location.reload();
            }}
            aria-label="Reset Demo State"
            title="Reset demo state — clears all merges, attribute edits, source picks, and reconciliations"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          {/* Divider */}
          <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.2)' }} />

          {/* Previous */}
          <button
            onClick={() => setLineStep((s) => Math.max(1, s - 1))}
            disabled={lineStep <= 1}
            title="Previous line step"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: lineStep <= 1 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.2)',
              color: lineStep <= 1 ? 'rgba(255,255,255,0.35)' : 'white',
              cursor: lineStep <= 1 ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ‹
          </button>

          {/* Step Counter */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '80px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: '#C9C9C9',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '2px',
              }}
            >
              Line Step
            </span>
            <span
              style={{
                fontSize: '18px',
                color: 'white',
                fontWeight: 700,
              }}
            >
              {lineStep}
            </span>
          </div>

          {/* Next */}
          <button
            onClick={() => setLineStep((s) => Math.min(TOTAL_LINE_STEPS, s + 1))}
            disabled={lineStep >= TOTAL_LINE_STEPS}
            title="Next line step"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: lineStep >= TOTAL_LINE_STEPS ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.2)',
              color: lineStep >= TOTAL_LINE_STEPS ? 'rgba(255,255,255,0.35)' : 'white',
              cursor: lineStep >= TOTAL_LINE_STEPS ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ›
          </button>
        </div>
        )}

        {/* Agent Activity Panel */}
        {showAgentActivity && selectedAgentTask && (
          <AgentActivityPanel
            taskName={selectedAgentTask.title}
            steps={selectedAgentTask.agentSteps}
            onClose={() => setShowAgentActivity(false)}
          />
        )}

        {/* New Task Modal */}
        <NewTaskModal
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          onSave={(task) => setUserCreatedTasks((prev) => [task, ...prev])}
        />

        {/* Classify Document Modal */}
        {(() => {
          const doc = documents.find((d: any) => d.id === classifyDocumentId);
          const existingExtractionsByName: Record<string, { documentCategory: string; documentType: string; location: string; status: string }[]> = {};
          if (doc) {
            const exReqs: any[] = (doc as any).extractionRequests || [];
            const pages = (doc as any).pageCount || exReqs.length;
            const seg = Math.max(1, Math.floor(pages / Math.max(1, exReqs.length)));
            const rows = exReqs.map((req: any, idx: number) => {
              const t: string = req.type || '';
              const documentCategory = req.documentCategory
                || (/property|commercial application|general liability|business auto/i.test(t) ? 'ACORD' : 'Other');
              const documentType = req.documentType
                || (/commercial application/i.test(t) ? 'ACORD 125'
                  : /property/i.test(t) ? 'ACORD 140'
                  : /general liability/i.test(t) ? 'ACORD 126'
                  : /business auto/i.test(t) ? 'ACORD 129'
                  : t);
              const startIndex = idx * seg + 1;
              const endIndex = idx === exReqs.length - 1 ? pages : (idx + 1) * seg;
              return { documentCategory, documentType, location: `Pages ${startIndex}–${endIndex}`, status: req.status };
            });
            if (rows.length > 0) existingExtractionsByName[doc.name] = rows;
          }
          return (
            <ClassifyDocumentModal
              isOpen={!!classifyDocumentId}
              documentNames={[doc?.name || 'Document']}
              existingExtractionsByName={existingExtractionsByName}
              onClose={() => setClassifyDocumentId(null)}
            />
          );
        })()}

        {/* Email Composer Modal */}
        {(() => {
          const task = pendingTasks.find((t: any) => t.id === emailComposerTaskId);
          if (!task) return null;
          const insuredName = submission?.insuredName || 'the insured';
          const submissionId = submission?.id || submission?.name || '';
          const brokerName = submission?.broker || 'Niki Paoloni';
          const brokerEmail = submission?.brokerEmail || 'npaoloni@vanguardins.com';
          const subject = `FEIN Needed — ${insuredName}${submissionId ? ` (${submissionId})` : ''}`;
          const body = `Hi ${brokerName.split(' ')[0]},

Thanks for sending over the new business submission for ${insuredName}. We have started the Data Completion Check and noticed the FEIN (Federal Employer Identification Number) is not on the submission.

Could you please reply with the FEIN for ${insuredName}? We need it to continue the qualifying checks and move the submission forward.

Let me know if you have any questions.

Best regards,
Martha
Underwriting Team Lead`;
          return (
            <EmailComposerModal
              isOpen={true}
              onClose={() => setEmailComposerTaskId(null)}
              defaultTo={`${brokerName} <${brokerEmail}>`}
              defaultSubject={subject}
              defaultBody={body}
              onSend={(email) => console.log('Sending email', email)}
            />
          );
        })()}

        {/* Extracted Data — status popover (shared by the record panel + View Sources modal) */}
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

        {/* Save Toast Notification */}
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

        {/* Move To Submission modal — reassign a message to a different submission */}
        {moveToSubmission && (() => {
          const closeMove = () => { setMoveToSubmission(null); setMoveSubmissionQuery(''); setMoveSubmissionId(null); };
          const newOption = {
            id: '__new__',
            label: 'New Submission',
            subTitle: 'Create a new submission',
            icon: <Icon category="utility" name="add" size="x-small" style={{ fill: '#0176D3' }} />,
          };
          const comboOptions = [
            newOption,
            ...MOVE_SUBMISSION_OPTIONS.map((o) => ({
              id: o.id,
              label: o.name,
              subTitle: `${o.account} · ${o.stage}`,
              icon: <Icon category="standard" name="account" size="small" />,
            })),
          ];
          const filtered = comboOptions.filter((o) =>
            o.id === '__new__' ||
            o.label.toLowerCase().includes(moveSubmissionQuery.toLowerCase()) ||
            o.subTitle.toLowerCase().includes(moveSubmissionQuery.toLowerCase())
          );
          const selection = moveSubmissionId
            ? comboOptions.filter((o) => o.id === moveSubmissionId)
            : [];
          return (
            <div
              onClick={closeMove}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ backgroundColor: 'white', borderRadius: '8px', width: '520px', maxWidth: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.24)' }}
              >
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#001e5b', margin: 0 }}>Move To Submission</h2>
                  <button onClick={closeMove} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                    <Icon category="utility" name="close" size="small" style={{ fill: '#5c5c5c' }} />
                  </button>
                </div>
                {/* Body */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', minHeight: '260px' }}>
                  <p style={{ fontSize: '13px', color: '#5c5c5c', margin: '0 0 16px 0' }}>
                    Move &ldquo;{moveToSubmission.subject}&rdquo; to another submission.
                  </p>
                  <Combobox
                    id="move-to-submission-lookup"
                    labels={{ label: 'Submission', placeholder: 'Search submissions...' }}
                    variant="inline-listbox"
                    events={{
                      onChange: (_event: any, data: any) => { setMoveSubmissionQuery(data.value); if (moveSubmissionId) setMoveSubmissionId(null); },
                      onSelect: (_event: any, data: any) => { setMoveSubmissionId(data.selection[0]?.id ?? null); setMoveSubmissionQuery(''); },
                      onRequestRemoveSelectedOption: () => { setMoveSubmissionId(null); setMoveSubmissionQuery(''); },
                    }}
                    options={filtered}
                    selection={selection}
                    value={moveSubmissionQuery}
                    hasInputSpinner={false}
                    menuPosition="relative"
                  />
                </div>
                {/* Footer */}
                <div style={{ padding: '12px 24px', backgroundColor: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button onClick={closeMove} style={{ padding: '8px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', backgroundColor: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={closeMove}
                    disabled={!moveSubmissionId}
                    style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: moveSubmissionId ? '#0176D3' : '#c9c9c9', color: 'white', fontSize: '13px', fontWeight: 600, cursor: moveSubmissionId ? 'pointer' : 'not-allowed' }}
                  >
                    Move
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Discard-changes guard — fires when leaving with unsaved Details edits. */}
        {detailPendingNav && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '420px', maxWidth: '90vw', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.24)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#B85C00"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#001e5b' }}>Discard unsaved changes?</h2>
              </div>
              <div style={{ padding: '20px 24px', fontSize: '13px', color: '#2e2e2e', lineHeight: '19px' }}>
                You have unsaved edits on this record. Leaving now will discard them.
              </div>
              <div style={{ padding: '12px 24px', backgroundColor: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setDetailPendingNav(null)} style={{ padding: '6px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', background: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Keep editing</button>
                <button onClick={() => { const act = detailPendingNav; cancelDetailDirty(); setDetailPendingNav(null); act && act(); }} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Discard changes</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </IconSettings>
  );
}

// Static export needs every dynamic route pre-rendered. The page reads `id` from
// router.query on the client, so props are empty — we only enumerate the paths.
export async function getStaticPaths() {
  return {
    paths: mockSubmissionLines.map((l) => ({ params: { id: l.id } })),
    fallback: false,
  };
}

export async function getStaticProps() {
  return { props: {} };
}
