import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { IconSettings, Button, ButtonGroup } from '@salesforce/design-system-react';
import GlobalHeader from '@/components/Navigation/GlobalHeader';
import { mockSubmissionLines, computeQuotePricing, QuoteLinePrice } from '@/data/mockSubmissionLines';
import { mockSubmissions } from '@/data/mockSubmissions';
import { InsuranceSubmissionLine } from '@/types/InsuranceSubmission';

// Base path prefix for static assets under public/ (empty locally, set for GitHub Pages).
const ASSET_PREFIX = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || '';

const DEFAULT_SUBMISSION_ID = 'a00SB00001ARehdYAD';
const DEFAULT_DATA_LOB = 'Property';

const LOB_DISPLAY: Record<string, string> = {
  Property: 'Commercial Property',
  'General Liability': 'General Liability',
};

type QuoteTab = 'configure' | 'details' | 'related';

interface StoredQuote {
  id: string;
  name: string;
  submissionId: string;
  // New quotes span multiple LOBs; legacy single-LOB quotes carry dataLob/product.
  dataLobs?: string[];
  products?: string[];
  dataLob?: string;
  product?: string;
  premium: number;
  createdOn: string;
  status: string;
  rated?: boolean;
  startDate?: string;
  endDate?: string;
}

const fmt = (n: number) => `$${n.toLocaleString()}`;

