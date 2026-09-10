import React, { useState } from 'react'
import { useRFQStore } from '../store/rfqStore'
import { CARRIERS } from '../data/mockData'
import CarrierCard from '../components/CarrierCard'

function SectionCard({ title, icon, children, aside }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div className="section-card">
      <div className="section-header">
        {icon}
        <span className="flex-1">{title}</span>
        {aside}
      </div>
      <div className="section-body">{children}</div>
    </div>
  )
}

export default function Step2PublishCarriers() {
  const rfqDetails = useRFQStore((s) => s.rfqDetails)
  const selectedCarriers = useRFQStore((s) => s.selectedCarriers)
  const toggleCarrier = useRFQStore((s) => s.toggleCarrier)
  const emailSubject = useRFQStore((s) => s.emailSubject)
  const emailBody = useRFQStore((s) => s.emailBody)
  const setEmailSubject = useRFQStore((s) => s.setEmailSubject)
  const setEmailBody = useRFQStore((s) => s.setEmailBody)

  const [carrierSearch, setCarrierSearch] = useState('')
  const [acordFiles, setAcordFiles] = useState<string[]>([])

  const filteredCarriers = CARRIERS.filter(
    (c) =>
      carrierSearch === '' ||
      c.name.toLowerCase().includes(carrierSearch.toLowerCase()) ||
      c.lob.some((l) => l.toLowerCase().includes(carrierSearch.toLowerCase()))
  )

  const totalInsuredValue = rfqDetails.lineItems.reduce((s, li) => s + li.insuredValue, 0)

  function fmt(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  const selectedCarrierData = CARRIERS.filter((c) => selectedCarriers.includes(c.id))

  return (
    <>
      {/* ── RFQ Summary ── */}
      <SectionCard
        title="RFQ Summary"
        icon={
          <svg className="w-4 h-4 fill-muted" viewBox="0 0 24 24">
            <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />
          </svg>
        }
        aside={<span className="text-xs text-muted font-normal">This is what will be sent to each carrier</span>}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Insured</div>
            <div className="font-semibold text-ink">{rfqDetails.accountName || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Effective Date</div>
            <div className="font-semibold text-ink">{rfqDetails.effectiveDate}</div>
          </div>
          <div>
            <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Expiration Date</div>
            <div className="font-semibold text-ink">{rfqDetails.expirationDate}</div>
          </div>
          <div>
            <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Response Deadline</div>
            <div className="font-semibold text-ink text-danger">{rfqDetails.responseDeadline}</div>
          </div>
          <div>
            <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Line of Business</div>
            <div className="font-semibold text-ink">{rfqDetails.lob}</div>
          </div>
          <div>
            <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Total Insured Value</div>
            <div className="font-semibold text-ink">{fmt(totalInsuredValue)}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Lines of Coverage</div>
            <div className="font-semibold text-ink">
              {rfqDetails.linesOfCoverage.length > 0 ? rfqDetails.linesOfCoverage.join(', ') : '—'}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Select Carriers ── */}
      <SectionCard
        title="Carriers"
        icon={
          <svg className="w-4 h-4 fill-muted" viewBox="0 0 24 24">
            <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
          </svg>
        }
        aside={
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted font-normal">
              {selectedCarriers.length} of {CARRIERS.length} selected
            </span>
            <div className="relative">
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 fill-muted w-3 h-3" viewBox="0 0 24 24">
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              <input
                type="text"
                className="border border-border rounded text-xs py-1 pl-6 pr-3 outline-none focus:ring-1 focus:ring-brand w-40"
                placeholder="Search carriers..."
                value={carrierSearch}
                onChange={(e) => setCarrierSearch(e.target.value)}
              />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredCarriers.map((carrier) => (
            <CarrierCard
              key={carrier.id}
              carrier={carrier}
              selected={selectedCarriers.includes(carrier.id)}
              onToggle={toggleCarrier}
            />
          ))}
          {filteredCarriers.length === 0 && (
            <p className="col-span-3 text-center text-sm text-muted py-4">No carriers match your search.</p>
          )}
        </div>
      </SectionCard>

      {/* ── ACORD Forms ── */}
      <SectionCard
        title="ACORD Forms"
        icon={
          <svg className="w-4 h-4 fill-muted" viewBox="0 0 24 24">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" />
          </svg>
        }
        aside={<span className="text-xs text-muted font-normal">Auto-generated from line items and coverages</span>}
      >
        <label
          htmlFor="acord-upload"
          className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-brand hover:bg-brand-light transition-colors"
        >
          <svg className="w-8 h-8 fill-muted mb-2" viewBox="0 0 24 24">
            <path d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
          </svg>
          <span className="text-sm text-muted">Drop ACORD forms here or <em className="not-italic text-brand font-semibold">browse</em></span>
          <span className="text-xs text-muted mt-1">PDF, DOCX accepted</span>
          <input
            id="acord-upload"
            type="file"
            multiple
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []).map((f) => f.name)
              setAcordFiles((prev) => [...prev, ...files])
            }}
          />
        </label>
        {acordFiles.length > 0 && (
          <ul className="mt-3 space-y-1">
            {acordFiles.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-ink">
                <svg className="w-4 h-4 fill-brand" viewBox="0 0 24 24">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" />
                </svg>
                {f}
                <button
                  onClick={() => setAcordFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-auto text-muted hover:text-danger"
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ── Cover Email ── */}
      <SectionCard
        title="Cover Email"
        icon={
          <svg className="w-4 h-4 fill-muted" viewBox="0 0 24 24">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
        }
        aside={
          <span className="text-xs text-muted font-normal ml-auto">
            From: <strong className="text-ink">jane.doe@brokerage.com</strong>
          </span>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="form-label">Subject</label>
            <input
              type="text"
              className="form-input"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Message</label>
            <textarea
              className="form-input font-mono text-xs resize-y"
              rows={7}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
            <p className="text-xs text-muted mt-1">
              Variables:{' '}
              {['{{carrier}}', '{{insured}}', '{{lob}}', '{{effective}}', '{{deadline}}', '{{broker}}'].map(
                (v) => (
                  <code key={v} className="bg-gray-100 px-1 py-0.5 rounded text-ink mr-1">{v}</code>
                )
              )}
            </p>
          </div>

          {/* Email preview */}
          {selectedCarrierData.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Preview</div>
              <div className="border border-border rounded p-3 bg-gray-50 text-xs text-ink whitespace-pre-wrap font-mono">
                {emailBody
                  .replace('{{carrier}}', selectedCarrierData[0]?.name ?? 'Carrier')
                  .replace('{{insured}}', rfqDetails.accountName || '[Insured]')
                  .replace('{{lob}}', rfqDetails.lob)
                  .replace('{{effective}}', rfqDetails.effectiveDate)
                  .replace('{{expiration}}', rfqDetails.expirationDate)
                  .replace('{{deadline}}', rfqDetails.responseDeadline)
                  .replace('{{broker}}', 'Jane Doe')}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── RFQ Destinations ── */}
      {selectedCarrierData.length > 0 && (
        <SectionCard
          title="RFQ Destinations"
          icon={
            <svg className="w-4 h-4 fill-muted" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
            </svg>
          }
          aside={
            <span className="text-xs text-muted font-normal ml-auto">
              {selectedCarrierData.length} destination{selectedCarrierData.length > 1 ? 's' : ''} ·{' '}
              {selectedCarrierData.length} carrier{selectedCarrierData.length > 1 ? 's' : ''}
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedCarrierData.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border border-border rounded p-3 bg-gray-50">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: c.color }}
                >
                  {c.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink">{c.name}</div>
                  <div className="text-xs text-muted">Code: {c.code} · Type: carrier</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.lob.map((l) => (
                      <span key={l} className="lob-pill">{l}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="text-muted hover:text-brand" title="Edit">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                  </button>
                  <button className="text-muted hover:text-brand" title="Lock">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </>
  )
}
