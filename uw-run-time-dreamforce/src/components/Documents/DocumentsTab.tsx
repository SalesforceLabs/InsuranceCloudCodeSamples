import React from 'react';
import { Button, Icon } from '@salesforce/design-system-react';

interface DocumentsTabProps {
  documents: any[];
  selectedDocumentId: string;
  setSelectedDocumentId: (id: string) => void;
  setClassifyDocumentId?: (id: string | null) => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
  documents,
  selectedDocumentId,
  setSelectedDocumentId,
  setClassifyDocumentId
}) => {
  const selectedDocument = documents.find(d => d.id === selectedDocumentId);

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
                    let bg = '#fdecea', border = '#c23934', color = '#7a1f1f';
                    if (isInProgress) { bg = '#fef5e8'; border = '#B85C00'; color = '#5c3a00'; }
                    else if (isPending) { bg = '#f3f3f3'; border = '#5c5c5c'; color = '#3a3a3a'; }
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
            <Button
              label="View"
              iconCategory="utility"
              iconName="preview"
              iconPosition="left"
              variant="neutral"
            />
          </div>

          {/* Extraction Requests Table - shown for all documents */}
          {(selectedDocument as any).extractionRequests && (selectedDocument as any).extractionRequests.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#001e5b',
                marginBottom: '12px'
              }}>
                Extraction Requests
              </h3>
              <div style={{
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr 1.2fr 1fr',
                  padding: '10px 12px',
                  backgroundColor: '#f3f3f3',
                  borderBottom: '1px solid #e5e5e5',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#5c5c5c'
                }}>
                  <span>Request ID</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span>Created</span>
                </div>
                {/* Table Rows */}
                {(selectedDocument as any).extractionRequests.map((req: any, idx: number) => {
                  const isComplete = req.status === 'Complete';
                  const isInProgress = req.status === 'In Progress';
                  const isFailed = req.status === 'Failed';
                  let bg = '#f3f3f3', border = '#5c5c5c', color = '#3a3a3a';
                  if (isComplete) { bg = '#e7f5ec'; border = '#2E844A'; color = '#1a4f2c'; }
                  else if (isInProgress) { bg = '#fef5e8'; border = '#B85C00'; color = '#5c3a00'; }
                  else if (isFailed) { bg = '#fdecea'; border = '#c23934'; color = '#7a1f1f'; }
                  return (
                    <div
                      key={req.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 2fr 1.2fr 1fr',
                        padding: '10px 12px',
                        borderBottom: idx < (selectedDocument as any).extractionRequests.length - 1 ? '1px solid #e5e5e5' : 'none',
                        backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontSize: '13px', color: '#0176D3' }}>{req.id}</span>
                      <span style={{ fontSize: '13px', color: '#001e5b' }}>{req.type}</span>
                      <span>
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
                          {req.status}
                        </span>
                      </span>
                      <span style={{ fontSize: '13px', color: '#5c5c5c' }}>{req.createdAt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedDocument.status === 'Unable to Classify' ? (
            // Unable to classify - manual classification required
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              backgroundColor: '#fdecea',
              border: '1px solid #f5b8b1',
              borderRadius: '8px'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="#c23934" style={{ marginBottom: '12px' }}>
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#7a1f1f',
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
                onClick={() => setClassifyDocumentId && setClassifyDocumentId(selectedDocument.id)}
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
          ) : ((selectedDocument.status === 'Pending Analysis' || selectedDocument.status === 'Extraction in Progress' || selectedDocument.status === 'Classification in Progress') && !selectedDocument.insights.summary && selectedDocument.insights.keyFindings.length === 0 && selectedDocument.insights.extractedData.length === 0) ? (
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
                  : selectedDocument.status === 'Classification in Progress'
                    ? 'Classification in Progress'
                    : 'Analysis Pending'}
              </h3>
              <p style={{
                fontSize: '13px',
                color: '#5c5c5c',
                margin: 0
              }}>
                {selectedDocument.status === 'Extraction in Progress'
                  ? 'AI agent is currently extracting data from this document. Insights will be available once extraction is complete.'
                  : selectedDocument.status === 'Classification in Progress'
                    ? 'AI agent is identifying which forms this document contains. Extraction requests will be created once classification is complete.'
                    : 'AI agent will analyze this document shortly. You\'ll be notified when insights are ready.'}
              </p>
            </div>
          ) : (
            // Analyzed state - Show insights
            <div>
              {/* AI Summary Section */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
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
                  margin: 0,
                  padding: '12px',
                  backgroundColor: '#f3f3f3',
                  borderRadius: '8px',
                  borderLeft: '3px solid #0176D3'
                }}>
                  {selectedDocument.insights.summary}
                </p>
              </div>

              {/* Key Findings */}
              {selectedDocument.insights.keyFindings.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#001e5b',
                    marginBottom: '12px'
                  }}>
                    Key Findings
                  </h3>
                  <ul style={{
                    margin: 0,
                    paddingLeft: '20px',
                    fontSize: '14px',
                    color: '#2e2e2e',
                    lineHeight: '1.6'
                  }}>
                    {selectedDocument.insights.keyFindings.map((finding: any, idx: number) => (
                      <li key={idx} style={{ marginBottom: '8px' }}>{finding}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Extracted Data */}
              {selectedDocument.insights.extractedData.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#001e5b',
                    marginBottom: '12px'
                  }}>
                    Extracted Data
                  </h3>
                  <div style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    {selectedDocument.insights.extractedData.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40% 60%',
                          padding: '10px 12px',
                          borderBottom: idx < selectedDocument.insights.extractedData.length - 1 ? '1px solid #e5e5e5' : 'none',
                          backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa'
                        }}
                      >
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#5c5c5c'
                        }}>
                          {item.field}
                        </span>
                        <span style={{
                          fontSize: '13px',
                          color: '#001e5b'
                        }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
  );
};
