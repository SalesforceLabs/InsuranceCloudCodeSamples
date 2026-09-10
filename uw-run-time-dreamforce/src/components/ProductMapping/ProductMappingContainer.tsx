import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  productCatalog,
  SellableProduct,
  ProductNode,
  ProductAttrStatus,
} from '@/data/mockSubmissionLines';

interface ProductMappingContainerProps {
  submissionId: string;
  lob?: string;
}

// Outcome badge palette (matches CLAUDE.md status colors).
const OUTCOME_STYLE: Record<SellableProduct['outcome'], { fg: string; bg: string }> = {
  Assigned: { fg: '#2E844A', bg: '#e7f5ec' },
  Triaged: { fg: '#B85C00', bg: '#fef5e8' },
  Unmatched: { fg: '#939393', bg: '#f3f3f3' },
};

const STATUS_META: Record<ProductAttrStatus, { label: string; fg: string; bg: string }> = {
  present: { label: 'Mapped & present', fg: '#2E844A', bg: '#e7f5ec' },
  missing: { label: 'Mapped & missing', fg: '#B85C00', bg: '#fef5e8' },
  unmapped: { label: 'Unmapped', fg: '#706E6B', bg: '#f3f3f3' },
};

const SCORE_ROWS: { key: keyof SellableProduct['scores']; label: string }[] = [
  { key: 'attributePresence', label: 'Attribute Presence' },
  { key: 'coverageDensity', label: 'Coverage Density' },
  { key: 'coverageAttribute', label: 'Coverage Attribute' },
];

// Inline-edit cell treatments — mirror LOB Data (SubmissionLinesContainer): edited cell shows the
// SLDS dirty-yellow fill, hovered/active cell gets a white fill + thin border.
const DIRTY_CELL_STYLE: React.CSSProperties = {
  backgroundColor: '#fdf6e3',
  boxShadow: 'inset 3px 0 0 #B85C00',
  borderRadius: '2px',
};
const EDIT_CELL_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow: 'inset 0 0 0 1px #c9c9c9',
  borderRadius: '2px',
};

const PANEL_ANIM_MS = 260;

function scoreColor(pct: number): string {
  if (pct >= 75) return '#2E844A';
  if (pct >= 50) return '#B85C00';
  return '#c23934';
}

function ScoreBar({ label, pct }: { label: string; pct: number }) {
  const color = scoreColor(pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '11px', color: '#5c5c5c', width: '112px', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: '6px', backgroundColor: '#eef1f6', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '3px' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#2e2e2e', width: '34px', textAlign: 'right', flexShrink: 0 }}>
        {pct}%
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: ProductAttrStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 600,
        color: m.fg,
        backgroundColor: m.bg,
        padding: '2px 8px',
        borderRadius: '10px',
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  );
}

