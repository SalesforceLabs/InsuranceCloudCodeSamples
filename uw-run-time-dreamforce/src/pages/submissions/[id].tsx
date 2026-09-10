import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Button,
  ButtonGroup,
  Combobox,
  Icon,
  IconSettings
} from '@salesforce/design-system-react';
import GlobalHeader from '@/components/Navigation/GlobalHeader';
import { mockSubmissions } from '@/data/mockSubmissions';
import { mockSubmissionLines, applyLineOverrides, computeQuoteTotalForLob } from '@/data/mockSubmissionLines';
import { mockEmailThreads, mockSlackMessages } from '@/data/mockCommunicationData';
import { mockDocuments } from '@/data/mockDocumentsData';
import PendingTask from '@/components/Tasks/PendingTask';
import NewTaskModal, { NewTaskInput } from '@/components/Tasks/NewTaskModal';
import ActivityLog from '@/components/Activity/ActivityLog';
import ActivityItem, { ActivityItemProps } from '@/components/Activity/ActivityItem';
import { DemoFlowController } from '@/components/DemoFlowController';
import { useDemoFlow } from '@/contexts/DemoFlowContext';
import { AgentActivityPanel } from '@/components/AgentActivityPanel';
import EmailComposerModal from '@/components/Email/EmailComposerModal';
import ClassifyDocumentModal from '@/components/Documents/ClassifyDocumentModal';
import SubmissionLinesContainer from '@/components/SubmissionLines/SubmissionLinesContainer';
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

// Lines of business that can be quoted, each with its mapped rating product and
// the underlying data LOB (mockSubmissionLines `lineOfBusiness`). Drives the
// Generate Quote modal's multiselect table; the quote total is priced from the
// submission-line hierarchy (see computeQuoteTotalForLob), not hard-coded.
const QUOTE_LOB_OPTIONS: { lob: string; dataLob: string; product: string }[] = [
  { lob: 'Commercial Property', dataLob: 'Property', product: 'Commercial Property Policy' },
  { lob: 'General Liability', dataLob: 'General Liability', product: 'Commercial General Liability Policy' },
];

// ---------------------------------------------------------------------------
// Submission Information panel — a self-contained reproduction of the LOB
// submission-line detail panel's Attributes / Extracted Data tabs (search,
// source/status filters, view-source, override, expand/collapse). Backed by
// its own dummy attribute + extraction data; no shared state with the LOB page.
// ---------------------------------------------------------------------------
const SI_CONFIDENCE_THRESHOLD = 90;

function SiConfidenceBadge({ score }: { score: number }) {
  if (score >= SI_CONFIDENCE_THRESHOLD) return null;
  return (
    <span
      title={`Low Extraction Confidence (${score}%)`}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      <Icon category="utility" name="document_preview" size="xx-small" style={{ fill: '#B85C00' }} />
    </span>
  );
}

type SiPoolItem = {
  itemId: string;
  attrKey: string;
  field: string;
  term: string; // canonical term ('' = unmapped)
  category: string;
  value: string;
  source: string;
  confidence: number;
};

// Ordered canonical categories → terms (drives the Attributes tab sections).
const SI_CATEGORIES: Array<{ category: string; terms: string[] }> = [
  { category: 'Account Information', terms: ['Legal Entity Name', 'Doing Business As', 'Tax ID (FEIN)', 'Website URL', 'Entity Structure'] },
  { category: 'Business Details', terms: ['NAICS Code', 'SIC Code', 'Year Established', 'Annual Revenue', 'Employee Count'] },
  { category: 'Contact Information', terms: ['Mailing Street Address', 'City', 'State', 'ZIP Code', 'Primary Contact Name', 'Phone Number', 'Email Address'] },
];

// Dummy extractions. Multiple candidates per attribute across sources exercises
// the [+N] source stacking, low-confidence badges and the source picker.
const SI_POOL_SEED: SiPoolItem[] = [
  // --- Account Information ---
  { itemId: 'i1', attrKey: 'legalName', field: 'Legal Business Name', term: 'Legal Entity Name', category: 'Account Information', value: 'NexGen Biologics Inc', source: 'ACORD 125', confidence: 98 },
  { itemId: 'i2', attrKey: 'legalName', field: 'Named Insured', term: 'Legal Entity Name', category: 'Account Information', value: 'NexGen Biologics, Inc.', source: 'Broker Email', confidence: 94 },
  { itemId: 'i3', attrKey: 'dba', field: 'DBA', term: 'Doing Business As', category: 'Account Information', value: 'NexGen Bio', source: 'ACORD 125', confidence: 88 },
  { itemId: 'i4', attrKey: 'fein', field: 'FEIN', term: 'Tax ID (FEIN)', category: 'Account Information', value: '47-2938471', source: 'ACORD 125', confidence: 96 },
  { itemId: 'i5', attrKey: 'website', field: 'Website', term: 'Website URL', category: 'Account Information', value: 'www.nexgenbio.com', source: 'Broker Email', confidence: 91 },
  { itemId: 'i6', attrKey: 'entity', field: 'Entity Type', term: 'Entity Structure', category: 'Account Information', value: 'Corporation', source: 'Dun & Bradstreet', confidence: 85 },
  // --- Business Details ---
  { itemId: 'i7', attrKey: 'naics', field: 'NAICS', term: 'NAICS Code', category: 'Business Details', value: '325412', source: 'ACORD 125', confidence: 97 },
  { itemId: 'i8', attrKey: 'naics', field: 'NAICS Code', term: 'NAICS Code', category: 'Business Details', value: '325412 — Pharmaceutical Preparation Mfg', source: 'Dun & Bradstreet', confidence: 90 },
  { itemId: 'i9', attrKey: 'sic', field: 'SIC', term: 'SIC Code', category: 'Business Details', value: '2834', source: 'Dun & Bradstreet', confidence: 82 },
  { itemId: 'i10', attrKey: 'yearEst', field: 'Year Established', term: 'Year Established', category: 'Business Details', value: '2014', source: 'ACORD 125', confidence: 93 },
  { itemId: 'i11', attrKey: 'revenue', field: 'Annual Revenue', term: 'Annual Revenue', category: 'Business Details', value: '$47.2M', source: 'Broker Email', confidence: 89 },
  { itemId: 'i12', attrKey: 'revenue', field: 'Gross Revenue', term: 'Annual Revenue', category: 'Business Details', value: '$47,200,000', source: 'Dun & Bradstreet', confidence: 87 },
  { itemId: 'i13', attrKey: 'employees', field: 'Employees', term: 'Employee Count', category: 'Business Details', value: '148', source: 'ACORD 125', confidence: 92 },
  // --- Contact Information ---
  { itemId: 'i14', attrKey: 'address', field: 'Mailing Address', term: 'Mailing Street Address', category: 'Contact Information', value: '1450 W Fulton St', source: 'ACORD 125', confidence: 95 },
  { itemId: 'i14b', attrKey: 'address', field: 'Street Address', term: 'Mailing Street Address', category: 'Contact Information', value: '1450 W Fulton St', source: 'Statement of Values', confidence: 92 },
  { itemId: 'i15', attrKey: 'city', field: 'City', term: 'City', category: 'Contact Information', value: 'Chicago', source: 'ACORD 125', confidence: 96 },
  { itemId: 'i15b', attrKey: 'city', field: 'City', term: 'City', category: 'Contact Information', value: 'Chicago', source: 'Statement of Values', confidence: 90 },
  { itemId: 'i16', attrKey: 'state', field: 'State', term: 'State', category: 'Contact Information', value: 'IL', source: 'ACORD 125', confidence: 96 },
  { itemId: 'i17', attrKey: 'zip', field: 'ZIP', term: 'ZIP Code', category: 'Contact Information', value: '60607', source: 'ACORD 125', confidence: 94 },
  { itemId: 'i17b', attrKey: 'zip', field: 'ZIP', term: 'ZIP Code', category: 'Contact Information', value: '60607', source: 'Statement of Values', confidence: 89 },
  { itemId: 'i18', attrKey: 'zip', field: 'Postal Code', term: 'ZIP Code', category: 'Contact Information', value: '60612', source: 'Broker Email', confidence: 78 },
  { itemId: 'i19', attrKey: 'contact', field: 'Contact Name', term: 'Primary Contact Name', category: 'Contact Information', value: 'Niki Paoloni', source: 'Broker Email', confidence: 93 },
  { itemId: 'i20', attrKey: 'phone', field: 'Phone', term: 'Phone Number', category: 'Contact Information', value: '(312) 555-0142', source: 'Broker Email', confidence: 90 },
  { itemId: 'i21', attrKey: 'email', field: 'Email', term: 'Email Address', category: 'Contact Information', value: 'niki@vanguardins.com', source: 'Broker Email', confidence: 91 },
  // --- Unmapped extractions (no canonical term) ---
  { itemId: 'i22', attrKey: 'dnbNum', field: 'D-U-N-S Number', term: '', category: '', value: '08-146-3729', source: 'Dun & Bradstreet', confidence: 84 },
  { itemId: 'i23', attrKey: 'creditScore', field: 'Credit Score', term: '', category: '', value: 'Low Risk (82)', source: 'Dun & Bradstreet', confidence: 80 },
  { itemId: 'i24', attrKey: 'brokerRef', field: 'Broker Reference', term: '', category: '', value: 'VIP-2026-0417', source: 'Broker Email', confidence: 88 },
];

// Mock source documents rendered in the View Source modal. Keys are source names.
const SI_DOC_SOURCES = ['ACORD 125', 'Broker Email', 'Dun & Bradstreet'];

