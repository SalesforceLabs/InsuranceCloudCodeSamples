import React, { useState, useEffect } from 'react';

interface ClassificationRow {
  id: string;
  pages: string;
  documentCategory: string;
  documentType: string;
}

interface ExistingExtraction {
  documentCategory: string;
  documentType: string;
  location: string;
  status: string;
}

interface DocState {
  name: string;
  containsMultiple: boolean;
  rows: ClassificationRow[];
}

interface ClassifyDocumentModalProps {
  isOpen: boolean;
  documentNames: string[];
  onClose: () => void;
  onSave?: (docs: { name: string; rows: ClassificationRow[] }[]) => void;
  // When true the modal first shows an AI classification loading screen, then
  // resolves each document — recognized forms are prefilled, the rest are left
  // unclassified for the user to map manually.
  runClassification?: boolean;
  // Completed extractions already produced for a document, keyed by file name.
  // Shown read-only above the manual classification table.
  existingExtractionsByName?: Record<string, ExistingExtraction[]>;
}

const DOCUMENT_CATEGORIES = ['ACORD', 'Loss Run', 'Financial', 'Supplemental', 'Other'];

const DOCUMENT_TYPES_BY_CATEGORY: Record<string, string[]> = {
  ACORD: ['ACORD 125', 'ACORD 126', 'ACORD 127', 'ACORD 130', 'ACORD 140'],
  'Loss Run': ['Loss Run Report'],
  Financial: ['Income Statement', 'Balance Sheet'],
  Supplemental: ['Supplemental Application'],
  Other: ['Other'],
};

// Derive an auto-classification from the file name. Returns prefilled rows for a
// recognized ACORD form, or null when the document can't be classified.
const classifyByName = (name: string): ClassificationRow[] | null => {
  const match = name.toUpperCase().match(/ACORD\s*(\d{3})/);
  if (match) {
    const type = `ACORD ${match[1]}`;
    const known = DOCUMENT_TYPES_BY_CATEGORY.ACORD.includes(type) ? type : 'ACORD 125';
    return [{ id: 'row-1', pages: '1-9', documentCategory: 'ACORD', documentType: known }];
  }
  return null;
};

const blankRow = (): ClassificationRow => ({ id: 'row-1', pages: '', documentCategory: '', documentType: '' });