export default function QuoteRecordPage() {
  const router = useRouter();
  const rawId = router.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId || '';

  // Resolve this quote's stored metadata (persisted by the Generate Quote flow) so
  // we know which LOB hierarchy to price. Falls back to Commercial Property for
  // direct navigation / static builds.
  const [stored, setStored] = useState<StoredQuote | null>(null);
  const [isRated, setIsRated] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !id) return;
    try {
      const raw = localStorage.getItem('uw_generated_quotes');
      if (raw) {
        const all: StoredQuote[] = JSON.parse(raw);
        const match = all.find((q) => q.id === id) || null;
        setStored(match);
        // Demo reset: a genuine browser reload clears this quote's pricing (grid +
        // header go blank, and the persisted rated flag is cleared so the
        // submission's Related list reflects the unpriced state too).
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (nav?.type === 'reload') {
          if (match?.rated) {
            localStorage.setItem(
              'uw_generated_quotes',
              JSON.stringify(all.map((q) => (q.id === id ? { ...q, rated: false } : q)))
            );
          }
        } else if (match?.rated) {
          setIsRated(true);
        }
      }
    } catch {
      /* ignore malformed cache */
    }
  }, [id]);

  // Rate Quote fills the grid and surfaces the Total Premium — here and in the
  // submission's Related list — by flipping the persisted `rated` flag.
  const rateQuote = () => {
    setIsRated(true);
    if (typeof window === 'undefined' || !id) return;
    try {
      const raw = localStorage.getItem('uw_generated_quotes');
      if (raw) {
        const all: StoredQuote[] = JSON.parse(raw);
        localStorage.setItem(
          'uw_generated_quotes',
          JSON.stringify(all.map((q) => (q.id === id ? { ...q, rated: true } : q)))
        );
      }
    } catch {
      /* ignore quota errors */
    }
  };

  const quoteName = stored?.name || (id ? `Q-${id.replace(/^quote-/, '')}` : 'Quote');
  const submissionId = stored?.submissionId || DEFAULT_SUBMISSION_ID;
  const dataLobs = stored?.dataLobs ?? (stored?.dataLob ? [stored.dataLob] : [DEFAULT_DATA_LOB]);
  const products = stored?.products ?? (stored?.product ? [stored.product] : ['Commercial Property Policy']);
  const dataLobsKey = dataLobs.join('|');

  const [selectedTab, setSelectedTab] = useState<QuoteTab>('configure');

  const lobLines = useMemo(
    () =>
      mockSubmissionLines.filter(
        (l) => l.insuranceSubmissionId === submissionId && !!l.lineOfBusiness && dataLobs.includes(l.lineOfBusiness)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submissionId, dataLobsKey]
  );
  const rootLines = useMemo(() => lobLines.filter((l) => l.parentLineId === null), [lobLines]);

  // Deterministic, stored pricing — the same numbers fill the grid every time
  // Rate Quote is clicked.
  const pricing = useMemo(() => computeQuotePricing(lobLines), [lobLines]);
  const lobTotal = rootLines.reduce((sum, r) => sum + (pricing[r.id]?.total ?? 0), 0);
  const headerTotalPremium = stored?.premium ?? lobTotal;

  // Only the first level is open by default: root nodes expanded, their subtrees collapsed.
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpandedNodes(new Set(rootLines.map((l) => l.id)));
  }, [rootLines]);

  const toggleNode = (lineId: string) =>
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });

  const COLS = 'minmax(280px, 1.6fr) repeat(4, minmax(0, 1fr))';

  const priceCell = (value: number | undefined) => (
    <span style={{ color: isRated ? '#2e2e2e' : '#a8a8a8' }}>
      {isRated && value != null ? fmt(value) : '—'}
    </span>
  );

  const renderRow = (line: InsuranceSubmissionLine, level = 0): React.ReactNode => {
    const children = lobLines.filter((l) => l.parentLineId === line.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(line.id);
    const p: QuoteLinePrice | undefined = pricing[line.id];
    return (
      <React.Fragment key={line.id}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: COLS,
            alignItems: 'stretch',
            borderBottom: '1px solid #f3f3f3',
            fontSize: '13px',
            lineHeight: '18px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f7fb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {/* Quote Line (Name of Node) — link-styled, no action */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 8px',
              paddingLeft: `${8 + level * 16}px`,
              minWidth: 0,
            }}
          >
            {hasChildren ? (
              <button
                onClick={() => toggleNode(line.id)}
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
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                >
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
                color: '#0176D3',
                fontWeight: level === 0 ? 600 : 400,
              }}
            >
              {line.name}
            </span>
          </div>

          {/* Premium / Tax / Fee / Total */}
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{priceCell(p?.premium)}</div>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{priceCell(p?.tax)}</div>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{priceCell(p?.fee)}</div>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontWeight: 600 }}>{priceCell(p?.total)}</div>
        </div>
        {isExpanded && children.map((child) => renderRow(child, level + 1))}
      </React.Fragment>
    );
  };

  const tabs: { key: QuoteTab; label: string }[] = [
    { key: 'configure', label: 'Configure Quote' },
    { key: 'details', label: 'Details' },
    { key: 'related', label: 'Related' },
  ];

  const submissionName = mockSubmissions.find((s) => s.id === submissionId)?.name || submissionId;
  const submissionHref = `${ASSET_PREFIX}/submissions/${submissionId}`;
  const headerDetails: { label: string; content: React.ReactNode }[] = [
    { label: 'Status', content: stored?.status || 'Draft' },
    {
      label: 'Submission',
      content: (
        <a
          href={submissionHref}
          onClick={(e) => { e.preventDefault(); window.open(submissionHref, '_blank'); }}
          style={{ color: '#0176D3', textDecoration: 'none' }}
        >
          {submissionName}
        </a>
      ),
    },
    { label: 'Line of Business', content: dataLobs.map((d) => LOB_DISPLAY[d] || d).join(', ') },
    { label: 'Total Premium', content: isRated ? fmt(headerTotalPremium) : '—' },
  ];

  return (
    <IconSettings iconPath={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons`}>
      <div style={{ backgroundColor: '#f3f3f3', minHeight: '100vh' }}>
        <GlobalHeader />

        <div style={{ padding: '16px 24px' }}>
          {/* Record header — mirrors the submission record header (icon, eyebrow,
              large navy title, small-label detail fields, right-aligned actions). */}
          <div style={{ backgroundColor: 'white', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden' }}>
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
                flexShrink: 0,
              }}>
                <svg style={{ width: '20px', height: '20px', fill: 'white' }} viewBox="0 0 52 52">
                  <use href={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons/standard-sprite/svg/symbols.svg#quotes`} />
                </svg>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '4px' }}>Quote</div>
                <h1 style={{ fontSize: '28px', fontWeight: 400, color: '#001e5b', margin: 0, lineHeight: '35px', marginBottom: '16px' }}>
                  {quoteName}
                </h1>

                {/* Detail fields */}
                <div style={{ display: 'flex', gap: '80px', flexWrap: 'wrap' }}>
                  {headerDetails.map((d) => (
                    <div key={d.label}>
                      <div style={{ fontSize: '12px', color: '#5c5c5c', marginBottom: '2px', lineHeight: '16px' }}>{d.label}</div>
                      <div style={{ fontSize: '13px', color: '#001e5b', lineHeight: '18px' }}>{d.content}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ flexShrink: 0 }}>
                <ButtonGroup id="quote-header-actions">
                  <Button label="Edit" />
                  <Button label="Clone" />
                  <Button label="Delete" />
                </ButtonGroup>
              </div>
            </div>
          </div>

          {/* Tab section */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderBottom: '1px solid #dddbda', display: 'flex', padding: '0 16px' }}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSelectedTab(t.key)}
                  style={{
                    padding: '16px 16px 14px 16px',
                    border: 'none',
                    background: 'none',
                    fontSize: '13px',
                    fontWeight: selectedTab === t.key ? 600 : 400,
                    color: selectedTab === t.key ? '#0176D3' : '#706E6B',
                    borderBottom: selectedTab === t.key ? '2px solid #0176D3' : '2px solid transparent',
                    marginBottom: '-1px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: '16px' }}>
              {selectedTab === 'configure' && (
                <>
                  {/* Rate Quote action, right-aligned above the grid */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <button
                      onClick={rateQuote}
                      style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#0176D3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Rate Quote
                    </button>
                  </div>

                  {/* Quote tree grid */}
                  <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
                    {/* Header row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: COLS,
                        backgroundColor: '#fafaf9',
                        borderBottom: '1px solid #e5e5e5',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#514f4d',
                      }}
                    >
                      <div style={{ padding: '8px 8px' }}>Quote Line</div>
                      {['Premium', 'Tax', 'Fee', 'Total'].map((col) => (
                        <div key={col} style={{ padding: '8px 12px', textAlign: 'right' }}>{col}</div>
                      ))}
                    </div>
                    {rootLines.map((line) => renderRow(line, 0))}
                  </div>
                </>
              )}

              {selectedTab === 'details' && (
                <div style={{ padding: '32px', textAlign: 'center', color: '#706E6B', fontSize: '13px' }}>
                  No details to display.
                </div>
              )}

              {selectedTab === 'related' && (
                <div style={{ padding: '32px', textAlign: 'center', color: '#706E6B', fontSize: '13px' }}>
                  No related records to display.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </IconSettings>
  );
}

// Static export needs dynamic routes pre-rendered. Quote ids are generated at
// runtime (quote-42501, quote-42502, …); enumerate a range so the demo's
// generated quotes resolve. The page reads `id` from router.query client-side.
export async function getStaticPaths() {
  const paths = Array.from({ length: 20 }, (_, i) => ({ params: { id: `quote-${42501 + i}` } }));
  return { paths, fallback: false };
}

export async function getStaticProps() {
  return { props: {} };
}