function SubmissionInfoPanel({ onDirtyChange, canonicalOnly = false }: { onDirtyChange?: (dirty: boolean, cancel: () => void) => void; canonicalOnly?: boolean }) {
  const [infoTab, setInfoTab] = useState<'attributes' | 'extracted'>('attributes');

  // Attributes-tab filters
  const [attrSearch, setAttrSearch] = useState('');
  const [attrSourceFilter, setAttrSourceFilter] = useState<Set<string>>(new Set());
  const [attrSourceMenuOpen, setAttrSourceMenuOpen] = useState(false);
  const [attrUnmappedOnly, setAttrUnmappedOnly] = useState(false);
  const [catOpen, setCatOpen] = useState<Set<string>>(new Set(SI_CATEGORIES.map((c) => c.category)));

  // Extracted-Data-tab filters
  const [extSearch, setExtSearch] = useState('');
  const [extSourceFilter, setExtSourceFilter] = useState<Set<string>>(new Set());
  const [extSourceMenuOpen, setExtSourceMenuOpen] = useState(false);
  const [extStatusFilter, setExtStatusFilter] = useState<Set<string>>(new Set());
  const [extStatusMenuOpen, setExtStatusMenuOpen] = useState(false);

  // Shared row state
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  // Preferred pool item per term (defaults to the first mapped item; '__manual__' = manual value).
  const [termPref, setTermPref] = useState<Record<string, string>>({});
  // Manual value entered per term (used when termPref[term] === '__manual__').
  const [termManual, setTermManual] = useState<Record<string, string>>({});
  const [editingManual, setEditingManual] = useState<string | null>(null);
  // Pool items returned to the unmapped pool from a term box.
  const [unmapped, setUnmapped] = useState<Set<string>>(new Set());

  // ── Explicit-save (dirty-state) model ── edits still apply live but register here so the
  // cell shows the SLDS dirty-yellow fill and a sticky Save/Cancel footer appears. Save accepts
  // the live values; Cancel runs each cell's revert closure. Mirrors SubmissionLinesContainer.
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const dirtyReverts = useRef<Record<string, () => void>>({});
  const isDirty = dirtyCells.size > 0;
  const markDirty = (cellKey: string, revert: () => void) => {
    if (!dirtyReverts.current[cellKey]) dirtyReverts.current[cellKey] = revert;
    setDirtyCells((prev) => { if (prev.has(cellKey)) return prev; const next = new Set(prev); next.add(cellKey); return next; });
  };
  const saveDirty = () => { dirtyReverts.current = {}; setDirtyCells(new Set()); };
  const cancelDirty = () => {
    Object.values(dirtyReverts.current).forEach((fn) => { try { fn(); } catch { /* best-effort */ } });
    dirtyReverts.current = {};
    setDirtyCells(new Set());
  };
  // Nav-away guard: switching the inner Attributes/Extracted tab with unsaved edits confirms first.
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);
  const guardNav = (action: () => void) => { if (isDirty) setPendingNavAction(() => action); else action(); };
  useEffect(() => { onDirtyChange?.(isDirty, cancelDirty); }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fixed Save/Cancel footer aligned to the scroll pane — matches the LOB Data behavior:
  // match the pane's horizontal extent, pin to the viewport bottom, and clamp to the pane's
  // bottom edge when it scrolls into view.
  const scrollPaneRef = useRef<HTMLDivElement | null>(null);
  const [footerMetrics, setFooterMetrics] = useState<{ left: number; width: number; bottom: number } | null>(null);
  useEffect(() => {
    if (!isDirty) { setFooterMetrics(null); return; }
    const measure = () => {
      const el = scrollPaneRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const bottom = Math.max(0, window.innerHeight - r.bottom);
      setFooterMetrics({ left: r.left, width: r.width, bottom });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [isDirty, infoTab]);

  // View Source modal — scoped to one pool item (drives the term box + doc pane).
  const [sourceModal, setSourceModal] = useState<{ itemId: string; activeSource: string } | null>(null);
  // Doc-canvas zoom (0.5x–2x) for the Select Source viewer; reset when the modal closes.
  const [siDocZoom, setSiDocZoom] = useState(1);
  // When a manual-value row is clicked, the doc canvas swaps to a light-grey
  // "manually updated" message instead of a source document. False = show docs.
  const [siManualActive, setSiManualActive] = useState(false);

  const pool = SI_POOL_SEED;
  const allSources = SI_DOC_SOURCES;
  const allStatuses = ['Selected', 'Associated', 'Unassociated'];

  const displayValue = (it: SiPoolItem) => overrides[it.itemId] || it.value;

  // Mapped items grouped by term (items returned to the pool are excluded); preferred = termPref override or first.
  const itemsByTerm = new Map<string, SiPoolItem[]>();
  pool.forEach((it) => {
    if (!it.term || unmapped.has(it.itemId)) return;
    if (!itemsByTerm.has(it.term)) itemsByTerm.set(it.term, []);
    itemsByTerm.get(it.term)!.push(it);
  });
  const preferredItem = (term: string): SiPoolItem | null => {
    const items = itemsByTerm.get(term) || [];
    if (termPref[term] === '__manual__') return null;
    if (items.length === 0) return null;
    const prefId = termPref[term];
    return items.find((it) => it.itemId === prefId) || items[0];
  };
  const termManualValue = (term: string): string =>
    termPref[term] === '__manual__' ? (termManual[term] || '') : '';
  const termHasData = (term: string) => (itemsByTerm.get(term) || []).length > 0 || !!termManualValue(term);
  const commitManual = (term: string, raw: string) => {
    const v = raw.trim();
    if ((termManual[term] || '') !== v) {
      const beforeManual = termManual[term];
      const beforePref = termPref[term];
      markDirty(`man:${term}`, () => {
        setTermManual((p) => { const n = { ...p }; if (beforeManual === undefined) delete n[term]; else n[term] = beforeManual; return n; });
        setTermPref((p) => { const n = { ...p }; if (beforePref === undefined) delete n[term]; else n[term] = beforePref; return n; });
      });
    }
    setTermManual((prev) => { const next = { ...prev }; if (v) next[term] = v; else delete next[term]; return next; });
    setTermPref((prev) => { const next = { ...prev }; if (v) next[term] = '__manual__'; else if (next[term] === '__manual__') delete next[term]; return next; });
    setEditingManual(null);
  };
  // SLDS dirty-cell fill for edited cells (light-yellow wash + amber left rule).
  const SI_DIRTY_STYLE: React.CSSProperties = { backgroundColor: '#fdf6e3', boxShadow: 'inset 3px 0 0 #B85C00', borderRadius: '2px' };
  // Active-edit cell (white fill + thin border, pencil anchored right) and the row-dim wash
  // applied to sibling read-only cells so focus lands on the editable one (see EDIT_CELL_STYLE).
  const SI_EDIT_CELL_STYLE: React.CSSProperties = { backgroundColor: '#ffffff', boxShadow: 'inset 0 0 0 1px #c9c9c9', borderRadius: '2px' };
  const SI_ROW_DIM_STYLE: React.CSSProperties = { backgroundColor: '#f3f3f3' };
  // Override-cell commit/clear with dirty tracking (shared by the Attributes + Extracted tabs).
  const commitOverrideSI = (itemId: string, raw: string) => {
    const v = raw.trim();
    if ((overrides[itemId] || '') !== v) {
      const before = overrides[itemId];
      markDirty(`ov:${itemId}`, () => setOverrides((p) => { const n = { ...p }; if (before === undefined) delete n[itemId]; else n[itemId] = before; return n; }));
    }
    setOverrides((prev) => { const next = { ...prev }; if (v) next[itemId] = v; else delete next[itemId]; return next; });
    setEditingRow(null);
  };
  const clearOverrideSI = (itemId: string) => {
    if (overrides[itemId] !== undefined) {
      const before = overrides[itemId];
      markDirty(`ov:${itemId}`, () => setOverrides((p) => ({ ...p, [itemId]: before })));
    }
    setOverrides((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
  };
  // Shared inline-edit Override cell — mirrors SubmissionLinesContainer's renderOverrideCell
  // (SLDS-style: hover pencil on empty, plain text + edit/clear on hover when set).
  const renderOverrideCellSI = (itemId: string) => {
    const override = overrides[itemId] || '';
    if (editingRow === itemId) {
      return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            autoFocus
            defaultValue={override}
            placeholder="Enter override value"
            onBlur={(e) => commitOverrideSI(itemId, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
              else if (e.key === 'Escape') { setEditingRow(null); }
            }}
            style={{ flex: 1, minWidth: 0, padding: '4px 26px 4px 6px', fontSize: '12px', border: '1px solid #0176D3', borderRadius: '4px', boxSizing: 'border-box', color: '#2e2e2e' }}
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); clearOverrideSI(itemId); setEditingRow(null); }}
            title="Clear override"
            aria-label="Clear override"
            style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#5c5c5c', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>
      );
    }
    const isHover = hoverRow === itemId;
    if (override) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, width: '100%' }}>
          <span
            onClick={(e) => { e.stopPropagation(); setEditingRow(itemId); }}
            title={override}
            style={{ flex: 1, cursor: 'text', color: '#2e2e2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {override}
          </span>
          {isHover && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearOverrideSI(itemId); }}
              title="Clear override"
              aria-label="Clear override"
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#5c5c5c', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditingRow(itemId); }}
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
        onClick={(e) => { e.stopPropagation(); setEditingRow(itemId); }}
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

  // Status of a pool item: preferred-for-term = Selected; other mapped = Associated; unmapped = Unassociated.
  const itemStatus = (it: SiPoolItem): string => {
    if (!it.term || unmapped.has(it.itemId)) return 'Unassociated';
    const pref = preferredItem(it.term);
    return pref && pref.itemId === it.itemId ? 'Selected' : 'Associated';
  };

  const openSource = (it: SiPoolItem) => {
    { setSiManualActive(false); setSourceModal({ itemId: it.itemId, activeSource: it.source }); }
  };
  // Open the source modal scoped to a canonical term (used by the Manual / Select-source
  // buttons in the Attributes tab). Falls back to the term's first mapped extraction.
  const openTerm = (term: string) => {
    const it = preferredItem(term) || (itemsByTerm.get(term) || [])[0];
    if (it) { setSiManualActive(false); setSourceModal({ itemId: it.itemId, activeSource: it.source }); }
  };

  // Highlight a value inside mock document text.
  const renderDocText = (text: string, highlight: string) => {
    if (!highlight) return text;
    const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ backgroundColor: '#fff1c2', border: '1px solid #d9a441', borderRadius: '2px', padding: '0 1px' }}>
          {text.slice(idx, idx + highlight.length)}
        </mark>
        {text.slice(idx + highlight.length)}
      </>
    );
  };

  // File-type of a Select-Source doc, driving which chrome the canvas renders.
  const siFileType = (src: string): 'pdf' | 'doc' | 'xls' => {
    if (src === 'Statement of Values') return 'xls';
    if (src === 'Broker Email') return 'doc';
    return 'pdf';
  };

  // Statement of Values — mock SOV spreadsheet; the cell matching `highlight` gets an amber fill.
  // Statement of Values — mock SOV rendered like a real spreadsheet (Google-Sheets-style):
  // lettered column headers, a row-number gutter, many columns/rows, its own horizontal +
  // vertical scroll. The cell matching `highlight` gets an amber fill.
  const siSovDoc = (highlight: string) => {
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
    const cellMatches = (v: string) => {
      if (!hl || !v) return false;
      const cv = v.trim().toLowerCase();
      if (cv === hl) return true;
      return cv.length >= 2 && (hl.includes(cv) || cv.includes(hl));
    };
    const z = siDocZoom;
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
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#217346', color: 'white', fontSize: '12px', fontWeight: 600 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" /></svg>
          NexGen_Statement_of_Values.xlsx
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', backgroundColor: '#fbfbfb' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: `${GUT}px` }} />
              {Array.from({ length: totalCols }).map((_, c) => (<col key={`sicol-${c}`} style={{ width: `${colW(c)}px` }} />))}
            </colgroup>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, height: `${headH}px`, backgroundColor: '#e6e6e6', border: '1px solid #d0d0d0' }} />
                {Array.from({ length: totalCols }).map((_, c) => (
                  <th key={`sich-${c}`} style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: headBg, border: '1px solid #d0d0d0', fontSize: `${hfs}px`, fontWeight: 600, color: '#5c5c5c', textAlign: 'center', height: `${headH}px` }}>{colLetter(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: totalRows }).map((_, r) => (
                <tr key={`sisov-r-${r}`}>
                  <th style={{ position: 'sticky', left: 0, zIndex: 1, backgroundColor: headBg, border: '1px solid #d0d0d0', fontSize: `${hfs}px`, fontWeight: 600, color: '#5c5c5c', textAlign: 'center' }}>{r + 1}</th>
                  {Array.from({ length: totalCols }).map((_, c) => {
                    const v = gridVal(r, c);
                    const isHeaderRow = r === 0;
                    const match = !isHeaderRow && cellMatches(v);
                    return (
                      <td key={`sisov-${r}-${c}`} title={v || undefined} style={{
                        border: '1px solid #e2e2e2', padding: `${padV}px ${padH}px`, fontSize: `${fs}px`,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1a1a1a',
                        fontWeight: isHeaderRow ? 700 : 400,
                        backgroundColor: match ? '#ffe28a' : (isHeaderRow ? '#eef3ef' : 'white'),
                        boxShadow: match ? 'inset 0 0 0 2px #8a6d00' : 'none',
                      }}>{v}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 8px', backgroundColor: '#f1f1f1', borderTop: '1px solid #c9c9c9' }}>
          <div style={{ padding: '3px 12px', fontSize: '11px', fontWeight: 600, color: '#217346', backgroundColor: 'white', border: '1px solid #c9c9c9', borderBottom: 'none', borderRadius: '2px 2px 0 0' }}>Locations</div>
          <div style={{ padding: '3px 12px', fontSize: '11px', color: '#939393' }}>Summary</div>
        </div>
      </div>
    );
  };

  // ---- shared filter UI helpers ----
  const renderSearch = (value: string, onChange: (v: string) => void, placeholder: string) => (
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

  const renderFilterMenu = (
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
    open: boolean,
    setOpen: React.Dispatch<React.SetStateAction<boolean>>,
    label: string,
    options: string[],
  ) => (
    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '13px', fontWeight: 600,
          border: '1px solid #c9c9c9', borderRadius: '4px', backgroundColor: selected.size > 0 ? '#e8f1fb' : 'white',
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
              position: 'absolute', top: '100%', right: 0, marginTop: '4px', minWidth: '200px', maxHeight: '260px', overflowY: 'auto',
              backgroundColor: 'white', border: '1px solid #c9c9c9', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 10001, padding: '4px 0',
            }}
          >
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', border: 'none', background: 'none', color: '#0176D3', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
              >
                Clear all
              </button>
            )}
            {options.map((opt) => (
              <label
                key={opt}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', fontSize: '13px', color: '#2e2e2e', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(opt)}
                  onChange={() => setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(opt)) next.delete(opt); else next.add(opt);
                    return next;
                  })}
                  style={{ margin: 0, cursor: 'pointer' }}
                />
                {opt}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const pillSchemes = {
    source: { color: '#001e5b', backgroundColor: '#e8f1fb', border: '1px solid #cfe0ff', close: '#0176D3' },
    status: { color: '#0b6b4f', backgroundColor: '#e3f5ec', border: '1px solid #bfe6d3', close: '#0b6b4f' },
  };
  const renderPill = (label: string, onRemove: () => void, scheme: typeof pillSchemes.source) => (
    <span
      key={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 6px 3px 10px', fontSize: '12px', fontWeight: 600, color: scheme.color, backgroundColor: scheme.backgroundColor, border: scheme.border, borderRadius: '12px' }}
    >
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: scheme.close, display: 'inline-flex', alignItems: 'center' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
      </button>
    </span>
  );

  // ---- Attributes tab computed ----
  const attrQuery = attrSearch.trim().toLowerCase();
  const termMatches = (term: string): boolean => {
    const items = itemsByTerm.get(term) || [];
    if (attrUnmappedOnly && termHasData(term)) return false;
    if (attrSourceFilter.size > 0 && !items.some((it) => attrSourceFilter.has(it.source))) return false;
    if (attrQuery) {
      const hay = [term, ...items.map((it) => `${it.field} ${displayValue(it)} ${it.source}`)].join(' ').toLowerCase();
      if (!hay.includes(attrQuery)) return false;
    }
    return true;
  };
  const attrFiltersActive = !!attrQuery || attrSourceFilter.size > 0 || attrUnmappedOnly;
  let visibleSections = SI_CATEGORIES.map((s) => ({ category: s.category, terms: s.terms }));
  if (attrFiltersActive) {
    visibleSections = visibleSections
      .map((s) => ({ category: s.category, terms: s.terms.filter(termMatches) }))
      .filter((s) => s.terms.length > 0);
  }
  const isCatOpen = (category: string) => (attrFiltersActive ? true : catOpen.has(category));
  const toggleCat = (category: string) => setCatOpen((prev) => {
    const next = new Set(prev);
    if (next.has(category)) next.delete(category); else next.add(category);
    return next;
  });
  const expandAll = () => setCatOpen(new Set(SI_CATEGORIES.map((c) => c.category)));
  const collapseAll = () => setCatOpen(new Set());

  // ---- Extracted Data tab computed ----
  const extQuery = extSearch.trim().toLowerCase();
  const extFiltered = pool.filter((it) => {
    if (extSourceFilter.size > 0 && !extSourceFilter.has(it.source)) return false;
    if (extStatusFilter.size > 0 && !extStatusFilter.has(itemStatus(it))) return false;
    if (extQuery) {
      const hay = `${it.field} ${displayValue(it)} ${it.source}`.toLowerCase();
      if (!hay.includes(extQuery)) return false;
    }
    return true;
  }).sort((a, b) => a.field.localeCompare(b.field) || a.source.localeCompare(b.source));

  const GRID = '1.2fr 1fr 0.9fr 1fr 116px';

  // ---- Attribute-mapping discrepancies (drives the Resolve Attribute Mapping card) ----
  // A mapped canonical term is a discrepancy when it needs a source picked (2+ candidates
  // with no explicit choice) or its preferred value is below the confidence threshold and
  // has no override. Selecting a source, entering a manual value, or adding an override clears it.
  const isDiscrepancyTerm = (term: string): boolean => {
    const items = itemsByTerm.get(term) || [];
    if (items.length === 0) return false;
    if (termPref[term] === '__manual__') return false;
    const explicitPick = !!termPref[term];
    if (items.length >= 2 && !explicitPick) return true;
    const pref = preferredItem(term);
    if (pref && !overrides[pref.itemId] && pref.confidence < SI_CONFIDENCE_THRESHOLD) return true;
    return false;
  };
  const discrepancyTerms = SI_CATEGORIES.flatMap((s) => s.terms).filter(isDiscrepancyTerm);
  const openResolveMapping = () => {
    const first = discrepancyTerms[0];
    if (!first) return;
    const it = preferredItem(first) || (itemsByTerm.get(first) || [])[0];
    if (it) { setSiManualActive(false); setSourceModal({ itemId: it.itemId, activeSource: it.source }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div ref={scrollPaneRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: isDirty ? '72px' : '16px' }}>
        {/* Resolve Attribute Mapping card — mirrors the LOB Data tab resolution card. */}
        {!canonicalOnly && discrepancyTerms.length > 0 && (
          <div style={{ display: 'flex', marginBottom: '12px' }}>
            <div
              className="slds-card"
              style={{
                width: '50%',
                marginTop: 0,
                marginBottom: 0,
                borderRadius: '12px',
                boxShadow: 'none',
                border: '1px solid #dddbda',
                display: 'flex',
                flexDirection: 'column',
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
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0176D3', margin: 0, lineHeight: '20px' }}>
                      Resolve Attribute Mapping
                    </h3>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#5c3a00', backgroundColor: '#fef5e8', border: '1px solid #f5b87c', padding: '2px 8px', borderRadius: '10px', lineHeight: '14px' }}>
                    {discrepancyTerms.length}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#5c5c5c', lineHeight: '17px', marginBottom: 0, flex: 1 }}>
                  Select sources for conflicting values and map attributes to canonical terms
                </div>
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={openResolveMapping}
                    style={{ padding: 0, border: 'none', background: 'none', color: '#0176D3', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inner tabs: Attributes / Extracted Data */}
        <div style={{ borderBottom: '1px solid #e5e5e5', display: 'flex', gap: 0, marginBottom: '12px' }}>
          {([
            { key: 'attributes' as const, label: 'Attributes' },
            { key: 'extracted' as const, label: `Extracted Data (${canonicalOnly ? 0 : pool.length})` },
          ]).map((t) => {
            const isActive = infoTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => guardNav(() => setInfoTab(t.key))}
                style={{
                  padding: '8px 12px', border: 'none', background: 'none', fontSize: '13px',
                  fontWeight: isActive ? 600 : 400, color: isActive ? '#0176D3' : '#706E6B',
                  borderBottom: isActive ? '2px solid #0176D3' : '2px solid transparent', marginBottom: '-1px', cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ===================== ATTRIBUTES TAB ===================== */}
        {infoTab === 'attributes' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              {renderSearch(attrSearch, setAttrSearch, 'Search attributes')}
              {!canonicalOnly && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2e2e2e', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={attrUnmappedOnly} onChange={(e) => setAttrUnmappedOnly(e.target.checked)} style={{ cursor: 'pointer', margin: 0 }} />
                  Show unmapped only
                </label>
              )}
              {!canonicalOnly && renderFilterMenu(attrSourceFilter, setAttrSourceFilter, attrSourceMenuOpen, setAttrSourceMenuOpen, 'Source', allSources)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {attrSourceFilter.size > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {Array.from(attrSourceFilter).map((src) =>
                      renderPill(src, () => setAttrSourceFilter((prev) => { const next = new Set(prev); next.delete(src); return next; }), pillSchemes.source)
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                <a href="#" onClick={(e) => { e.preventDefault(); expandAll(); }} style={{ fontSize: '13px', color: '#0176D3', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Expand all</a>
                <a href="#" onClick={(e) => { e.preventDefault(); collapseAll(); }} style={{ fontSize: '13px', color: '#0176D3', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Collapse all</a>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {visibleSections.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '13px', color: '#5c5c5c', border: '1px solid #e5e5e5', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                  {attrFiltersActive ? 'No attributes match the current filters.' : 'No attributes mapped.'}
                </div>
              ) : visibleSections.map((section) => {
                const dataCount = section.terms.filter(termHasData).length;
                const open = isCatOpen(section.category);
                return (
                  <div key={section.category} style={{ border: '1px solid #e5e5e5', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      onClick={() => toggleCat(section.category)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fafafa', border: 'none', borderBottom: open ? '1px solid #e5e5e5' : 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#0176D3" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                        </svg>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>{section.category}</span>
                        {!canonicalOnly && <span style={{ fontSize: '11px', color: '#706E6B' }}>· {dataCount} of {section.terms.length} mapped</span>}
                      </span>
                    </button>
                    {open && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', backgroundColor: '#f3f3f3', borderBottom: '1px solid #c9c9c9', fontSize: '12px', fontWeight: 600, color: '#5c5c5c' }}>
                          <div style={{ padding: '10px 12px' }}>Canonical Term</div>
                          <div style={{ padding: '10px 12px' }}>Attribute</div>
                          <div style={{ padding: '10px 12px' }}>Value</div>
                          <div style={{ padding: '10px 12px' }}>Source</div>
                        </div>
                        {section.terms.map((term, idx) => {
                          const preferred = preferredItem(term);
                          const mappedCount = (itemsByTerm.get(term) || []).length;
                          const isManual = termPref[term] === '__manual__';
                          const isLast = idx === section.terms.length - 1;
                          const isEditingValue = editingManual === term;
                          const editSeed = preferred ? displayValue(preferred) : termManualValue(term);
                          const manualRowKey = `man:${term}`;
                          const manualEditActive = hoverRow === manualRowKey || isEditingValue;
                          return (
                            <div key={term} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderBottom: isLast ? 'none' : '1px solid #e5e5e5', fontSize: '13px', backgroundColor: 'white' }}>
                              <div style={{ padding: '10px 12px', color: '#2e2e2e', ...(manualEditActive ? SI_ROW_DIM_STYLE : {}) }}>{term}</div>
                              {canonicalOnly ? (
                                <>
                                  <div style={{ padding: '10px 12px', color: '#c9c9c9' }}>—</div>
                                  <div style={{ padding: '10px 12px', color: '#c9c9c9' }}>—</div>
                                  <div style={{ padding: '10px 12px', color: '#c9c9c9' }}>—</div>
                                </>
                              ) : (
                              <>
                              {/* Attribute — blank for a manual value */}
                              <div style={{ padding: '10px 12px', color: isManual ? '#939393' : '#001e5b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(manualEditActive ? SI_ROW_DIM_STYLE : {}) }}>
                                {isManual ? '—' : (preferred ? preferred.field : '—')}
                              </div>
                              {/* Value — always inline-editable; committing text sets a manual value */}
                              <div
                                onMouseEnter={() => setHoverRow(manualRowKey)}
                                onMouseLeave={() => setHoverRow((prev) => prev === manualRowKey ? null : prev)}
                                style={{ padding: '6px 12px', color: '#2e2e2e', display: 'flex', alignItems: 'center', gap: '6px', ...(dirtyCells.has(`man:${term}`) ? SI_DIRTY_STYLE : (manualEditActive ? SI_EDIT_CELL_STYLE : {})) }}
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
                                      else if (e.key === 'Escape') { setEditingManual(null); }
                                    }}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: '13px', border: '1px solid #0176D3', borderRadius: '4px', boxSizing: 'border-box', color: '#2e2e2e' }}
                                  />
                                ) : (
                                  <>
                                    <span
                                      onClick={() => setEditingManual(term)}
                                      title="Click to enter a value"
                                      style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', color: preferred ? '#2e2e2e' : '#939393' }}
                                    >
                                      {preferred ? (displayValue(preferred) || <span style={{ color: '#939393' }}>—</span>) : (isManual ? termManualValue(term) : <span style={{ fontStyle: 'italic' }}>Add value</span>)}
                                    </span>
                                    {isManual ? null : preferred && overrides[preferred.itemId] ? (
                                      <span title="Override value" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                                        <Icon category="utility" name="product_transfer" size="xx-small" style={{ fill: '#B85C00' }} />
                                      </span>
                                    ) : preferred ? (
                                      <SiConfidenceBadge score={preferred.confidence} />
                                    ) : null}
                                    {manualEditActive && (
                                      <button
                                        type="button"
                                        onClick={() => setEditingManual(term)}
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
                              <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', ...(manualEditActive ? SI_ROW_DIM_STYLE : {}) }}>
                                {isManual ? (
                                  <button
                                    onClick={() => openTerm(term)}
                                    style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer', color: '#0176D3', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', borderRadius: '4px', width: '100%', textAlign: 'left' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  >
                                    Manual
                                    {mappedCount > 0 && <span style={{ color: '#0176D3' }}> [+{mappedCount}]</span>}
                                  </button>
                                ) : preferred ? (
                                  <button
                                    onClick={() => openSource(preferred)}
                                    style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer', color: '#0176D3', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', borderRadius: '4px', width: '100%', textAlign: 'left' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  >
                                    {preferred.source}{mappedCount > 1 && <span style={{ color: '#0176D3' }}> [+{mappedCount - 1}]</span>}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openTerm(term)}
                                    style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer', color: '#0176D3', fontSize: '13px', fontWeight: 400, fontStyle: 'italic', fontFamily: 'inherit', borderRadius: '4px', width: '100%', textAlign: 'left' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  >
                                    [Select source]
                                  </button>
                                )}
                              </div>
                              </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ===================== EXTRACTED DATA TAB ===================== */}
        {infoTab === 'extracted' && canonicalOnly && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
            <div>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="#C9C9C9" style={{ marginBottom: '16px' }}>
                <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 12H5c-.55 0-1-.45-1-1V9c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1z"/>
              </svg>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#001e5b', margin: '0 0 8px 0' }}>
                No Extracted Data Available
              </h3>
              <p style={{ fontSize: '13px', color: '#5c5c5c', margin: 0, maxWidth: '400px' }}>
                Extracted data will be available once the initial data extraction and analysis is complete.
              </p>
            </div>
          </div>
        )}
        {infoTab === 'extracted' && !canonicalOnly && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#001e5b' }}>
                Extracted Data ({extFiltered.length}{extFiltered.length !== pool.length ? ` of ${pool.length}` : ''})
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              {renderSearch(extSearch, setExtSearch, 'Search extracted data')}
              {renderFilterMenu(extSourceFilter, setExtSourceFilter, extSourceMenuOpen, setExtSourceMenuOpen, 'Source', allSources)}
              {renderFilterMenu(extStatusFilter, setExtStatusFilter, extStatusMenuOpen, setExtStatusMenuOpen, 'Status', allStatuses)}
            </div>
            {(extSourceFilter.size > 0 || extStatusFilter.size > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {Array.from(extSourceFilter).map((src) =>
                  renderPill(src, () => setExtSourceFilter((prev) => { const next = new Set(prev); next.delete(src); return next; }), pillSchemes.source)
                )}
                {Array.from(extStatusFilter).map((st) =>
                  renderPill(st, () => setExtStatusFilter((prev) => { const next = new Set(prev); next.delete(st); return next; }), pillSchemes.status)
                )}
              </div>
            )}
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', backgroundColor: '#f3f3f3', borderBottom: '1px solid #c9c9c9', fontSize: '12px', fontWeight: 600, color: '#5c5c5c' }}>
                <div style={{ padding: '10px 12px' }}>Attribute</div>
                <div style={{ padding: '10px 12px' }}>Value</div>
                <div style={{ padding: '10px 12px' }}>Source</div>
                <div style={{ padding: '10px 12px' }}>Override Value</div>
                <div style={{ padding: '10px 12px' }}>Status</div>
              </div>
              {extFiltered.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '13px', color: '#5c5c5c' }}>No extracted data matches the current filters.</div>
              ) : (
                extFiltered.map((it, idx) => {
                  const isLast = idx === extFiltered.length - 1;
                  const status = itemStatus(it);
                  const statusStyle = status === 'Selected'
                    ? { color: '#2E844A', backgroundColor: '#e7f5ec', border: '1px solid #b5e0c4' }
                    : status === 'Associated'
                      ? { color: '#0176D3', backgroundColor: '#eef4ff', border: '1px solid #c3dbf7' }
                      : { color: '#5c5c5c', backgroundColor: '#f3f3f3', border: '1px solid #dddbda' };
                  const ov = overrides[it.itemId];
                  const editActive = hoverRow === it.itemId || editingRow === it.itemId;
                  return (
                    <div key={it.itemId} style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'stretch', borderBottom: isLast ? 'none' : '1px solid #e5e5e5', fontSize: '13px', backgroundColor: 'white' }}>
                      <div title={it.field} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', color: '#001e5b', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive ? SI_ROW_DIM_STYLE : {}) }}>{it.field}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', minWidth: 0, ...(editActive ? SI_ROW_DIM_STYLE : {}) }}>
                        <span title={displayValue(it)} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#2e2e2e', opacity: ov ? 0.5 : 1 }}>
                          {it.value || <span style={{ color: '#939393' }}>—</span>}
                        </span>
                        {ov ? (
                          <span title="Override value" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                            <Icon category="utility" name="product_transfer" size="xx-small" style={{ fill: '#B85C00' }} />
                          </span>
                        ) : (
                          <SiConfidenceBadge score={it.confidence} />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', minWidth: 0, ...(editActive ? SI_ROW_DIM_STYLE : {}) }}>
                        <button
                          onClick={() => openSource(it)}
                          title={it.source}
                          style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer', color: '#0176D3', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', borderRadius: '4px', width: '100%', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {it.source}
                        </button>
                      </div>
                      <div
                        onMouseEnter={() => setHoverRow(it.itemId)}
                        onMouseLeave={() => setHoverRow((prev) => prev === it.itemId ? null : prev)}
                        style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', ...(dirtyCells.has(`ov:${it.itemId}`) ? SI_DIRTY_STYLE : (editActive ? SI_EDIT_CELL_STYLE : {})) }}
                      >
                        {renderOverrideCellSI(it.itemId)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '10px 12px', ...(editActive ? SI_ROW_DIM_STYLE : {}) }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '11px', fontSize: '11px', fontWeight: 600, ...statusStyle }}>
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

      {/* Fixed Save/Cancel footer — mirrors the LOB Data tabs: aligned to the scroll pane via
          measured metrics, pinned to the viewport bottom, and clamped to the pane's bottom
          edge once it scrolls into view so the footer rides up with the section end. */}
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
          <span style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#3e3e3c' }}>You have unsaved changes.</span>
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

      {/* Discard-changes guard — fires when leaving the tab with unsaved edits. */}
      {pendingNavAction && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '420px', maxWidth: '90vw', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.24)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#B85C00"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#001e5b' }}>Discard unsaved changes?</h2>
            </div>
            <div style={{ padding: '20px 24px', fontSize: '13px', color: '#2e2e2e', lineHeight: '19px' }}>
              You have unsaved edits on this tab. Leaving now will discard them.
            </div>
            <div style={{ padding: '12px 24px', backgroundColor: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setPendingNavAction(null)} style={{ padding: '6px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', background: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Keep editing</button>
              <button onClick={() => { const act = pendingNavAction; cancelDirty(); setPendingNavAction(null); act && act(); }} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Discard changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SELECT SOURCE MODAL ===================== */}
      {/* Mirrors the LOB / Parties single-term "Select Source" modal: vertical source
          tabs + dark doc canvas on the left, a canonical-term card on the right. */}
      {sourceModal && (() => {
        const modalItem = pool.find((p) => p.itemId === sourceModal.itemId);
        if (!modalItem) return null;
        const term = modalItem.term;
        const boxTitle = term || modalItem.field;
        const category = modalItem.category;
        // Group = all pool items mapped to the term (mapped view); a single item when unmapped.
        const groupItems = term ? (itemsByTerm.get(term) || []) : [modalItem];
        const docSources = Array.from(new Set(groupItems.map((g) => g.source)));
        const activeSource = sourceModal.activeSource;
        const activeCand = groupItems.find((g) => g.source === activeSource) || modalItem;
        const highlight = displayValue(activeCand);
        // Preferred pick for the radio group.
        const isManualPref = !!term && termPref[term] === '__manual__';
        const preferredId = isManualPref
          ? '__manual__'
          : (preferredItem(term) ? preferredItem(term)!.itemId : (groupItems[0]?.itemId || null));

        const returnToPool = (it: SiPoolItem) => {
          setUnmapped((prev) => { const next = new Set(prev); next.add(it.itemId); return next; });
          if (term) {
            setTermPref((prev) => {
              if (prev[term] !== it.itemId) return prev;
              const next = { ...prev }; delete next[term]; return next;
            });
          }
        };

        return (
        <div
          onClick={() => { setSourceModal(null); setSiDocZoom(1); setSiManualActive(false); }}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90vw', height: '88vh', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.24)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#001e5b' }}>
                Select Source
                <span style={{ fontWeight: 400, color: '#5c5c5c', marginLeft: '10px', fontSize: '15px' }}>· {boxTitle}</span>
              </h2>
              <button onClick={() => { setSourceModal(null); setSiDocZoom(1); setSiManualActive(false); }} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5c5c5c"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Left pane — vertical source tabs + dark document canvas */}
              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'row', borderRight: '1px solid #e5e5e5', minWidth: 0, minHeight: 0 }}>
                <div style={{ width: '140px', flexShrink: 0, borderRight: '1px solid #e5e5e5', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', paddingTop: '8px', overflowY: 'auto' }}>
                  {docSources.map((src) => {
                    const isActive = src === activeSource;
                    return (
                      <button
                        key={src}
                        onClick={() => setSourceModal((prev) => (prev ? { ...prev, activeSource: src } : prev))}
                        style={{ padding: '10px 12px 10px 14px', border: 'none', borderLeft: isActive ? '3px solid #0176D3' : '3px solid transparent', background: isActive ? '#eaf3fc' : 'transparent', color: '#2e2e2e', fontSize: '13px', fontWeight: isActive ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left' }}
                      >
                        {src}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                const siIsSheet = siFileType(activeSource) === 'xls';
                if (siManualActive) {
                  return (
                    <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f3f3f3', minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px' }}>
                      <div style={{ maxWidth: '340px' }}>
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="#B85C00" style={{ marginBottom: '14px' }}>
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                        </svg>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#2e2e2e', marginBottom: '8px' }}>Manually updated value</div>
                        <div style={{ fontSize: '13px', color: '#5c5c5c', lineHeight: '19px' }}>This value was entered manually, so there is no source document to preview.</div>
                      </div>
                    </div>
                  );
                }
                return (
                <div style={{ flex: 1, overflowY: siIsSheet ? 'hidden' : 'auto', padding: siIsSheet ? 0 : '24px', backgroundColor: '#525659', minHeight: 0, position: 'relative' }}>
                  {/* Zoom toolbar — floats top-right, applies to every file type */}
                  <div style={{ position: 'absolute', top: '12px', right: '18px', display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'rgba(32,33,36,0.92)', borderRadius: '6px', padding: '3px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', zIndex: 5 }}>
                    <button type="button" onClick={() => setSiDocZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} title="Zoom out" style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', borderRadius: '4px', fontSize: '18px', lineHeight: 1 }}>−</button>
                    <button type="button" onClick={() => setSiDocZoom(1)} title="Reset zoom" style={{ minWidth: '46px', height: '26px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{Math.round(siDocZoom * 100)}%</button>
                    <button type="button" onClick={() => setSiDocZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))} title="Zoom in" style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', borderRadius: '4px', fontSize: '18px', lineHeight: 1 }}>+</button>
                  </div>
                  {siIsSheet ? (
                  <div style={{ width: '100%', height: '100%' }}>{siSovDoc(highlight)}</div>
                  ) : (
                  <div style={{ transform: `scale(${siDocZoom})`, transformOrigin: 'top center', transition: 'transform 0.12s ease-out' }}>
                  <div style={{ maxWidth: '640px', margin: '0 auto', backgroundColor: 'white', border: '1px solid #d9d9d9', borderRadius: '2px', boxShadow: '0 1px 8px rgba(0,0,0,0.4)', padding: '32px', fontFamily: 'Georgia, serif', color: '#1a1a1a' }}>
                    {activeSource === 'Broker Email' ? (
                      <>
                        <div style={{ fontSize: '11px', color: '#5c5c5c', marginBottom: '16px', fontFamily: 'Arial, sans-serif' }}>
                          <div><strong>From:</strong> Niki Paoloni &lt;niki@vanguardins.com&gt;</div>
                          <div><strong>To:</strong> Martha Reyes</div>
                          <div><strong>Subject:</strong> New Business — NexGen Biologics Inc</div>
                        </div>
                        <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '16px', fontSize: '13px', lineHeight: 1.7, fontFamily: 'Arial, sans-serif' }}>
                          <p>Hi Martha,</p>
                          <p>Please find attached the application for {renderDocText('NexGen Biologics, Inc.', highlight)}, a pharmaceutical manufacturer we&apos;ve worked with for several years. Their website is {renderDocText('www.nexgenbio.com', highlight)}.</p>
                          <p>Gross revenue for the last fiscal year came in at {renderDocText('$47.2M', highlight)}. Mailing/postal code on file is {renderDocText('60612', highlight)}.</p>
                          <p>Primary contact is myself — {renderDocText('Niki Paoloni', highlight)}, {renderDocText('(312) 555-0142', highlight)}, {renderDocText('niki@vanguardins.com', highlight)}. Our internal reference is {renderDocText('VIP-2026-0417', highlight)}.</p>
                          <p>Best,<br />Niki</p>
                        </div>
                      </>
                    ) : activeSource === 'Dun & Bradstreet' ? (
                      <div style={{ fontFamily: 'Arial, sans-serif' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                          <div style={{ fontSize: '15px', fontWeight: 700 }}>Dun &amp; Bradstreet — Business Report</div>
                          <div style={{ fontSize: '10px', color: '#5c5c5c' }}>Retrieved 07/01/2026</div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <tbody>
                            <tr><td style={{ border: '1px solid #ccc', padding: '5px 8px', backgroundColor: '#f3f3f3', fontWeight: 600, width: '40%' }}>D-U-N-S Number</td><td style={{ border: '1px solid #ccc', padding: '5px 8px' }}>{renderDocText('08-146-3729', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #ccc', padding: '5px 8px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>Entity Type</td><td style={{ border: '1px solid #ccc', padding: '5px 8px' }}>{renderDocText('Corporation', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #ccc', padding: '5px 8px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>Primary NAICS</td><td style={{ border: '1px solid #ccc', padding: '5px 8px' }}>{renderDocText('325412 — Pharmaceutical Preparation Mfg', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #ccc', padding: '5px 8px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>SIC Code</td><td style={{ border: '1px solid #ccc', padding: '5px 8px' }}>{renderDocText('2834', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #ccc', padding: '5px 8px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>Annual Revenue</td><td style={{ border: '1px solid #ccc', padding: '5px 8px' }}>{renderDocText('$47,200,000', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #ccc', padding: '5px 8px', backgroundColor: '#f3f3f3', fontWeight: 600 }}>Credit Assessment</td><td style={{ border: '1px solid #ccc', padding: '5px 8px' }}>{renderDocText('Low Risk (82)', highlight)}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '8px', marginBottom: '12px' }}>
                          <div>
                            <div style={{ fontSize: '10px', letterSpacing: '0.5px', color: '#5c5c5c' }}>ACORD®</div>
                            <div style={{ fontSize: '16px', fontWeight: 700 }}>COMMERCIAL INSURANCE APPLICATION</div>
                          </div>
                          <div style={{ fontSize: '10px', textAlign: 'right' }}>
                            <div>FORM 125 (2016/03)</div>
                            <div>Page 1 of 2</div>
                          </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <tbody>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', width: '35%', fontWeight: 600 }}>NAMED INSURED</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('NexGen Biologics Inc', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>DBA</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('NexGen Bio', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>FEIN</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('47-2938471', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>MAILING ADDRESS</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('1450 W Fulton St', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>CITY</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('Chicago', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>STATE</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('IL', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>ZIP</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('60607', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>NAICS</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('325412', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>YEAR ESTABLISHED</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('2014', highlight)}</td></tr>
                            <tr><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px', backgroundColor: '#e5e5e5', fontWeight: 600 }}>NO. OF EMPLOYEES</td><td style={{ border: '1px solid #1a1a1a', padding: '4px 6px' }}>{renderDocText('148', highlight)}</td></tr>
                          </tbody>
                        </table>
                        <div style={{ marginTop: '14px', fontSize: '10px', color: '#5c5c5c', textAlign: 'center' }}>ACORD 125 (2016/03) — Page 1 of 2</div>
                      </>
                    )}
                  </div>
                  </div>
                  )}
                </div>
                );
                })()}
              </div>
              {/* Right pane — canonical-term card */}
              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                  <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', backgroundColor: 'white', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: '#f8fbfe', borderBottom: '1px solid #e5e5e5' }}>
                      <div style={{ fontWeight: 600, color: '#001e5b', fontSize: '13px' }}>{boxTitle}</div>
                      {category && (
                        <div style={{ fontSize: '11px', color: '#706E6B', fontWeight: 400, marginTop: '2px' }}>{category}</div>
                      )}
                    </div>
                    <div style={{ padding: '10px 14px 12px 14px', backgroundColor: '#fafafa' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 0.9fr 1fr 40px', padding: '7px 0', marginBottom: '2px', backgroundColor: '#efefef', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#5c5c5c' }}>
                        <div />
                        <div style={{ padding: '0 10px' }}>Attribute</div>
                        <div style={{ padding: '0 10px' }}>Value</div>
                        <div style={{ padding: '0 10px' }}>Source</div>
                        <div style={{ padding: '0 10px' }}>Override Value</div>
                        <div />
                      </div>
                      {groupItems.map((it, rowIdx) => {
                        const checked = it.itemId === preferredId;
                        const isLast = rowIdx === groupItems.length - 1;
                        const ov = overrides[it.itemId];
                        const editActive = hoverRow === it.itemId || editingRow === it.itemId;
                        return (
                          <div
                            key={`si-vsm-${it.itemId}`}
                            onClick={() => { setSiManualActive(false); setSourceModal((prev) => (prev ? { ...prev, activeSource: it.source } : prev)); }}
                            style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 0.9fr 1fr 40px', alignItems: 'stretch', borderBottom: isLast ? 'none' : '1px solid #e5e5e5', cursor: 'pointer', fontSize: '12px', color: '#2e2e2e', background: it.source === activeSource ? '#f0f8ff' : '#ffffff' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }} onClick={(e) => e.stopPropagation()}>
                              {term ? (
                                <input
                                  type="radio"
                                  name={`si-vsm-pref-${term}`}
                                  checked={checked}
                                  onChange={() => {
                                    setTermPref((prev) => ({ ...prev, [term]: it.itemId }));
                                    setSiManualActive(false);
                                    setSourceModal((prev) => (prev ? { ...prev, activeSource: it.source } : prev));
                                  }}
                                  style={{ cursor: 'pointer', margin: 0 }}
                                />
                              ) : null}
                            </div>
                            <div title={it.field} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', fontWeight: 600, color: '#001e5b', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive ? SI_ROW_DIM_STYLE : {}) }}>{it.field}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', minWidth: 0, ...(editActive ? SI_ROW_DIM_STYLE : {}) }}>
                              <span title={it.value || undefined} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#2e2e2e', opacity: ov ? 0.5 : 1 }}>{it.value || <span style={{ color: '#a0a0a0' }}>—</span>}</span>
                              <SiConfidenceBadge score={it.confidence} />
                            </div>
                            <div title={it.source || undefined} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', color: '#2e2e2e', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive ? SI_ROW_DIM_STYLE : {}) }}>{it.source}</div>
                            <div
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={() => setHoverRow(it.itemId)}
                              onMouseLeave={() => setHoverRow((prev) => prev === it.itemId ? null : prev)}
                              style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', minWidth: 0, ...(dirtyCells.has(`ov:${it.itemId}`) ? SI_DIRTY_STYLE : (editActive ? SI_EDIT_CELL_STYLE : {})) }}
                            >
                              {renderOverrideCellSI(it.itemId)}
                            </div>
                            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                              {term && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); returnToPool(it); }}
                                  title="Return to unmapped pool"
                                  aria-label="Return to unmapped pool"
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px', border: 'none', background: 'none', color: '#0176D3', cursor: 'pointer' }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0176D3" style={{ flexShrink: 0 }}>
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {/* Manual-value row — only for mapped canonical terms. */}
                      {term && (() => {
                        const manualVal = termManual[term] || '';
                        const manualChecked = preferredId === '__manual__';
                        const isEditing = editingManual === term;
                        const manualEditActive = hoverRow === `man:${term}` || isEditing;
                        return (
                          <div
                            onClick={() => setSiManualActive(true)}
                            style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 0.9fr 1fr 40px', alignItems: 'stretch', borderTop: groupItems.length > 0 ? '1px solid #e5e5e5' : 'none', fontSize: '12px', color: '#2e2e2e', background: siManualActive ? '#f0f8ff' : '#ffffff', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="radio"
                                name={`si-vsm-pref-${term}`}
                                checked={manualChecked}
                                onChange={() => {
                                  setTermPref((prev) => ({ ...prev, [term]: '__manual__' }));
                                  if (!manualVal) setEditingManual(term);
                                }}
                                style={{ cursor: 'pointer', margin: 0 }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', color: '#2e2e2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(manualEditActive ? SI_ROW_DIM_STYLE : {}) }} title={term}>{term}</div>
                            <div
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={() => setHoverRow(`man:${term}`)}
                              onMouseLeave={() => setHoverRow((prev) => prev === `man:${term}` ? null : prev)}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', minWidth: 0, ...(dirtyCells.has(`man:${term}`) ? SI_DIRTY_STYLE : (manualEditActive ? SI_EDIT_CELL_STYLE : {})) }}
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
                                    else if (e.key === 'Escape') { setEditingManual(null); }
                                  }}
                                  style={{ width: '100%', padding: '4px 6px', fontSize: '12px', border: '1px solid #0176D3', borderRadius: '4px', boxSizing: 'border-box', color: '#2e2e2e' }}
                                />
                              ) : (
                                <>
                                  <span
                                    onClick={() => setEditingManual(term)}
                                    title={manualVal || 'Click to enter a value'}
                                    style={{ flex: 1, minWidth: 0, cursor: 'text', color: manualVal ? '#2e2e2e' : '#939393', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  >
                                    {manualVal || <span style={{ fontStyle: 'italic' }}>Add value</span>}
                                  </span>
                                  {manualEditActive && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setEditingManual(term); }}
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
                            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', color: '#2e2e2e', fontWeight: 400, ...(manualEditActive ? SI_ROW_DIM_STYLE : {}) }}>Manual</div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', color: '#c9c9c9' }}>—</div>
                            <div />
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default function SubmissionDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { currentStep } = useDemoFlow();
  const [mounted, setMounted] = useState(false);
  const [selectedTab, setSelectedTab] = useState('communication');
  const [submissionDataTab, setSubmissionDataTab] = useState<'account' | 'parties' | 'locations' | 'lines'>('account');
  // The active Submission-Data sub-tab's unsaved-edit state, bubbled up from the child so the
  // top-level tab switch can confirm before discarding. `subTabCancel` reverts the child's cells.
  const subTabDirty = useRef(false);
  const subTabCancel = useRef<() => void>(() => {});
  const [subTabPendingKey, setSubTabPendingKey] = useState<'account' | 'parties' | 'locations' | 'lines' | null>(null);
  const handleSubTabDirty = (dirty: boolean, cancel: () => void) => { subTabDirty.current = dirty; subTabCancel.current = cancel; };
  const switchSubTab = (key: 'account' | 'parties' | 'locations' | 'lines') => {
    if (key === submissionDataTab) return;
    if (subTabDirty.current) setSubTabPendingKey(key);
    else setSubmissionDataTab(key);
  };
  // Leaving the Submission Data record tab with unsaved sub-tab edits also confirms first.
  const [topTabPending, setTopTabPending] = useState<{ tabKey: string; run: () => void } | null>(null);
  const guardTopTab = (tabKey: string, run: () => void) => {
    if (selectedTab === 'submission-data' && tabKey !== 'submission-data' && subTabDirty.current) {
      setTopTabPending({ tabKey, run });
    } else {
      run();
    }
  };
  const [leftPanelTab, setLeftPanelTab] = useState<'tasks' | 'activity'>('tasks');
  const [commReadSteps, setCommReadSteps] = useState<Set<number>>(new Set());
  // Step 1 only: toggle the Partial Extraction task between its working and error views
  const [step1TaskView, setStep1TaskView] = useState<'working' | 'error'>('working');
  // Needs-Attention tiles the user has marked complete (demo-local, resets on reload).
  const [dismissedAttentionIds, setDismissedAttentionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Re-measure dep connectors on resize / DOM mutation
  useEffect(() => {
    const onResize = () => setDepConnectorTick((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useLayoutEffect(() => {
    if (!depContainerRef.current) return;
    const ro = new ResizeObserver(() => setDepConnectorTick((n) => n + 1));
    ro.observe(depContainerRef.current);
    depCardRefs.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  });

  const showCommNewEmailDot =
    mounted && (currentStep === 1 || currentStep === 6) && !commReadSteps.has(currentStep);
  const [selectedCommTab, setSelectedCommTab] = useState<'email' | 'slack'>('email');
  const [selectedEmailId, setSelectedEmailId] = useState('email-1');
  const [expandedEmailIds, setExpandedEmailIds] = useState<Set<string>>(new Set());
  const [readEmailIds, setReadEmailIds] = useState<Set<string>>(new Set());
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [moveToSubmission, setMoveToSubmission] = useState<{ messageId: string; subject: string } | null>(null);
  const [moveSubmissionQuery, setMoveSubmissionQuery] = useState('');
  const [moveSubmissionId, setMoveSubmissionId] = useState<string | null>(null);
  const [selectedSlackThreadId, setSelectedSlackThreadId] = useState('slack-1');
  const [selectedDocumentId, setSelectedDocumentId] = useState('doc-1');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedSubmissionLineId, setSelectedSubmissionLineId] = useState<string | null>(null);
  // Per-line per-attribute edits made by the user. Keyed by `${lineId}::${attrKey}`.
  const [submissionLineEdits, setSubmissionLineEdits] = useState<Record<string, { value: string; source: string }>>({});
  // Per-line per-attribute index of the currently-selected candidate source (for unedited attributes)
  const [submissionLineSourceIdx, setSubmissionLineSourceIdx] = useState<Record<string, number>>({});
  // Open source-picker modal anchor: { lineId, attrKey } | null
  const [sourcePickerAnchor, setSourcePickerAnchor] = useState<{ lineId: string; attrKey: string } | null>(null);
  // Inline-edit state for the value cell: { lineId, attrKey } | null
  const [editingAttribute, setEditingAttribute] = useState<{ lineId: string; attrKey: string } | null>(null);
  const [editingDraftValue, setEditingDraftValue] = useState<string>('');
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
    // Leave Security unmapped intentionally

    // L1-B2 - Loading Dock Annex
    'a01SB00001p8BGXYA2::Construction Type': 'Construction Type',
    'a01SB00001p8BGXYA2::Year Built': 'Year Built',
    'a01SB00001p8BGXYA2::Square Footage': 'Square Footage',
    // Leave Roof Type unmapped intentionally
    'a01SB00001p8BGXYA2::Roof Year': 'Roof Age',
    'a01SB00001p8BGXYA2::Occupancy': 'Occupancy Type',

    // General Liability LOB
    'a01SB00001pGYUTYA4::Premium Basis': null, // Intentionally unmapped
  }));
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [showAgentActivity, setShowAgentActivity] = useState(false);
  const [selectedAgentTask, setSelectedAgentTask] = useState<any>(null);
  const [emailComposerTaskId, setEmailComposerTaskId] = useState<string | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [classifyDocumentId, setClassifyDocumentId] = useState<string | null>(null);
  const [classifyDocNames, setClassifyDocNames] = useState<string[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploadDragging, setIsUploadDragging] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [userCreatedTasks, setUserCreatedTasks] = useState<NewTaskInput[]>([]);
  const [isPendingTasksExpanded, setIsPendingTasksExpanded] = useState(true);
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

  // Server-safe base submission (mock only, no localStorage) — used for the initial
  // render so server and client hydrate identically. Saved edits are layered on
  // post-mount via the effect below to avoid a hydration mismatch.
  const getBaseSubmissionData = (submissionId: string | string[] | undefined) => {
    if (!submissionId || Array.isArray(submissionId)) return null;
    return mockSubmissions.find((s) => s.id === submissionId) ?? null;
  };

  // Load submission data with any saved edits from localStorage (client-only)
  const getSubmissionData = (submissionId: string | string[] | undefined) => {
    const originalSubmission = getBaseSubmissionData(submissionId);
    if (!originalSubmission) return null;

    // Check if there are saved edits in localStorage
    if (typeof window !== 'undefined') {
      const savedEdits = localStorage.getItem(`submission_${submissionId}`);
      if (savedEdits) {
        try {
          const edits = JSON.parse(savedEdits);
          return { ...originalSubmission, ...edits };
        } catch (e) {
          console.error('Error loading saved edits:', e);
        }
      }
    }
    return originalSubmission;
  };

  // Editable submission state — initialize WITHOUT localStorage so SSR/client match;
  // the effect keyed on `id` applies any saved edits after mount.
  const [editableSubmission, setEditableSubmission] = useState(() => getBaseSubmissionData(id));
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);

  // Generate Quote flow — LOB → mapped product picker modal, resulting quotes
  // feed the Related tab's Quotes related list.
  const [isGenerateQuoteOpen, setIsGenerateQuoteOpen] = useState(false);
  const [quoteLobSelection, setQuoteLobSelection] = useState<Set<string>>(new Set());
  // Single quote-level name (above the LOB table) + per-LOB policy-period inputs.
  const [quoteNameInput, setQuoteNameInput] = useState('');
  const [quoteStartDate, setQuoteStartDate] = useState('');
  const [quoteEndDate, setQuoteEndDate] = useState('');
  // One quote spans every selected LOB — dataLobs/products are parallel arrays.
  const [generatedQuotes, setGeneratedQuotes] = useState<
    { id: string; name: string; submissionId: string; dataLobs: string[]; products: string[]; premium: number; createdOn: string; status: string; rated: boolean; startDate: string; endDate: string }[]
  >([]);
  const [showQuoteToast, setShowQuoteToast] = useState(false);

  // Load any previously generated quotes so the Related list survives navigating
  // to a quote record page and back. Persisted for the quote page to read its LOB.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Demo reset: a genuine browser reload clears any generated quotes (the
      // Related list starts empty again). In-app navigation keeps them.
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (nav?.type === 'reload') {
        localStorage.removeItem('uw_generated_quotes');
        setGeneratedQuotes([]);
        return;
      }
      const raw = localStorage.getItem('uw_generated_quotes');
      if (raw) setGeneratedQuotes(JSON.parse(raw));
    } catch {
      /* ignore malformed cache */
    }
  }, []);

  const openGenerateQuote = () => {
    // Quoting only becomes available once the submission is fully reconciled (Step 10).
    if (currentStep < 10) return;
    setQuoteLobSelection(new Set(QUOTE_LOB_OPTIONS.map((o) => o.lob)));
    setQuoteNameInput('');
    setQuoteStartDate('');
    setQuoteEndDate('');
    setIsGenerateQuoteOpen(true);
  };

  const handleGenerateQuote = () => {
    const selected = QUOTE_LOB_OPTIONS.filter((o) => quoteLobSelection.has(o.lob));
    if (selected.length === 0) return;
    const subId = typeof id === 'string' ? id : 'a00SB00001ARehdYAD';
    setGeneratedQuotes((prev) => {
      const seq = 42501 + prev.length;
      // A single quote spans every selected LOB, sharing one policy period.
      const next = [
        ...prev,
        {
          id: `quote-${seq}`,
          name: quoteNameInput.trim() || `Q-${seq}`,
          submissionId: subId,
          dataLobs: selected.map((o) => o.dataLob),
          products: selected.map((o) => o.product),
          // Total Premium = sum of each LOB's rolled-up total, identical to the quote page.
          // Not surfaced until the quote is rated (Rate Quote on the quote page).
          premium: selected.reduce((sum, o) => sum + computeQuoteTotalForLob(subId, o.dataLob), 0),
          createdOn: 'May 13, 2026',
          status: 'Draft',
          rated: false,
          startDate: quoteStartDate,
          endDate: quoteEndDate,
        },
      ];
      try {
        localStorage.setItem('uw_generated_quotes', JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
    setIsGenerateQuoteOpen(false);
    setShowQuoteToast(true);
    setTimeout(() => setShowQuoteToast(false), 3000);
  };

  const submission = editableSubmission;

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

  // Reload submission data when ID changes
  useEffect(() => {
    setEditableSubmission(getSubmissionData(id));
  }, [id]);

  const handleFieldEdit = (fieldName: string, value: any) => {
    if (submission) {
      setEditableSubmission({
        ...submission,
        [fieldName]: value
      });
    }
  };

  const handleFieldClick = (fieldName: string) => {
    setEditingField(fieldName);
  };

  const handleFieldBlur = () => {
    setEditingField(null);
    // Save changes to localStorage
    if (editableSubmission && id) {
      try {
        localStorage.setItem(`submission_${id}`, JSON.stringify(editableSubmission));
        console.log('Changes saved to localStorage');
        // Show save confirmation toast
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 3000);
      } catch (e) {
        console.error('Error saving changes:', e);
      }
    }
  };

  // Editable field component
  const EditableField = ({ fieldName, label, value, type = 'text', isLink = false }: {
    fieldName: string;
    label: string;
    value: any;
    type?: 'text' | 'number' | 'date' | 'checkbox';
    isLink?: boolean;
  }) => {
    // Check if this field should show value based on step config
    const detailsFieldsWithValues = stepConfig?.detailsFieldsWithValues;
    const shouldShowValue = !detailsFieldsWithValues || detailsFieldsWithValues.includes(fieldName);
    const displayValue = shouldShowValue ? value : '-';

    return (
      <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>{label}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

  if (!submission) {
    return (
      <>
        <GlobalHeader />
        <div className="record-page-container">
          <div className="slds-text-align_center slds-m-vertical_xx-large">
            <h1 className="slds-text-heading_large">Submission not found</h1>
            <button
              className="slds-button slds-button_brand slds-m-top_medium"
              onClick={() => router.push('/')}
            >
              Back to Submissions
            </button>
          </div>
        </div>
      </>
    );
  }

  // Get step-specific data or use defaults
  const stepConfig = (stepConfigurations as any)[currentStep]?.submission;

  // Mock Documents data - use step-specific or default
  const documents = stepConfig?.documents || mockDocuments;

  // Mock Slack messages - use step-specific or default
  const slackMessages = stepConfig?.slackMessages || mockSlackMessages;

  // Mock email threads - use step-specific or default
  const emailThreads = stepConfig?.emails || mockEmailThreads;

  // Mock activity data - use step-specific or default
  const defaultActivities: ActivityItemProps[] = [
    {
      id: 'act-1',
      title: 'Data Reconciliation',
      description: 'NexGen Biologics Inc New Business · System Task',
      completedBy: 'Agent',
      timestamp: '9:30 PM · May 12',
      status: 'completed',
      warningMessage: 'Manual review required to resolve conflicting information',
      details: 'Data reconciliation complete',
      detailsList: [
        '4 lines of business identified: Commercial Property, Commercial Auto, General Liability, Umbrella',
        'Submission lines created',
        'Conflicting information requires manual reconciliation'
      ]
    },
    {
      id: 'act-2',
      title: 'Clearance Check',
      description: 'NexGen Biologics Inc New Business · System Task',
      completedBy: 'System',
      timestamp: '9:30 PM · May 12',
      status: 'completed'
    },
    {
      id: 'act-3',
      title: 'L1 Data Extraction',
      description: 'NexGen Biologics Inc New Business · System Task',
      completedBy: 'System',
      timestamp: '9:30 PM · May 12',
      status: 'completed'
    },
    {
      id: 'act-4',
      title: 'Submission Email Received',
      description: 'NexGen Biologics Inc New Business · Sent by Niki Paoloni',
      completedBy: 'Niki Paoloni',
      timestamp: '9:30 PM · May 12',
      status: 'completed'
    }
  ];

  const rawActivities = stepConfig?.activities || defaultActivities;

  const linkStyle: React.CSSProperties = { color: '#0176D3', textDecoration: 'underline', cursor: 'pointer' };
  const openEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedTab('communication');
    setSelectedCommTab('email');
    setSelectedEmailId('email-1');
  };
  const openDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedTab('details');
  };
  const openDocument = (docId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedTab('documents');
    setSelectedDocumentId(docId);
  };

  const linkifyAgenticStep = (step: any) => {
    if (step.title === 'Email Analysis') {
      return {
        ...step,
        details: (
          <>
            Analyzed{' '}
            <a href="#" onClick={openEmail} style={linkStyle}>email</a>
            {' '}content from{' '}
            <a href="#" onClick={openEmail} style={linkStyle}>Niki Paoloni</a>
            {' '}requesting commercial property and general liability insurance coverage for{' '}
            <a href="#" onClick={openDetails} style={linkStyle}>NexGen Biologics</a>
            .
          </>
        ),
      };
    }
    if (step.title === 'Document Identification') {
      return {
        ...step,
        details: (
          <>
            Classified{' '}
            <a href="#" onClick={openDocument('doc-1')} style={linkStyle}>
              ACORD 125 + 140 - Commercial Application & Property Section.pdf
            </a>
            {' '}into 2 forms. Unable to classify{' '}
            <a href="#" onClick={openDocument('doc-3')} style={linkStyle}>
              ACORD 126 - Commercial General Liability.pdf
            </a>
            {' '}— manual classification required.
          </>
        ),
      };
    }
    if (step.title === 'Data Extraction - ACORD 125') {
      return {
        ...step,
        details: (
          <>
            Extracted from{' '}
            <a href="#" onClick={openDocument('doc-1')} style={linkStyle}>
              ACORD 125 + 140 - Commercial Application & Property Section.pdf
            </a>
            : Business name, Business type, Years in business, Annual revenue, Employee count.
          </>
        ),
      };
    }
    if (step.title === 'Data Extraction - ACORD 140') {
      return {
        ...step,
        details: (
          <>
            Extracted from{' '}
            <a href="#" onClick={openDocument('doc-1')} style={linkStyle}>
              ACORD 125 + 140 - Commercial Application & Property Section.pdf
            </a>
            : Locations, Total insured value, Building construction, Protection class, Sprinkler systems.
          </>
        ),
      };
    }
    return step;
  };

  const linkifyActivityWarning = (act: any) => {
    if (act.id === 'act-submission-triaged') {
      return {
        ...act,
        detailsList: [
          <>
            <a href="#" onClick={(e) => { e.preventDefault(); router.push('/submission-lines/a01SB00001p8B5FYAU'); }} style={linkStyle}>
              Commercial Property
            </a>
            {' '}assigned to Manish Arya (Underwriter)
          </>,
          <>
            <a href="#" onClick={(e) => { e.preventDefault(); router.push('/submission-lines/a01SB00001pGYUTYA4'); }} style={linkStyle}>
              General Liability
            </a>
            {' '}assigned to David Chen (Underwriter)
          </>,
        ],
      };
    }
    if (
      act.id === 'act-2' &&
      typeof act.warningMessage === 'string' &&
      act.warningMessage.includes('ACORD 126 - Commercial General Liability.pdf')
    ) {
      return {
        ...act,
        warningMessage: (
          <>
            Unable to classify{' '}
            <a href="#" onClick={openDocument('doc-3')} style={linkStyle}>
              ACORD 126 - Commercial General Liability.pdf
            </a>
            . Manual classification required to continue.
          </>
        ),
      };
    }
    return act;
  };

  const activities = rawActivities
    .map((act: any) =>
      act.agenticSteps && act.agenticSteps.length > 0
        ? { ...act, agenticSteps: act.agenticSteps.map(linkifyAgenticStep) }
        : act
    )
    .map(linkifyActivityWarning);

  // Items surfaced in Needs Attention: any activity with a warning/error, plus
  // the Partial Extraction task when step 1 is toggled into its error state.
  const attentionActivities: ActivityItemProps[] = [
    ...(currentStep === 1 && step1TaskView === 'error'
      ? [{
          id: 'attention-partial-extraction-error',
          title: 'Partial Extraction',
          description: 'Extraction Agent',
          completedBy: '',
          timestamp: 'Just now',
          status: 'in-progress' as const,
          errorMessage: 'Extraction failed — the Extraction Agent could not read the attached ACORD documents.',
        }]
      : []),
    ...activities.filter((a: ActivityItemProps) => a.warningMessage || a.errorMessage),
  ].filter((a) => !dismissedAttentionIds.has(a.id));

  // Derive a concise notification headline for a Needs Attention item from its
  // underlying warning/error text (the raw string, before linkification).
  const attentionTitleFor = (act: ActivityItemProps): string => {
    const raw = String(rawActivities.find((r: any) => r.id === act.id)?.warningMessage
      ?? rawActivities.find((r: any) => r.id === act.id)?.errorMessage
      ?? act.errorMessage ?? '');
    if (act.errorMessage && act.id === 'attention-partial-extraction-error') return 'Partial Extraction failed';
    if (/classif/i.test(raw)) return 'Unable to classify document';
    if (/FEIN/i.test(raw)) return 'FEIN not available';
    if (/discrepan/i.test(raw)) return 'Data discrepancies found';
    return act.errorMessage ? `${act.title} failed` : act.title;
  };

  // Needs Attention is a set of clickable notifications, not task/activity tiles.
  const attentionNotifications = attentionActivities.map((act) => {
    const isError = !!act.errorMessage;
    const raw = String(rawActivities.find((r: any) => r.id === act.id)?.warningMessage ?? '');
    let onClick: () => void = () => setLeftPanelTab('activity');
    if (act.id === 'attention-partial-extraction-error') {
      onClick = () => setLeftPanelTab('tasks');
    } else if (/classif/i.test(raw)) {
      onClick = () => { setSelectedTab('documents'); setSelectedDocumentId('doc-3'); };
    }
    return {
      id: act.id,
      isError,
      title: attentionTitleFor(act),
      message: act.errorMessage || act.warningMessage,
      onClick,
    };
  });

  // Get pending tasks from step config
  const pendingTasks = [...userCreatedTasks, ...(stepConfig?.pendingTasks || [])];

  // Format a demo-anchored "minutes ago" into a relative label, falling back to a
  // date-time string for longer spans (≥ ~3 days).
  const formatLastActivity = (minutesAgo: number | undefined): string => {
    if (minutesAgo == null) return '—';
    if (minutesAgo < 1) return 'Just now';
    if (minutesAgo < 60) return `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutesAgo / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 3) return `${days} day${days === 1 ? '' : 's'} ago`;
    // Longer spans: show an absolute date-time anchored to the demo timeline
    const anchor = new Date('2026-05-13T09:42:00');
    const then = new Date(anchor.getTime() - minutesAgo * 60000);
    return then.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  // Handler for opening agent activity panel
  const handleTaskClick = (task: any) => {
    if (task.type === 'agentic' && task.agentSteps) {
      setSelectedAgentTask(task);
      setShowAgentActivity(true);
    }
  };

  return (
    <IconSettings iconPath={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons`}>
      <div style={{ backgroundColor: '#f3f3f3', minHeight: '100vh' }}>
        <GlobalHeader />

        <div style={{ padding: '16px' }}>
          {/* Page Header - White background */}
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
                  <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Submission</div>

                  {/* Title */}
                  <h1 style={{ fontSize: '28px', fontWeight: 400, color: '#001e5b', margin: 0, lineHeight: '35px', marginBottom: '16px' }}>
                    {submission.name}
                  </h1>

                  {/* Details row - conditional fields based on step */}
                  <div style={{ display: 'flex', gap: '80px', flexWrap: 'wrap' }}>
                    {(!stepConfig?.visibleFields || stepConfig.visibleFields.includes('id')) && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Submission ID</div>
                        <a href="#" style={{ fontSize: '13px', color: '#0250d9', textDecoration: 'underline', lineHeight: '18px' }}>{submission.id}</a>
                      </div>
                    )}
                    {(!stepConfig?.visibleFields || stepConfig.visibleFields.includes('broker')) && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Broker</div>
                        {(stepConfig?.fieldsWithValues && !stepConfig.fieldsWithValues.includes('broker')) ? (
                          <div style={{ fontSize: '13px', color: '#5c5c5c', lineHeight: '18px' }}>-</div>
                        ) : submission.broker ? (
                          <a href="#" style={{ fontSize: '13px', color: '#0250d9', textDecoration: 'underline', lineHeight: '18px' }}>{submission.broker}</a>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#5c5c5c', lineHeight: '18px' }}>-</div>
                        )}
                      </div>
                    )}
                    {(!stepConfig?.visibleFields || stepConfig.visibleFields.includes('totalInsuredValue')) && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Total Insured Value</div>
                        {(stepConfig?.fieldsWithValues && !stepConfig.fieldsWithValues.includes('totalInsuredValue')) ? (
                          <div style={{ fontSize: '13px', color: '#5c5c5c', lineHeight: '18px' }}>-</div>
                        ) : (
                          <div style={{ fontSize: '13px', color: submission.totalInsuredValue ? '#001e5b' : '#5c5c5c', lineHeight: '18px' }}>
                            {submission.totalInsuredValue ? `$${submission.totalInsuredValue.toLocaleString()}` : '-'}
                          </div>
                        )}
                      </div>
                    )}
                    {(!stepConfig?.visibleFields || stepConfig.visibleFields.includes('priority')) && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Priority</div>
                        {(stepConfig?.fieldsWithValues && !stepConfig.fieldsWithValues.includes('priority')) ? (
                          <div style={{ fontSize: '13px', color: '#5c5c5c', lineHeight: '18px' }}>-</div>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>{submission.priority || '-'}</div>
                        )}
                      </div>
                    )}
                    {(!stepConfig?.visibleFields || stepConfig.visibleFields.includes('stage')) && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Stage</div>
                        <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>
                          {(() => {
                            const currentStageKey = stepConfig?.progressPath?.currentStage;
                            const stageLabel = stepConfig?.progressPath?.stages?.find((s: any) => s.key === currentStageKey)?.label;
                            return stageLabel || submission.stage || submission.status;
                          })()}
                        </div>
                      </div>
                    )}
                    {(!stepConfig?.visibleFields || stepConfig.visibleFields.includes('assignedTo')) && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>Assigned To</div>
                        {(stepConfig?.fieldsWithValues && !stepConfig.fieldsWithValues.includes('assignedTo')) ? (
                          <div style={{ fontSize: '13px', color: '#5c5c5c', lineHeight: '18px' }}>-</div>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>Martha (UW Team Lead)</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <ButtonGroup id="page-header-actions">
                    <Button label="Edit" />
                    <Button label="Create Quote" onClick={openGenerateQuote} disabled={currentStep < 10} />
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
                  {submission.name}
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
                    TIV: ${(submission.totalInsuredValue || submission.coverageAmount)?.toLocaleString()}
                  </div>
                  <div style={{
                    backgroundColor: '#e5e5e5',
                    color: '#2e2e2e',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    {submission.broker}
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
                  In Progress
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

          {/* Progress Path - moved directly below the header; stays visible when header is collapsed */}
          <div style={{
            marginTop: '16px',
            marginBottom: '0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', flex: 1, height: '32px' }}>
              {/* Stage 1 - Draft (Current for Step 1 & 2) */}
              <div style={{
                position: 'relative',
                flex: 1,
                backgroundColor: currentStep <= 6 ? '#032D60' : '#4BCA81',
                color: currentStep <= 6 ? 'white' : '#032D60',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 400,
                clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
              }}>
                {currentStep > 6 && (
                  <svg style={{ width: '14px', height: '14px', fill: '#032D60', marginRight: '4px' }} viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
                Draft
              </div>

              {/* Stage 2 - In Progress */}
              <div style={{
                position: 'relative',
                flex: 1,
                backgroundColor: currentStep > 6 ? '#032D60' : '#C9C9C9',
                color: currentStep > 6 ? 'white' : '#706E6B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 400,
                clipPath: 'polygon(12px 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0 50%)',
                marginLeft: '-1px'
              }}>
                In Progress
              </div>

              {/* Stage 3 - Processed */}
              <div style={{
                position: 'relative',
                flex: 1,
                backgroundColor: '#C9C9C9',
                color: '#706E6B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 400,
                clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 12px 100%, 0 50%)',
                marginLeft: '-1px'
              }}>
                Processed
              </div>
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

          {/* Submission Summary Card */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #c9c9c9',
            borderRadius: '12px',
            overflow: 'hidden',
            marginTop: '16px',
            marginBottom: '16px'
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
                <span style={{ fontSize: '16px', fontWeight: 600, color: 'black' }}>Submission Summary</span>
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
                {currentStep === 10 && generatedQuotes.length === 0 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      All submission lines are reconciled — data discrepancies and duplicate values have been resolved on both lines. The NexGen Biologics submission is ready to quote across its created lines of business.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><strong>Reconciliation complete:</strong> Commercial Property and General Liability submission lines finalized; flagged discrepancies and duplicates resolved.</li>
                      <li><strong>Ready to quote:</strong> Both lines are mapped to products — Commercial Property to a Commercial Property Policy and General Liability to a Commercial General Liability Policy.</li>
                      <li><strong>Next step:</strong> Generate a quote from the <strong>Create Quote</strong> action or the <strong>Generate Quote</strong> task, then rate and review.</li>
                    </ul>
                  </div>
                )}
                {currentStep === 10 && generatedQuotes.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#2e2e2e', lineHeight: '17px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      {generatedQuotes.length} quote{generatedQuotes.length > 1 ? 's have' : ' has'} been generated for the NexGen Biologics submission and {generatedQuotes.length > 1 ? 'are' : 'is'} now available in the Quotes related list. Reconciliation is complete and both lines of business are mapped to products.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      {generatedQuotes.map((q) => (
                        <li key={q.id}>
                          <strong>{q.name}</strong> — {q.products.join(', ')} ({q.dataLobs.join(', ')}) · Status {q.status} · {q.rated ? `Total Premium $${q.premium.toLocaleString()}` : 'Not yet rated'}.
                        </li>
                      ))}
                      <li><strong>Next step:</strong> Rate each quote (<strong>Rate Quote</strong> on the quote record) to calculate premium, then review and bind.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lines of Business Status Section - conditionally shown based on step */}
          {stepConfig?.showLOBSection !== false && (
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 8px 0', color: '#2e2e2e' }}>Lines Of Business</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
              {/* Commercial Property */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #c9c9c9',
                borderRadius: '6px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, margin: 0, color: '#001e5b', lineHeight: '16px' }}>Commercial Property</h4>
                  <div style={{
                    backgroundColor: '#032D60',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}>
                    Intake and Clearance
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: '#5c5c5c', lineHeight: '14px' }}>
                  Next: Data Enrichment
                </div>
                {/* Progress indicator */}
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#032D60', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                </div>
              </div>

              {/* Commercial Auto */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #c9c9c9',
                borderRadius: '6px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, margin: 0, color: '#001e5b', lineHeight: '16px' }}>Commercial Auto</h4>
                  <div style={{
                    backgroundColor: '#032D60',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}>
                    Intake and Clearance
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: '#5c5c5c', lineHeight: '14px' }}>
                  Next: Data Enrichment
                </div>
                {/* Progress indicator */}
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#032D60', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                </div>
              </div>

              {/* General Liability */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #c9c9c9',
                borderRadius: '6px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, margin: 0, color: '#001e5b', lineHeight: '16px' }}>General Liability</h4>
                  <div style={{
                    backgroundColor: '#032D60',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}>
                    Intake and Clearance
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: '#5c5c5c', lineHeight: '14px' }}>
                  Next: Data Enrichment
                </div>
                {/* Progress indicator */}
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#032D60', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                  <div style={{ width: '14px', height: '3px', backgroundColor: '#C9C9C9', borderRadius: '2px' }}></div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Lines of Business tiles — config-driven; rendered once the step has materialized LOBs.
              Sits outside the tabs, below the submission summary. Max 4 per row. */}
          {Array.isArray(stepConfig?.overviewLobTiles) && stepConfig.overviewLobTiles.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0', color: '#2e2e2e' }}>Lines of Business</h3>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stepConfig.overviewLobTiles.length, 4)}, 1fr)`, gap: '12px' }}>
                {stepConfig.overviewLobTiles.map((tile: any) => {
                  const attention: string[] = Array.isArray(tile.attentionItems) ? tile.attentionItems : [];
                  const warningText = attention.length === 0 ? null : 'Data discrepancies found';
                  return (
                    <div
                      key={tile.name}
                      onClick={() => { if (tile.lineId) router.push(`/submission-lines/${tile.lineId}`); }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && tile.lineId) router.push(`/submission-lines/${tile.lineId}`); }}
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid #c9c9c9',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        cursor: tile.lineId ? 'pointer' : 'default',
                        transition: 'box-shadow 0.15s, border-color 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
                        e.currentTarget.style.borderColor = '#0176D3';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = '#c9c9c9';
                      }}
                    >
                      {/* Name */}
                      <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#0176D3', lineHeight: '18px' }}>
                        {tile.name}
                      </h4>

                      {/* Fields - 2-column layout */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                        {/* Current stage */}
                        <div>
                          <div style={{ fontSize: '11px', color: '#5c5c5c', marginBottom: '3px' }}>Current Stage</div>
                          <div style={{
                            display: 'inline-block',
                            backgroundColor: '#032D60',
                            color: 'white',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500
                          }}>
                            {tile.stage}
                          </div>
                        </div>

                        {/* Assigned To */}
                        <div>
                          <div style={{ fontSize: '11px', color: '#5c5c5c', marginBottom: '2px' }}>Assigned To</div>
                          <div style={{ fontSize: '13px', color: '#2e2e2e', lineHeight: '17px' }}>
                            {tile.assignedTo || '—'}
                          </div>
                        </div>

                        {/* Last activity */}
                        <div>
                          <div style={{ fontSize: '11px', color: '#5c5c5c', marginBottom: '2px' }}>Last Activity</div>
                          <div style={{ fontSize: '13px', color: '#2e2e2e', lineHeight: '17px' }}>
                            {formatLastActivity(tile.lastActivityMinutesAgo)}
                          </div>
                        </div>
                      </div>

                      {/* Warnings — from the LOB line's Needs Attention */}
                      {warningText && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          marginTop: 'auto'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#B85C00" style={{ flexShrink: 0, marginTop: '1px' }}>
                            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                          </svg>
                          <span style={{ fontSize: '14px', color: '#B85C00', lineHeight: '20px' }}>{warningText}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isLeftCollapsed ? '1fr 56px' : '70% 30%', gap: '16px', marginTop: isHeaderCompact ? '24px' : '0', transition: 'grid-template-columns 0.2s' }}>
            {/* Left Column - Needs Attention + Pending Tasks + Activity Log */}
            {isLeftCollapsed ? (
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

                  // Mirror PendingTask badge palette: pastel fill + dark border + dark icon
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

                  // Icon: sparkles for agentic-in-progress, sync for in-progress (manual),
                  // pause for on-hold, user for pending/manual, check for completed
                  const iconSvg = (task.status === 'in-progress' && isAgentic) ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#agenticBarGrad)" style={{ animation: 'collapsedAgenticBounce 2s ease-in-out infinite' }}>
                      <defs>
                        <linearGradient id="agenticBarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#9602c7"/>
                          <stop offset="100%" stopColor="#0250d9"/>
                        </linearGradient>
                      </defs>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ) : task.status === 'in-progress' ? (
                    // sync (matches badge) — rotating while active
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={iconColor} style={{ animation: 'collapsedTaskSpin 1.1s linear infinite' }}>
                      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                    </svg>
                  ) : task.status === 'on-hold' ? (
                    // pause (matches badge)
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
                    // user (manual / pending)
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

              {/* Needs Attention Section */}
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
              </div>

              {/* Standard tasks message */}
              {leftPanelTab === 'tasks' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#5c5c5c' }}>
                    All ongoing and pending tasks for this stage
                  </span>
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
                </div>
              )}

              {/* Render Pending Tasks - only on the Tasks tab */}
              {leftPanelTab === 'tasks' && (() => {
                // Build dependency graph. dependentOn can be a string or string[] of parent titles.
                const parentsOf = new Map<string, string[]>(); // task id -> parent ids
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

                // Topological depth (longest path from a root)
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

                // Stable order: parents before children, then preserve original sequence
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

                const CIRCLE_SIZE = 24;
                const GUTTER_OFFSET = 14; // distance from child circle's left edge to its gutter
                const ROW_GAP = 8;

                // All cards share one width. When any task has a dependency we reserve a
                // fixed left gutter (for the circle + connector); otherwise cards go full width.
                // Gutter is sized so the connector's vertical run lands at container x=0
                // (LEFT_GUTTER − CIRCLE_SIZE/2 − GUTTER_OFFSET = 0), aligning it with the
                // scoped notification's left edge while maximizing card width.
                const hasAnyDependent = ordered.some((t: any) => (parentsOf.get(t.id) || []).length > 0);
                const LEFT_GUTTER = hasAnyDependent ? CIRCLE_SIZE / 2 + GUTTER_OFFSET : 0;

                // Compute connector path geometry from measured DOM positions
                const containerRect = depContainerRef.current?.getBoundingClientRect();
                const centerOf = (id: string) => {
                  const el = depCircleRefs.current.get(id) || depCardRefs.current.get(id);
                  if (!el || !containerRect) return null;
                  const r = el.getBoundingClientRect();
                  return {
                    cx: r.left - containerRect.left + r.width / 2,
                    cy: r.top - containerRect.top + r.height / 2,
                    leftEdge: r.left - containerRect.left, // for cards, this is the card's left
                  };
                };
                const cardLeftOf = (id: string) => {
                  const el = depCardRefs.current.get(id);
                  if (!el || !containerRect) return null;
                  const r = el.getBoundingClientRect();
                  return {
                    x: r.left - containerRect.left,
                    yMid: r.top - containerRect.top + r.height / 2,
                  };
                };
                void depConnectorTick; // re-evaluate when this state changes

                return (
                <div ref={depContainerRef} style={{ marginBottom: '16px', position: 'relative' }}>
                  {/* SVG overlay drawn behind the cards for the connector lines */}
                  <svg
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
                  >
                    {containerRect && ordered.flatMap((task: any) => {
                      const ps = parentsOf.get(task.id) || [];
                      if (ps.length === 0) return [];
                      const childCircle = depCircleRefs.current.get(task.id);
                      if (!childCircle) return [];
                      const cr = childCircle.getBoundingClientRect();
                      const childCx = cr.left - containerRect.left;            // left edge of circle
                      const childCy = cr.top - containerRect.top + cr.height / 2;
                      return ps.map((pid: string) => {
                        const pCard = cardLeftOf(pid);
                        if (!pCard) return null;
                        const isHi = highlighted.has(task.id) && highlighted.has(pid);
                        const stroke = isHi ? '#0176D3' : '#c9c9c9';
                        const opacity = dimOthers && !isHi ? 0.25 : 1;
                        // The gutter sits just left of the child's circle, at a unique x per child.
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
                    const ps = parentsOf.get(task.id) || [];
                    const parentCount = ps.length;
                    const isManuallyCreated = userCreatedTasks.some((t) => t.id === task.id);
                    const hideStatusBadge = task.id === 'task-classify-doc' || task.hideStatusBadge === true;
                    const taskType = isManuallyCreated ? 'Manually Created' : (parentCount > 0 ? 'Dependent Task' : 'Stage Task');
                    const isHi = highlighted.has(task.id);
                    const dim = dimOthers && !isHi;
                    const isActive = depHighlightTaskId === task.id;
                    return (
                    <div key={task.id} style={{
                      position: 'relative',
                      paddingLeft: LEFT_GUTTER,
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
                              width="12"
                              height="12"
                              viewBox="0 0 52 52"
                              fill={isActive ? 'white' : '#0176D3'}
                              aria-hidden="true"
                            >
                              <use href={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#level_down`} />
                            </svg>
                          </button>
                        )}
                    <PendingTask
                      hideDependencyIcon
                      key={task.id}
                      id={task.id}
                      title={task.title}
                      assignedTo={task.assignedTo}
                      parentLabel={task.parentLabel}
                      taskType={taskType}
                      isManuallyCreated={isManuallyCreated}
                      hideStatusBadge={hideStatusBadge}
                      progressType={task.type === 'agentic' ? 'agentic' : 'normal'}
                      status={currentStep === 1 && task.id === 'task-1' && step1TaskView === 'error' ? 'error' : task.status}
                      errorMessage={currentStep === 1 && task.id === 'task-1' && step1TaskView === 'error' ? 'Extraction failed — the Extraction Agent could not read the attached ACORD documents.' : undefined}
                      onHoldReason={task.onHoldReason}
                      description={task.description || ''}
                      dependentOn={task.dependentOn}
                      agentName={task.agentName}
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
                        (isManuallyCreated || task.hasRunTask) && !task.hasDraftEmail
                          ? () => {
                              if (task.id === 'task-generate-quote') openGenerateQuote();
                              else console.log('Run task', task.id);
                            }
                          : undefined
                      }
                      runTaskLabel={task.runTaskLabel}
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
                      onRetry={
                        currentStep === 1 && task.id === 'task-1' && step1TaskView === 'error'
                          ? () => setStep1TaskView('working')
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

              {/* Activity Log - shown on the Activity tab */}
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
            <div style={{ gridColumn: 1, gridRow: 1, backgroundColor: 'white', borderRadius: '12px', overflow: 'visible', minHeight: isHeaderCompact ? 'calc(100vh - 200px)' : 'calc(100vh - 350px)', display: 'flex', flexDirection: 'column' }}>
              {/* Tabs */}
              <div style={{
                borderBottom: '1px solid #dddbda',
                display: 'flex',
                padding: '0 16px',
                backgroundColor: 'white'
              }}>
                {['Email', 'Submission Data', 'Documents', 'Details', 'Related'].map((tab) => {
                  const tabKey = tab === 'Submission Data' ? 'submission-data' : tab === 'Email' ? 'communication' : tab.toLowerCase().replace(' ', '-');
                  const showDocumentsError = tab === 'Documents' && currentStep === 2;
                  const showSubmissionLinesWarning = tab === 'Submission Data' && !!stepConfig?.submissionLinesWarning;
                  const showCommNewDot = tab === 'Email' && showCommNewEmailDot;
                  return (
                  <button
                    key={tab}
                    onClick={() => guardTopTab(tabKey, () => {
                      setSelectedTab(tabKey);
                      if (tab === 'Email' && showCommNewEmailDot) {
                        setCommReadSteps((prev) => {
                          const next = new Set(prev);
                          next.add(currentStep);
                          return next;
                        });
                      }
                    })}
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" aria-label="Warning">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                      </svg>
                    )}
                    {showSubmissionLinesWarning && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" aria-label="Warning">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                      </svg>
                    )}
                    {showCommNewDot && (
                      <span
                        aria-label="New email"
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#ea001e',
                          display: 'inline-block',
                        }}
                      />
                    )}
                  </button>
                  );
                })}
                {/* Full-screen — collapses the header, submission summary, and side panel to maximize the tab area */}
                <button
                  onClick={() => { setIsHeaderCompact(true); setIsSummaryExpanded(false); setIsLeftCollapsed(true); }}
                  title="Full screen"
                  aria-label="Full screen"
                  style={{
                    marginLeft: 'auto',
                    alignSelf: 'center',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#706E6B'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#0176D3'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#706E6B'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                  </svg>
                </button>
              </div>

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

                const showCommToggle = false;
                return (
                  <div style={{ display: 'flex', flex: 1 }}>
                    {/* Vertical Icon Tabs — hidden for now; toggle showCommToggle to bring back */}
                    {showCommToggle && (
                    <div style={{
                      width: '56px',
                      borderRight: '1px solid #e5e5e5',
                      backgroundColor: '#fafafa',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingTop: '12px',
                      gap: '8px',
                      flexShrink: 0
                    }}>
                      {/* Email Tab */}
                      <button
                        onClick={() => setSelectedCommTab('email')}
                        title="Email"
                        style={{
                          width: '40px',
                          height: '40px',
                          border: 'none',
                          borderRadius: '8px',
                          backgroundColor: selectedCommTab === 'email' ? '#0176D3' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedCommTab !== 'email') {
                            e.currentTarget.style.backgroundColor = '#e5e5e5';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedCommTab !== 'email') {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <svg style={{ width: '20px', height: '20px', fill: selectedCommTab === 'email' ? 'white' : '#5c5c5c' }} viewBox="0 0 24 24">
                          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                        </svg>
                      </button>

                      {/* Slack Tab */}
                      <button
                        onClick={() => setSelectedCommTab('slack')}
                        title="Slack"
                        style={{
                          width: '40px',
                          height: '40px',
                          border: 'none',
                          borderRadius: '8px',
                          backgroundColor: selectedCommTab === 'slack' ? '#0176D3' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s',
                          padding: 0
                        }}
                        onMouseEnter={(e) => {
                          if (selectedCommTab !== 'slack') {
                            e.currentTarget.style.backgroundColor = '#e5e5e5';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedCommTab !== 'slack') {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <Icon
                          assistiveText={{ label: 'Slack' }}
                          category="utility"
                          name="slack"
                          size="x-small"
                          colorVariant={selectedCommTab === 'slack' ? 'default' : 'default'}
                          style={{ fill: selectedCommTab === 'slack' ? 'white' : '#5c5c5c' }}
                        />
                      </button>
                    </div>
                    )}

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

              {/* Submission Data — horizontal sub-tabs (Submission Attributes / Submission Parties / Lines of business) + content */}
              {selectedTab === 'submission-data' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  {/* Horizontal sub-tab bar */}
                  <div style={{
                    borderBottom: '1px solid #dddbda',
                    display: 'flex',
                    padding: '0 16px',
                    backgroundColor: 'white',
                    flexShrink: 0
                  }}>
                    {([
                      { key: 'account', label: 'Submission Attributes' },
                      { key: 'parties', label: 'Submission Parties' },
                      { key: 'locations', label: 'Shared Locations' },
                      { key: 'lines', label: 'Lines of business' },
                    ] as const).map((sub) => {
                      const active = submissionDataTab === sub.key;
                      return (
                        <button
                          key={sub.key}
                          onClick={() => switchSubTab(sub.key)}
                          style={{
                            padding: '12px 16px 10px 16px',
                            border: 'none',
                            background: 'none',
                            fontSize: '13px',
                            fontWeight: active ? 600 : 400,
                            color: active ? '#0176D3' : '#706E6B',
                            borderBottom: active ? '2px solid #0176D3' : '2px solid transparent',
                            marginBottom: '-1px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Content pane */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {(() => {
                // Submission parties and lines are only populated once reconciliation
                // completes (Step 9). Earlier steps show an empty state. The Submission
                // Attributes sub-tab is available in every step — before Step 9 it shows
                // only the canonical-term mapping (Attribute/Value/Source blank).
                const notReady = stepConfig?.showSubmissionLines === false;

                if (notReady && submissionDataTab !== 'account') {
                  const emptyCopy: Record<Exclude<typeof submissionDataTab, 'account'>, { title: string; body: string }> = {
                    parties: {
                      title: 'No Submission Parties Available',
                      body: 'Submission parties will be available once the initial data extraction and analysis is complete.',
                    },
                    locations: {
                      title: 'No Shared Locations Available',
                      body: 'Shared locations will be available once the initial data extraction and analysis is complete.',
                    },
                    lines: {
                      title: 'No Submission Lines Available',
                      body: 'Submission lines will be created once the initial data extraction and analysis is complete.',
                    },
                  };
                  const copy = emptyCopy[submissionDataTab];
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
                          {copy.title}
                        </h3>
                        <p style={{ fontSize: '13px', color: '#5c5c5c', margin: 0, maxWidth: '400px' }}>
                          {copy.body}
                        </p>
                      </div>
                    </div>
                  );
                }

                const headingLabel: Record<typeof submissionDataTab, string> = {
                  account: 'Submission Attributes',
                  parties: 'Submission Parties',
                  locations: 'Shared Locations',
                  lines: 'Lines of business',
                };

                return (
                  <>
                    {/* Tab heading — styled to match the right column's "Needs Attention" heading */}
                    <div style={{ padding: '16px 16px 0 16px', flexShrink: 0 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#2e2e2e' }}>
                        {headingLabel[submissionDataTab]}
                      </h3>
                    </div>

                    {/* Submission Attributes — attribute mapping / extracted data panel.
                        Before reconciliation completes only the canonical-term column is shown. */}
                    {submissionDataTab === 'account' && <SubmissionInfoPanel onDirtyChange={handleSubTabDirty} canonicalOnly={notReady} />}

                    {/* Submission Parties — same grid as Lines of business, scoped to party lines */}
                    {submissionDataTab === 'parties' && (
                      <SubmissionLinesContainer
                        submissionId={typeof id === 'string' ? id : ''}
                        lobFilter="Parties"
                        showResolutionCards={false}
                        onDirtyChange={handleSubTabDirty}
                      />
                    )}

                    {/* Shared Locations — flat list of Location lines, no hierarchy */}
                    {submissionDataTab === 'locations' && (
                      <SubmissionLinesContainer
                        submissionId={typeof id === 'string' ? id : ''}
                        lobFilter="Shared Locations"
                        showResolutionCards={false}
                        onDirtyChange={handleSubTabDirty}
                      />
                    )}

                    {/* Submission Lines — shared container, every LOB, no resolution cards */}
                    {submissionDataTab === 'lines' && (
                      <SubmissionLinesContainer
                        submissionId={typeof id === 'string' ? id : ''}
                        lobFilter={['Property', 'General Liability']}
                        showResolutionCards={false}
                        onDirtyChange={handleSubTabDirty}
                      />
                    )}
                  </>
                );
              })()}
                  </div>
                </div>
              )}

              {/* Sub-tab switch guard — confirm discarding the active sub-tab's unsaved edits. */}
              {subTabPendingKey && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '420px', maxWidth: '90vw', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.24)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#B85C00"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#001e5b' }}>Discard unsaved changes?</h2>
                    </div>
                    <div style={{ padding: '20px 24px', fontSize: '13px', color: '#2e2e2e', lineHeight: '19px' }}>
                      You have unsaved edits on this tab. Switching tabs now will discard them.
                    </div>
                    <div style={{ padding: '12px 24px', backgroundColor: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button onClick={() => setSubTabPendingKey(null)} style={{ padding: '6px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', background: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Keep editing</button>
                      <button onClick={() => { subTabCancel.current(); subTabDirty.current = false; const key = subTabPendingKey; setSubTabPendingKey(null); setSubmissionDataTab(key); }} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Discard changes</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Top-level record-tab switch guard — leaving Submission Data with unsaved edits. */}
              {topTabPending && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '420px', maxWidth: '90vw', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.24)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#B85C00"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#001e5b' }}>Discard unsaved changes?</h2>
                    </div>
                    <div style={{ padding: '20px 24px', fontSize: '13px', color: '#2e2e2e', lineHeight: '19px' }}>
                      You have unsaved edits on the Submission Data tab. Leaving now will discard them.
                    </div>
                    <div style={{ padding: '12px 24px', backgroundColor: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button onClick={() => setTopTabPending(null)} style={{ padding: '6px 16px', border: '1px solid #c9c9c9', borderRadius: '4px', background: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Keep editing</button>
                      <button onClick={() => { subTabCancel.current(); subTabDirty.current = false; const run = topTabPending.run; setTopTabPending(null); run(); }} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Discard changes</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Details Tab Content */}
              {selectedTab === 'details' && (() => {
                // Helper to check if field should show value based on step config
                const detailsFieldsWithValues = stepConfig?.detailsFieldsWithValues;
                const shouldShowFieldValue = (fieldName: string) => {
                  return !detailsFieldsWithValues || detailsFieldsWithValues.includes(fieldName);
                };

                return (
                  <div style={{ padding: '16px' }}>
                    {/* Submission Information Section */}
                    <div style={{ marginBottom: '1px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: '#f3f3f3',
                        cursor: 'pointer'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#001e5b">
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                          </svg>
                          <span style={{ fontSize: '16px', fontWeight: 400, color: '#001e5b' }}>Submission Information</span>
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          {/* Left Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <EditableField fieldName="name" label="Submission Name" value={submission.name} />
                            <EditableField fieldName="insuredName" label="Account" value={submission.insuredName} isLink={true} />
                            <EditableField fieldName="lineOfBusiness" label="Line of Business" value={submission.lineOfBusiness || submission.policyType} />
                            <EditableField fieldName="stage" label="Stage" value={(() => {
                              const currentStageKey = stepConfig?.progressPath?.currentStage;
                              const stageLabel = stepConfig?.progressPath?.stages?.find((s: any) => s.key === currentStageKey)?.label;
                              return stageLabel || submission.stage || submission.status;
                            })()} />
                          </div>

                          {/* Right Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <EditableField fieldName="opportunityId" label="Opportunity" value={submission.opportunityId} />
                            <EditableField fieldName="priority" label="Priority" value={submission.priority || 'Medium'} />
                            <EditableField fieldName="dateSubmitted" label="Date Submitted" value={submission.dateSubmitted || submission.submissionDate} type="date" />
                            <EditableField fieldName="assignedTo" label="Assigned To" value="Martha (UW Team Lead)" />
                            <EditableField fieldName="isRenewal" label="Is Renewal" value={submission.isRenewal} type="checkbox" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Policy Details Section */}
                    <div style={{ marginBottom: '1px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: '#f3f3f3',
                        cursor: 'pointer'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#001e5b">
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                          </svg>
                          <span style={{ fontSize: '16px', fontWeight: 400, color: '#001e5b' }}>Policy Details</span>
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          {/* Left Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Effective Date</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('effectiveDate') ? submission.effectiveDate : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Coverage Types</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('coverageTypes') ? (submission.coverageTypes || '-') : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Insured State</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('insuredState') ? (submission.insuredState || '-') : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Right Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Expiration Date</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('expirationDate') ? submission.expirationDate : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Is Bound</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('isBound') ? (
                                    <input type="checkbox" checked={submission.isBound || false} disabled style={{ margin: 0 }} />
                                  ) : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Broker and Carrier Section */}
                    <div style={{ marginBottom: '1px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: '#f3f3f3',
                        cursor: 'pointer'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#001e5b">
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                          </svg>
                          <span style={{ fontSize: '16px', fontWeight: 400, color: '#001e5b' }}>Broker and Carrier</span>
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          {/* Left Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Broker</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('broker') ? submission.broker : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Broker Email</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('brokerEmail') ? (submission.brokerEmail || '-') : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Broker Phone</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('brokerPhone') ? (submission.brokerPhone || '-') : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Right Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Carrier</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('carrier') ? (submission.carrier || '-') : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Carrier Portal URL</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('carrierPortalUrl') ? (submission.carrierPortalUrl || '-') : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Financial Information Section */}
                    <div style={{ marginBottom: '1px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: '#f3f3f3',
                        cursor: 'pointer'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#001e5b">
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                          </svg>
                          <span style={{ fontSize: '16px', fontWeight: 400, color: '#001e5b' }}>Financial Information</span>
                        </div>
                      </div>
                      <div style={{ backgroundColor: 'white', padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          {/* Left Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Total Insured Value</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('totalInsuredValue')
                                    ? `$${(submission.totalInsuredValue || submission.coverageAmount)?.toLocaleString()}`
                                    : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Requested Premium</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('requestedPremium')
                                    ? `$${(submission.requestedPremium || submission.totalPremium)?.toLocaleString()}`
                                    : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Right Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Quoted Premium</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('quotedPremium')
                                    ? (submission.quotedPremium ? `$${submission.quotedPremium.toLocaleString()}` : '-')
                                    : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Bound Premium</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '13px', color: '#001e5b' }}>
                                  {shouldShowFieldValue('boundPremium')
                                    ? (submission.boundPremium ? `$${submission.boundPremium.toLocaleString()}` : '-')
                                    : '-'}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <svg width="14" height="14" viewBox="0 0 52 52" fill="#706E6B">
                                    <path d="M49.7 8.1L43.9 2.3c-.6-.6-1.5-.6-2.1 0l-4.2 4.2L48.1 16l1.6-1.6c.6-.6.6-1.5 0-2.1zM36.9 7.3L6.7 37.5c-.3.3-.5.7-.5 1.1l-.1 10.2c0 .8.7 1.5 1.5 1.4l10.2-.1c.4 0 .8-.2 1.1-.5l30.2-30.2L36.9 7.3z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                          onClick={() => { setUploadedFiles(['ACORD 140 - Property Section.pdf', 'Broker Cover Letter.pdf']); setIsUploadOpen(true); }}
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
                            const clsStatus = selectedDocument.status === 'Unable to Classify' ? 'Unable to Classify'
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
                              else if (text === 'Needs Manual' || text === 'Unable to Classify') { bg = '#fef5e8'; border = '#B85C00'; color = '#8a4500'; }
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
                            const classificationRequestId = `CLR-${String(selectedDocument.id).replace(/\D/g, '') || '0'}`.padEnd(0);
                            return (
                              <>
                                {/* Document Information */}
                                <div style={{ marginBottom: '24px' }}>
                                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b', marginBottom: '12px' }}>
                                    Document Information
                                  </h3>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      {infoField('Underwriting Submission', <span style={{ color: '#0176D3' }}>{submission.name}</span>)}
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
                                Classify and Extract
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

              {selectedTab === 'related' && (() => {
                // Quotes related list — Salesforce OOTB style. Stays empty until
                // Step 10, where the Generate Quote flow populates it.
                const quotes = currentStep >= 10 ? generatedQuotes : [];
                // ISO date (YYYY-MM-DD) → "May 13, 2026"; blank → em dash.
                const fmtDate = (iso: string) => {
                  if (!iso) return '—';
                  const [y, m, d] = iso.split('-').map(Number);
                  if (!y || !m || !d) return iso;
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return `${months[m - 1]} ${d}, ${y}`;
                };
                return (
                  <div style={{ padding: '16px' }}>
                    <div className="slds-card" style={{ border: '1px solid #e5e5e5', borderRadius: '8px', boxShadow: 'none' }}>
                      {/* Related list header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid #e5e5e5' }}>
                        <svg width="20" height="20" viewBox="0 0 52 52" fill="#5867E8" aria-hidden="true">
                          <use href={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/standard-sprite/svg/symbols.svg#quotes`} />
                        </svg>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b' }}>
                          Quotes ({quotes.length})
                        </span>
                      </div>

                      {quotes.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#706E6B', fontSize: '13px' }}>
                          No quotes to display.
                        </div>
                      ) : (
                        <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {['Name', 'Total Premium', 'Start Date', 'End Date'].map((col) => (
                                <th key={col} scope="col" style={{ textAlign: 'left', padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: '#514f4d', borderBottom: '1px solid #e5e5e5', backgroundColor: '#fafaf9' }}>
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {quotes.map((q) => (
                              <tr key={q.id} style={{ borderBottom: '1px solid #f3f3f3' }}>
                                <td style={{ padding: '10px 16px', fontSize: '13px' }}>
                                  <a href={`${ASSET_PREFIX}/quotes/${q.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); window.open(`${ASSET_PREFIX}/quotes/${q.id}`, '_blank'); }} style={{ color: '#0176D3', textDecoration: 'none' }}>{q.name}</a>
                                </td>
                                <td style={{ padding: '10px 16px', fontSize: '13px', color: q.rated ? '#2e2e2e' : '#a8a8a8' }}>{q.rated ? `$${q.premium.toLocaleString()}` : '—'}</td>
                                <td style={{ padding: '10px 16px', fontSize: '13px', color: '#2e2e2e' }}>{fmtDate(q.startDate)}</td>
                                <td style={{ padding: '10px 16px', fontSize: '13px', color: '#2e2e2e' }}>{fmtDate(q.endDate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })()}

              {selectedTab !== 'communication' && selectedTab !== 'submission-data' && selectedTab !== 'details' && selectedTab !== 'documents' && selectedTab !== 'related' && (
                <div style={{ padding: '48px', textAlign: 'center', color: '#706E6B' }}>
                  No {selectedTab.replace('-', ' ')} to display
                </div>
              )}
            </div>
          </div>
        </div>

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

        {/* Quote Success Toast — standard SLDS toast, top center */}
        {showQuoteToast && (
          <div
            className="slds-notify_container slds-is-fixed"
            style={{ top: '12px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10001 }}
          >
            <div className="slds-notify slds-notify_toast slds-theme_success" role="status">
              <span className="slds-assistive-text">success</span>
              <span className="slds-icon_container slds-icon-utility-success slds-m-right_small slds-no-flex slds-align-top">
                <svg className="slds-icon slds-icon_small" aria-hidden="true">
                  <use xlinkHref={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#success`} />
                </svg>
              </span>
              <div className="slds-notify__content">
                <h2 className="slds-text-heading_small">Quote was successfully created</h2>
              </div>
              <div className="slds-notify__close">
                <button
                  className="slds-button slds-button_icon slds-button_icon-inverse"
                  title="Close"
                  onClick={() => setShowQuoteToast(false)}
                >
                  <svg className="slds-button__icon slds-button__icon_large" aria-hidden="true">
                    <use xlinkHref={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/utility-sprite/svg/symbols.svg#close`} />
                  </svg>
                  <span className="slds-assistive-text">Close</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generate Quote Modal */}
        {isGenerateQuoteOpen && (
          <div
            onClick={() => setIsGenerateQuoteOpen(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10001,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                width: '880px',
                maxWidth: '90vw',
                maxHeight: '90vh',
                boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#001e5b', margin: 0 }}>
                  Select Lines Of Business to quote
                </h2>
                <p style={{ fontSize: '13px', color: '#706E6B', margin: '4px 0 0' }}>
                  Choose the lines of business to include in the quote. A single quote will be generated spanning all selected lines of business.
                </p>
              </div>

              {/* Body — quote-level fields + multiselect table */}
              <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#514f4d', marginBottom: '4px' }}>
                      Quote name
                    </label>
                    <input
                      type="text"
                      value={quoteNameInput}
                      placeholder="Quote name"
                      onChange={(e) => setQuoteNameInput(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '13px', color: '#2e2e2e', border: '1px solid #c9c9c9', borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: '0 1 160px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#514f4d', marginBottom: '4px' }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={quoteStartDate}
                      onChange={(e) => setQuoteStartDate(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '13px', color: '#2e2e2e', border: '1px solid #c9c9c9', borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: '0 1 160px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#514f4d', marginBottom: '4px' }}>
                      End Date
                    </label>
                    <input
                      type="date"
                      value={quoteEndDate}
                      onChange={(e) => setQuoteEndDate(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '13px', color: '#2e2e2e', border: '1px solid #c9c9c9', borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', padding: '8px 12px', borderBottom: '1px solid #e5e5e5' }}>
                        <input
                          type="checkbox"
                          checked={quoteLobSelection.size === QUOTE_LOB_OPTIONS.length}
                          ref={(el) => {
                            if (el) el.indeterminate = quoteLobSelection.size > 0 && quoteLobSelection.size < QUOTE_LOB_OPTIONS.length;
                          }}
                          onChange={(e) => {
                            setQuoteLobSelection(e.target.checked ? new Set(QUOTE_LOB_OPTIONS.map((o) => o.lob)) : new Set());
                          }}
                        />
                      </th>
                      {['Line Of Business', 'Mapped Product'].map((col) => (
                        <th key={col} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#514f4d', borderBottom: '1px solid #e5e5e5', backgroundColor: '#fafaf9' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {QUOTE_LOB_OPTIONS.map((o) => {
                      const checked = quoteLobSelection.has(o.lob);
                      const toggle = () => {
                        setQuoteLobSelection((prev) => {
                          const next = new Set(prev);
                          if (next.has(o.lob)) next.delete(o.lob);
                          else next.add(o.lob);
                          return next;
                        });
                      };
                      return (
                        <tr key={o.lob} onClick={toggle} style={{ cursor: 'pointer', borderBottom: '1px solid #f3f3f3' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <input type="checkbox" checked={checked} onChange={toggle} onClick={(e) => e.stopPropagation()} />
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#2e2e2e' }}>{o.lob}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: '#2e2e2e' }}>{o.product}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 24px', backgroundColor: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => setIsGenerateQuoteOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #c9c9c9', backgroundColor: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateQuote}
                  disabled={quoteLobSelection.size === 0}
                  style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: quoteLobSelection.size === 0 ? '#c9c9c9' : '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: quoteLobSelection.size === 0 ? 'not-allowed' : 'pointer' }}
                >
                  Generate Quote
                </button>
              </div>
            </div>
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

        {/* Demo Flow Controller */}
        <DemoFlowController
          showErrorToggle={currentStep === 1}
          errorChecked={step1TaskView === 'error'}
          onErrorToggle={(checked) => setStep1TaskView(checked ? 'error' : 'working')}
        />

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

        {/* Upload Files Modal — mirrors the standard Salesforce file-upload experience */}
        {isUploadOpen && (
          <div
            onClick={() => setIsUploadOpen(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'white', borderRadius: '8px',
                width: '560px', maxWidth: '95%', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
              }}
            >
              {/* Header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#001e5b', margin: 0 }}>Upload Files</h2>
                <button
                  onClick={() => setIsUploadOpen(false)}
                  title="Close"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#5c5c5c">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
                {/* Base SLDS file selector */}
                <div className="slds-form-element">
                  <div
                    className={`slds-form-element__control slds-file-selector slds-file-selector_files${isUploadDragging ? ' slds-has-drag-over' : ''}`}
                  >
                    <div
                      className="slds-file-selector__dropzone"
                      onDragOver={(e) => { e.preventDefault(); setIsUploadDragging(true); }}
                      onDragLeave={() => setIsUploadDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsUploadDragging(false);
                        const names = Array.from(e.dataTransfer.files || []).map((f) => f.name);
                        if (names.length) setUploadedFiles((prev) => [...prev, ...names]);
                      }}
                    >
                      <input
                        ref={uploadInputRef}
                        type="file"
                        multiple
                        className="slds-file-selector__input slds-assistive-text"
                        accept="*"
                        id="submission-file-upload"
                        onChange={(e) => {
                          const names = Array.from(e.target.files || []).map((f) => f.name);
                          if (names.length) setUploadedFiles((prev) => [...prev, ...names]);
                          e.target.value = '';
                        }}
                      />
                      <label className="slds-file-selector__body" htmlFor="submission-file-upload">
                        <span className="slds-file-selector__button slds-button slds-button_neutral">
                          <Icon
                            assistiveText={{ label: 'Upload' }}
                            category="utility"
                            name="upload"
                            size="x-small"
                            className="slds-button__icon slds-button__icon_left"
                          />
                          Upload Files
                        </span>
                        <span className="slds-file-selector__text slds-medium-show">
                          Or drop files
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Selected files list */}
                {uploadedFiles.length > 0 && (
                  <div style={{ marginTop: '16px', border: '1px solid #e5e5e5', borderRadius: '6px', overflow: 'hidden' }}>
                    {uploadedFiles.map((name, idx) => (
                      <div
                        key={`${name}-${idx}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px',
                          borderBottom: idx === uploadedFiles.length - 1 ? 'none' : '1px solid #f3f3f3',
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0176D3" style={{ flexShrink: 0 }}>
                          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                        </svg>
                        <span style={{ flex: 1, fontSize: '13px', color: '#2e2e2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <span style={{ fontSize: '11px', color: '#2E844A', fontWeight: 600, flexShrink: 0 }}>Ready</span>
                        <button
                          onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}
                          title="Remove"
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#706E6B">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 24px', borderTop: '1px solid #e5e5e5', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => setIsUploadOpen(false)}
                  style={{ padding: '8px 20px', border: '1px solid #c9c9c9', borderRadius: '4px', backgroundColor: 'white', color: '#001e5b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsUploadOpen(false)}
                  disabled={uploadedFiles.length === 0}
                  style={{
                    padding: '8px 20px', border: '1px solid #c9c9c9', borderRadius: '4px',
                    backgroundColor: 'white',
                    color: uploadedFiles.length === 0 ? '#939393' : '#001e5b',
                    fontSize: '13px', fontWeight: 600,
                    cursor: uploadedFiles.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setClassifyDocNames(uploadedFiles.length ? [...uploadedFiles] : ['Uploaded Document']);
                    setIsUploadOpen(false);
                  }}
                  disabled={uploadedFiles.length === 0}
                  style={{
                    padding: '8px 20px', border: 'none', borderRadius: '4px',
                    backgroundColor: uploadedFiles.length === 0 ? '#c9c9c9' : '#0176D3',
                    color: 'white', fontSize: '13px', fontWeight: 600,
                    cursor: uploadedFiles.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Classify and Extract
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Classify Document Modal */}
        {(() => {
          const doc = documents.find((d: any) => d.id === classifyDocumentId);
          const fromUpload = classifyDocNames.length > 0;
          const isOpen = !!classifyDocumentId || fromUpload;
          const names = fromUpload ? classifyDocNames : [doc?.name || 'Document'];
          const existingExtractionsByName: Record<string, { documentCategory: string; documentType: string; location: string; status: string }[]> = {};
          if (doc && !fromUpload) {
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
              isOpen={isOpen}
              documentNames={names}
              runClassification={fromUpload}
              existingExtractionsByName={existingExtractionsByName}
              onClose={() => { setClassifyDocumentId(null); setClassifyDocNames([]); }}
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
      </div>
    </IconSettings>
  );
}

// Static export needs every dynamic route pre-rendered. The page itself reads `id`
// from router.query on the client, so props are empty — we only enumerate the paths.
export async function getStaticPaths() {
  return {
    paths: mockSubmissions.map((s) => ({ params: { id: s.id } })),
    fallback: false,
  };
}

export async function getStaticProps() {
  return { props: {} };
}