export const ClassifyDocumentModal: React.FC<ClassifyDocumentModalProps> = ({
  isOpen,
  documentNames,
  onClose,
  onSave,
  runClassification = false,
  existingExtractionsByName = {},
}) => {
  const [phase, setPhase] = useState<'classifying' | 'done'>('done');
  const [docs, setDocs] = useState<DocState[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const namesKey = documentNames.join('|');

  useEffect(() => {
    if (!isOpen) return;
    setActiveIdx(0);
    if (runClassification) {
      setPhase('classifying');
      // Placeholder rows while the AI "classifies".
      setDocs(documentNames.map((name) => ({ name, containsMultiple: false, rows: [blankRow()] })));
      const t = setTimeout(() => {
        setDocs(documentNames.map((name) => {
          const auto = classifyByName(name);
          return { name, containsMultiple: false, rows: auto || [blankRow()] };
        }));
        setPhase('done');
      }, 1800);
      return () => clearTimeout(t);
    }
    // Manual entry (warning-state / task): no loading, seed a default ACORD row.
    setPhase('done');
    setDocs(documentNames.map((name) => ({
      name,
      containsMultiple: false,
      rows: [{ id: 'row-1', pages: '1-9', documentCategory: 'ACORD', documentType: 'ACORD 126' }],
    })));
  }, [isOpen, runClassification, namesKey]);

  if (!isOpen) return null;

  const activeDoc = docs[activeIdx];

  // A document is considered classified once every row has a document type.
  const docStatus = (d: DocState): 'classifying' | 'classified' | 'unclassified' => {
    if (phase === 'classifying') return 'classifying';
    return d.rows.length > 0 && d.rows.every((r) => !!r.documentType) ? 'classified' : 'unclassified';
  };

  const patchActiveDoc = (patch: Partial<DocState>) => {
    setDocs((prev) => prev.map((d, i) => (i === activeIdx ? { ...d, ...patch } : d)));
  };

  const updateRow = (id: string, patch: Partial<ClassificationRow>) => {
    setDocs((prev) =>
      prev.map((d, i) => {
        if (i !== activeIdx) return d;
        return {
          ...d,
          rows: d.rows.map((r) => {
            if (r.id !== id) return r;
            const next = { ...r, ...patch };
            if (patch.documentCategory !== undefined && patch.documentCategory !== r.documentCategory) {
              next.documentType = DOCUMENT_TYPES_BY_CATEGORY[patch.documentCategory]?.[0] || '';
            }
            return next;
          }),
        };
      })
    );
  };

  const addRow = () => {
    const id = `row-${Date.now()}`;
    patchActiveDoc({ rows: [...(activeDoc?.rows || []), { id, pages: '', documentCategory: 'ACORD', documentType: 'ACORD 125' }] });
  };

  const removeRow = (id: string) => {
    if (!activeDoc || activeDoc.rows.length <= 1) return;
    patchActiveDoc({ rows: activeDoc.rows.filter((r) => r.id !== id) });
  };

  const handleSave = () => {
    onSave?.(docs.map((d) => ({ name: d.name, rows: d.rows })));
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
    color: '#2e2e2e',
    border: '1px solid #c9c9c9',
    borderRadius: '4px',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: 'white',
    boxSizing: 'border-box',
  };

  const headerCellStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#5c5c5c',
    fontWeight: 600,
    paddingBottom: '8px',
  };

  // Mock PDF page shown in the middle viewer panel (demo only — no real file).
  const renderDocPreview = (name: string) => (
    <div
      style={{
        width: '100%',
        maxWidth: '620px',
        backgroundColor: 'white',
        borderRadius: '2px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        padding: '44px 42px',
        boxSizing: 'border-box',
        fontSize: '12px',
        color: '#2e2e2e',
        lineHeight: 1.6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #001e5b', paddingBottom: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#001e5b' }}>ACORD 140</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#5c5c5c' }}>PROPERTY SECTION</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px', color: '#5c5c5c' }}>
          <div>DATE (MM/DD/YYYY)</div>
          <div style={{ fontWeight: 600, color: '#2e2e2e' }}>03/14/2026</div>
        </div>
      </div>
      <div style={{ fontSize: '12px', fontWeight: 700, backgroundColor: '#f3f3f3', padding: '5px 8px', marginBottom: '8px', color: '#001e5b' }}>APPLICANT INFORMATION</div>
      {[['Named Insured', 'NexGen Biologics Inc'], ['Mailing Address', '4200 W Diversey Ave, Chicago, IL 60639'], ['Producer', 'Vanguard Insurance Partners'], ['Effective Date', '04/01/2026']].map(([k, v]) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderBottom: '1px solid #e5e5e5', padding: '5px 0' }}>
          <span style={{ color: '#5c5c5c' }}>{k}</span>
          <span style={{ fontWeight: 600 }}>{v}</span>
        </div>
      ))}
      <div style={{ fontSize: '12px', fontWeight: 700, backgroundColor: '#f3f3f3', padding: '5px 8px', margin: '16px 0 8px', color: '#001e5b' }}>PREMISES INFORMATION — LOCATION 1</div>
      {[['Building Description', 'Warehouse / Distribution'], ['Construction Type', 'Fire Resistive'], ['Year Built', '2015'], ['Total Area (sq ft)', '84,000'], ['# Stories', '2'], ['Sprinklered', 'Yes — 100%'], ['Protection Class', '3']].map(([k, v]) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderBottom: '1px solid #e5e5e5', padding: '5px 0' }}>
          <span style={{ color: '#5c5c5c' }}>{k}</span>
          <span style={{ fontWeight: 600 }}>{v}</span>
        </div>
      ))}
      <div style={{ marginTop: '22px', fontSize: '11px', color: '#939393', textAlign: 'center' }}>
        Page 1 — {name}
      </div>
    </div>
  );

  const statusMarker = (status: ReturnType<typeof docStatus>) => {
    if (status === 'classifying') {
      return (
        <span style={{ position: 'relative', width: '16px', height: '16px', flexShrink: 0, display: 'inline-block' }}>
          <span role="status" className="slds-spinner slds-spinner_x-small slds-spinner_brand">
            <span className="slds-assistive-text">Classifying</span>
            <span className="slds-spinner__dot-a" />
            <span className="slds-spinner__dot-b" />
          </span>
        </span>
      );
    }
    if (status === 'classified') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#2E844A" style={{ flexShrink: 0 }}>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#B85C00" style={{ flexShrink: 0 }}>
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '95vw',
          maxWidth: '1600px',
          height: '92vh',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#001e5b', margin: 0 }}>
            Classify and Extract Documents
          </h2>
          <button
            onClick={onClose}
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

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left – Document navigation */}
          <div
            style={{
              width: '240px',
              borderRight: '1px solid #e5e5e5',
              backgroundColor: '#fafafa',
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c5c5c', padding: '16px 16px 8px' }}>
              Documents ({docs.length})
            </div>
            {docs.map((d, idx) => {
              const isActive = idx === activeIdx;
              const status = docStatus(d);
              return (
                <button
                  key={`${d.name}-${idx}`}
                  onClick={() => setActiveIdx(idx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 16px',
                    border: 'none',
                    borderLeft: isActive ? '3px solid #0176D3' : '3px solid transparent',
                    backgroundColor: isActive ? '#e8f1fb' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#f3f3f3'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {statusMarker(status)}
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 400,
                      color: '#001e5b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={d.name}
                  >
                    {d.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Middle – Document viewer (demo PDF preview) */}
          <div
            style={{
              flex: '55 1 0',
              minWidth: 0,
              borderRight: '1px solid #e5e5e5',
              backgroundColor: '#525659',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              overflowY: 'auto',
              padding: '32px 28px',
            }}
          >
            {activeDoc ? renderDocPreview(activeDoc.name) : null}
          </div>

          {/* Right – Classification grid or loading */}
          <div style={{ flex: '45 1 0', minWidth: 0, padding: '20px 24px', overflowY: 'auto' }}>
            {phase === 'classifying' ? (
              <div style={{ position: 'relative', minHeight: '340px' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '18px',
                  }}
                >
                  <span style={{ position: 'relative', width: '48px', height: '48px' }}>
                    <span role="status" className="slds-spinner slds-spinner_medium slds-spinner_brand">
                      <span className="slds-assistive-text">Classifying documents</span>
                      <span className="slds-spinner__dot-a" />
                      <span className="slds-spinner__dot-b" />
                    </span>
                  </span>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#001e5b', marginBottom: '4px' }}>
                      Classifying documents with AI…
                    </div>
                    <div style={{ fontSize: '13px', color: '#5c5c5c' }}>
                      Identifying the forms in each file and preparing extraction requests.
                    </div>
                  </div>
                </div>
              </div>
            ) : activeDoc ? (
              <>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#001e5b',
                    marginBottom: '12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={activeDoc.name}
                >
                  {activeDoc.name}
                </div>

                {(existingExtractionsByName[activeDoc.name] || []).length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#001e5b', marginBottom: '8px' }}>
                      Completed Extractions
                    </div>
                    <div style={{ border: '1px solid #e5e5e5', borderRadius: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1.4fr 1fr 0.9fr',
                          gap: '12px',
                          padding: '8px 12px',
                          backgroundColor: '#f3f3f3',
                          borderBottom: '1px solid #e5e5e5',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#5c5c5c',
                        }}
                      >
                        <span>Document Category</span>
                        <span>Document Type</span>
                        <span>Location</span>
                        <span>Status</span>
                      </div>
                      {(existingExtractionsByName[activeDoc.name] || []).map((ex, idx, arr) => {
                        const isComplete = ex.status === 'Complete';
                        const isFailed = ex.status === 'Failed';
                        let bg = '#f3f3f3', border = '#5c5c5c', color = '#3a3a3a';
                        if (isComplete) { bg = '#e7f5ec'; border = '#2E844A'; color = '#1a4f2c'; }
                        else if (isFailed) { bg = '#fdecea'; border = '#c23934'; color = '#7a1f1f'; }
                        return (
                          <div
                            key={`${ex.documentType}-${idx}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1.4fr 1.4fr 1fr 0.9fr',
                              gap: '12px',
                              padding: '8px 12px',
                              alignItems: 'center',
                              borderBottom: idx < arr.length - 1 ? '1px solid #e5e5e5' : 'none',
                              backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                            }}
                          >
                            <span style={{ fontSize: '13px', color: '#001e5b' }}>{ex.documentCategory}</span>
                            <span style={{ fontSize: '13px', color: '#001e5b' }}>{ex.documentType}</span>
                            <span style={{ fontSize: '13px', color: '#3a3a3a' }}>{ex.location}</span>
                            <span>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                lineHeight: '14px',
                                backgroundColor: bg,
                                color,
                                border: `1px solid ${border}`,
                              }}>
                                {ex.status}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '12px', color: '#5c5c5c', margin: '10px 0 0' }}>
                      Add classifications below for any remaining forms in this document.
                    </div>
                  </div>
                )}

                {docStatus(activeDoc) === 'unclassified' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      backgroundColor: '#fef5e8',
                      border: '1px solid #f5b87c',
                      borderLeft: '4px solid #B85C00',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      marginBottom: '16px',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#B85C00" style={{ flexShrink: 0, marginTop: '1px' }}>
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                    </svg>
                    <div style={{ fontSize: '13px', color: '#5c3a00', lineHeight: '18px' }}>
                      <strong>Unable to classify this document.</strong> Please manually select the document category and type to continue extraction.
                    </div>
                  </div>
                )}

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#001e5b',
                    marginBottom: '16px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={activeDoc.containsMultiple}
                    onChange={(e) => patchActiveDoc({ containsMultiple: e.target.checked })}
                    style={{ margin: 0 }}
                  />
                  This file contains multiple documents
                </label>

                {/* Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1.4fr 1.4fr 32px',
                    gap: '12px',
                    paddingBottom: '4px',
                    borderBottom: '1px solid #e5e5e5',
                  }}
                >
                  <div style={headerCellStyle}>Pages</div>
                  <div style={headerCellStyle}>Document Category</div>
                  <div style={headerCellStyle}>Document Type</div>
                  <div />
                </div>

                {/* Rows */}
                <div style={{ marginTop: '12px' }}>
                  {activeDoc.rows.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.4fr 1.4fr 32px',
                        gap: '12px',
                        alignItems: 'center',
                        marginBottom: '12px',
                      }}
                    >
                      <input
                        type="text"
                        value={row.pages}
                        onChange={(e) => updateRow(row.id, { pages: e.target.value })}
                        placeholder="e.g. 1-4"
                        style={inputStyle}
                        disabled={!activeDoc.containsMultiple && activeDoc.rows.length === 1}
                      />
                      <select
                        value={row.documentCategory}
                        onChange={(e) => updateRow(row.id, { documentCategory: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">— Select —</option>
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.documentType}
                        onChange={(e) => updateRow(row.id, { documentType: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">— Select —</option>
                        {(DOCUMENT_TYPES_BY_CATEGORY[row.documentCategory] || []).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={activeDoc.rows.length === 1}
                        title="Remove row"
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: activeDoc.rows.length === 1 ? 'not-allowed' : 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: activeDoc.rows.length === 1 ? 0.4 : 1,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#0176D3">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {activeDoc.containsMultiple && (
                  <button
                    onClick={addRow}
                    style={{
                      marginTop: '4px',
                      padding: '6px 16px',
                      border: '1px solid #c9c9c9',
                      borderRadius: '20px',
                      backgroundColor: 'white',
                      color: '#0176D3',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Add Another
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #e5e5e5',
            backgroundColor: '#fafafa',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            onClick={onClose}
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
            onClick={handleSave}
            disabled={phase === 'classifying'}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: phase === 'classifying' ? '#c9c9c9' : '#0176D3',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              cursor: phase === 'classifying' ? 'not-allowed' : 'pointer',
            }}
          >
            Extract
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassifyDocumentModal;