export default function ProductMappingContainer({ submissionId, lob }: ProductMappingContainerProps) {
  const products = productCatalog[submissionId] || [];
  const initialProduct = products.find((p) => p.recommended)?.id || products[0]?.id || null;

  const [selectedProductId, setSelectedProductId] = useState<string | null>(initialProduct);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Resizable tree column (mirrors SubmissionLinesContainer LOB Data).
  const [treeWidth, setTreeWidth] = useState(320);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);

  // Split panel open/close from "which node" so content persists during slide-out.
  const [panelNodeId, setPanelNodeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inline value editing (mirrors LOB Data > Attributes > Value column). Edits are keyed by
  // `${nodeId}::${attrIndex}`; editing one sets the source to "Manual". `dirtyCells` drives the
  // yellow fill + sticky footer; `editingKey`/`hoverKey` drive the active-edit affordance.
  const [valueEdits, setValueEdits] = useState<Record<string, string>>({});
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const dirtyReverts = useRef<Record<string, string | undefined>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const isDirty = dirtyCells.size > 0;

  // Footer pinned to the viewport bottom and width-matched to the detail pane, riding up with the
  // pane's bottom edge once it scrolls into view (same behavior as LOB Data).
  const detailPaneRef = useRef<HTMLDivElement | null>(null);
  const [footerMetrics, setFooterMetrics] = useState<{ left: number; width: number; bottom: number } | null>(null);

  const commitValue = (key: string, prev: string, next: string) => {
    setEditingKey(null);
    if (next === prev) return;
    if (!(key in dirtyReverts.current)) dirtyReverts.current[key] = valueEdits[key];
    setValueEdits((m) => ({ ...m, [key]: next }));
    setDirtyCells((s) => { const n = new Set(s); n.add(key); return n; });
  };
  const saveDirty = () => {
    dirtyReverts.current = {};
    setDirtyCells(new Set());
  };
  const cancelDirty = () => {
    setValueEdits((m) => {
      const n = { ...m };
      Object.entries(dirtyReverts.current).forEach(([k, v]) => {
        if (v === undefined) delete n[k];
        else n[k] = v;
      });
      return n;
    });
    dirtyReverts.current = {};
    setDirtyCells(new Set());
    setEditingKey(null);
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;

  // When the product changes, expand its whole tree and clear any open node.
  const [syncedProductId, setSyncedProductId] = useState<string | null>(null);
  if (selectedProduct && syncedProductId !== selectedProduct.id) {
    setSyncedProductId(selectedProduct.id);
    setSelectedNodeId(null);
    setExpandedIds(new Set(selectedProduct.structure.map((n) => n.id)));
  }

  // Drive the slide animation off selectedNodeId.
  useEffect(() => {
    if (selectedNodeId) {
      if (panelCloseTimer.current) { clearTimeout(panelCloseTimer.current); panelCloseTimer.current = null; }
      setPanelNodeId(selectedNodeId);
      const raf = requestAnimationFrame(() => setPanelOpen(true));
      return () => cancelAnimationFrame(raf);
    }
    setPanelOpen(false);
    panelCloseTimer.current = setTimeout(() => setPanelNodeId(null), PANEL_ANIM_MS);
    return undefined;
  }, [selectedNodeId]);

  // Keep the fixed footer aligned to the detail pane while scrolling/resizing.
  useEffect(() => {
    if (!isDirty) { setFooterMetrics(null); return; }
    const measure = () => {
      const el = detailPaneRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setFooterMetrics({ left: r.left, width: r.width, bottom: Math.max(0, window.innerHeight - r.bottom) });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [isDirty, treeWidth, panelNodeId]);

  const startTreeResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = treeWidth;
    const rect = treeContainerRef.current?.getBoundingClientRect();
    const maxWidth = rect ? rect.width - 360 : 720;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(Math.max(startWidth + (ev.clientX - startX), 240), Math.max(maxWidth, 240));
      setTreeWidth(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [treeWidth]);

  if (lob !== 'Property' || products.length === 0) {
    return (
      <div style={{ padding: '64px 24px', textAlign: 'center', color: '#5c5c5c' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="#c9c9c9" style={{ marginBottom: '12px' }} aria-hidden="true">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#2e2e2e', marginBottom: '4px' }}>
          No product mapping available
        </div>
        <div style={{ fontSize: '13px', maxWidth: '360px', margin: '0 auto' }}>
          Product fit scoring is configured for Commercial Property lines. Candidate products will appear here once
          scoring runs for this line of business.
        </div>
      </div>
    );
  }

  const structure = selectedProduct?.structure || [];
  const panelNode = structure.find((n) => n.id === panelNodeId) || null;
  const isPanelOpen = !!selectedNodeId;

  const toggleNode = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTreeNode = (node: ProductNode, level: number): React.ReactNode => {
    const children = structure.filter((n) => n.parentId === node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
      <React.Fragment key={node.id}>
        <div
          onClick={() => setSelectedNodeId(node.id)}
          style={{
            display: 'grid',
            gridTemplateColumns: isPanelOpen ? 'minmax(0,1fr)' : 'minmax(0,1.6fr) minmax(0,1fr)',
            alignItems: 'center',
            padding: '8px 12px',
            paddingLeft: `${8 + level * 16}px`,
            cursor: 'pointer',
            borderBottom: '1px solid #f3f3f3',
            borderLeft: isSelected ? '3px solid #0176D3' : '3px solid transparent',
            backgroundColor: isSelected ? '#e8f1fb' : 'transparent',
            fontSize: '13px',
            lineHeight: '18px',
          }}
          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', color: '#0176D3', flexShrink: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                </svg>
              </button>
            ) : (
              <span style={{ width: '14px', flexShrink: 0 }} />
            )}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isSelected ? '#001e5b' : '#0176D3',
                fontWeight: isSelected ? 600 : 400,
              }}
              title={node.name}
            >
              {node.name}
            </span>
          </div>
          {!isPanelOpen && (
            <div
              style={{ fontSize: '12px', color: '#5c5c5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '8px' }}
              title={node.classification}
            >
              {node.classification}
            </div>
          )}
        </div>
        {isExpanded && children.map((c) => renderTreeNode(c, level + 1))}
      </React.Fragment>
    );
  };

  const rootNodes = structure.filter((n) => n.parentId === null);

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
      {/* Heading */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#2e2e2e', margin: '0 0 4px' }}>Mapped Products</h3>
        <div style={{ fontSize: '12px', color: '#5c5c5c' }}>
          Top candidate products scored against this submission. Select a product to view its structure and attribute
          mapping.
        </div>
      </div>

      {/* Visual-picker tiles */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {products.map((p) => {
          const isSel = selectedProductId === p.id;
          const oc = OUTCOME_STYLE[p.outcome];
          return (
            <button
              key={p.id}
              onClick={() => setSelectedProductId(p.id)}
              style={{
                flex: '1 1 300px',
                minWidth: '280px',
                maxWidth: '420px',
                textAlign: 'left',
                border: isSel ? '2px solid #0176D3' : '1px solid #dddbda',
                borderRadius: '8px',
                backgroundColor: isSel ? '#f4f9fe' : 'white',
                padding: '14px 16px',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isSel ? '0 1px 4px rgba(1,118,211,0.18)' : 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              {isSel && (
                <span style={{ position: 'absolute', top: '12px', right: '12px', display: 'inline-flex' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0176D3" aria-label="Selected">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </span>
              )}
              {p.recommended && (
                <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, color: '#0176D3', backgroundColor: '#e8f1fb', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                  Recommended
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingRight: isSel ? '24px' : 0 }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#001e5b' }}>{p.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: oc.fg, backgroundColor: oc.bg, padding: '2px 8px', borderRadius: '10px' }}>
                  {p.outcome}
                </span>
                <span style={{ fontSize: '11px', color: '#939393' }}>{p.classification}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Create Quote — right-aligned below the product tiles */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          style={{ height: '32px', padding: '0 16px', border: 'none', borderRadius: '4px', backgroundColor: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#014486'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0176D3'; }}
        >
          Create Quote
        </button>
      </div>

      {/* Summary · Scores · Missing — side-by-side, gutter-separated (no cards) */}
      {selectedProduct && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)', gap: '32px' }}>
          {/* Summary */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
              Summary
            </div>
            <div style={{ fontSize: '13px', color: '#2e2e2e', lineHeight: '19px' }}>
              {selectedProduct.summary}
            </div>
          </div>

          {/* Scores */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
              Scores
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SCORE_ROWS.map((s) => (
                <ScoreBar key={s.key} label={s.label} pct={selectedProduct.scores[s.key]} />
              ))}
            </div>
          </div>

          {/* Missing */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
              Missing
            </div>
            {selectedProduct.missingLines.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#2E844A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#2E844A" aria-hidden="true">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                All submission lines mapped
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedProduct.missingLines.map((name) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2e2e2e' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#B85C00" style={{ flexShrink: 0 }} aria-hidden="true">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                    </svg>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tree + detail (mirrors LOB Data tree-grid interaction) */}
      {selectedProduct && (
        <div
          ref={treeContainerRef}
          style={{ display: 'flex', gap: 0, border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden', flex: 1, minHeight: '360px' }}
        >
          {/* Tree */}
          <div style={{ flex: isPanelOpen ? `0 0 ${treeWidth}px` : '1 1 auto', minWidth: 0, overflowY: 'auto', backgroundColor: 'white' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isPanelOpen ? 'minmax(0,1fr)' : 'minmax(0,1.6fr) minmax(0,1fr)',
                padding: '8px 12px',
                borderBottom: '1px solid #e5e5e5',
                backgroundColor: '#fafaf9',
                fontSize: '11px',
                fontWeight: 600,
                color: '#5c5c5c',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              <div>Name</div>
              {!isPanelOpen && <div style={{ paddingLeft: '8px' }}>Product Classification</div>}
            </div>
            {rootNodes.map((n) => renderTreeNode(n, 0))}
          </div>

          {/* Resize divider */}
          {isPanelOpen && (
            <div
              onMouseDown={startTreeResize}
              style={{ flex: '0 0 6px', cursor: 'col-resize', backgroundColor: '#e5e5e5', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0176D3'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e5e5e5'; }}
            >
              <div style={{ width: '4px', height: '32px', borderRadius: '2px', backgroundColor: '#939393', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', pointerEvents: 'none' }}>
                <span style={{ width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'white' }} />
                <span style={{ width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'white' }} />
                <span style={{ width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'white' }} />
              </div>
            </div>
          )}

          {/* Detail panel (slides in) */}
          {panelNode && (
            <div
              ref={detailPaneRef}
              style={{
                flex: 1,
                minWidth: 0,
                borderLeft: '1px solid #e5e5e5',
                overflowY: 'auto',
                backgroundColor: 'white',
                paddingBottom: isDirty ? '72px' : 0,
                transform: panelOpen ? 'translateX(0)' : 'translateX(24px)',
                opacity: panelOpen ? 1 : 0,
                transition: `transform ${PANEL_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${PANEL_ANIM_MS}ms`,
              }}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {panelNode.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#939393', marginTop: '2px' }}>
                    {panelNode.classification}
                    {panelNode.cardinality && (
                      <>
                        {' · '}
                        {panelNode.cardinality.required ? 'Required' : 'Optional'}
                        {' · Qty '}
                        {panelNode.cardinality.defaultQty}
                        {' · Min '}
                        {panelNode.cardinality.min}
                        {' / Max '}
                        {panelNode.cardinality.max ?? '∞'}
                      </>
                    )}
                  </div>
                </div>
                {/* Close */}
                <button
                  onClick={() => setSelectedNodeId(null)}
                  aria-label="Close"
                  style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #c9c9c9', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5c5c5c', flexShrink: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>

              {/* Attributes */}
              {(!panelNode.attributes || panelNode.attributes.length === 0) ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: '#939393' }}>
                  No product attributes for this component.
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr', backgroundColor: '#efefef', fontSize: '11px', fontWeight: 600, color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    <div style={{ padding: '8px 12px' }}>Attribute</div>
                    <div style={{ padding: '8px 12px' }}>Value</div>
                    <div style={{ padding: '8px 12px' }}>Source</div>
                    <div style={{ padding: '8px 12px' }}>Status</div>
                  </div>
                  {panelNode.attributes.map((a, i) => {
                    const key = `${panelNode.id}::${i}`;
                    const edited = key in valueEdits;
                    const value = edited ? valueEdits[key] : a.value;
                    // A manual edit sets the source to "Manual"; otherwise use the attribute's own
                    // source (blank for missing/unmapped, so the Source cell shows "—").
                    const source = edited ? 'Manual' : a.source;
                    const isEditing = editingKey === key;
                    const editActive = hoverKey === key || isEditing;
                    const cellDirty = dirtyCells.has(key);
                    return (
                      <div key={`${a.attribute}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr', borderBottom: '1px solid #f3f3f3', fontSize: '13px', alignItems: 'center' }}>
                        <div style={{ padding: '8px 12px', color: '#2e2e2e', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive && !cellDirty ? { backgroundColor: '#f3f3f3' } : {}) }} title={a.attribute}>{a.attribute}</div>
                        {/* Value — inline editable (matches LOB Data Attributes > Value column) */}
                        <div
                          onMouseEnter={() => setHoverKey(key)}
                          onMouseLeave={() => setHoverKey((prev) => (prev === key ? null : prev))}
                          style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px', ...(cellDirty ? DIRTY_CELL_STYLE : editActive ? EDIT_CELL_STYLE : {}) }}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={value}
                              placeholder="Enter a value"
                              onBlur={(e) => commitValue(key, a.value, e.target.value.trim())}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                else if (e.key === 'Escape') setEditingKey(null);
                              }}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '13px', border: '1px solid #0176D3', borderRadius: '4px', boxSizing: 'border-box', color: '#2e2e2e' }}
                            />
                          ) : (
                            <>
                              <span
                                onClick={() => setEditingKey(key)}
                                title="Click to enter a value"
                                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', color: value ? '#2e2e2e' : '#939393' }}
                              >
                                {value || <span style={{ fontStyle: 'italic' }}>Add value</span>}
                              </span>
                              {editActive && (
                                <button
                                  type="button"
                                  onClick={() => setEditingKey(key)}
                                  title="Edit value"
                                  aria-label="Edit value"
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', background: 'none', padding: '2px', cursor: 'pointer' }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#0176D3"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        <div style={{ padding: '8px 12px', color: source ? '#5c5c5c' : '#c9c9c9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(editActive && !cellDirty ? { backgroundColor: '#f3f3f3' } : {}) }} title={source}>{source || '—'}</div>
                        <div style={{ padding: '8px 12px', ...(editActive && !cellDirty ? { backgroundColor: '#f3f3f3' } : {}) }}><StatusPill status={a.status} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky Save/Cancel footer — pinned to the viewport bottom, width-matched to the detail
          pane (matches LOB Data > Attributes). */}
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
    </div>
  );
}
