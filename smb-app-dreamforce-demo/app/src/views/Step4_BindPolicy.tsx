import React, { useState } from 'react'
import { useRFQStore } from '../store/rfqStore'
import { MOCK_QUOTES, SUBJECTIVITIES, PAYMENT_FREQUENCIES, CARRIERS } from '../data/mockData'
import { SubjectivityItem } from '../types'

function Accordion({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-border rounded mb-2 overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-ink transition-colors"
      >
        {title}
        <svg
          className={`w-4 h-4 fill-muted transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
        >
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>
      {open && <div className="px-4 py-3 border-t border-divider">{children}</div>}
    </div>
  )
}

export default function Step4BindPolicy() {
  const acceptedQuoteId = useRFQStore((s) => s.acceptedQuoteId)
  const quotes = useRFQStore((s) => s.quotes)
  const rfqDetails = useRFQStore((s) => s.rfqDetails)

  const displayQuotes = quotes.length > 0 ? quotes : MOCK_QUOTES
  const accepted = displayQuotes.find((q) => q.id === acceptedQuoteId) ?? displayQuotes[1] ?? displayQuotes[0]
  const carrier = CARRIERS.find((c) => c.id === accepted?.carrierId)

  const [subjectivities, setSubjectivities] = useState<SubjectivityItem[]>(SUBJECTIVITIES)
  const [noCoverageLapse, setNoCoverageLapse] = useState(false)
  const [paymentFrequency, setPaymentFrequency] = useState('Annual')
  const [additionalInsureds, setAdditionalInsureds] = useState<string[]>([])
  const [certHolders, setCertHolders] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [bound, setBound] = useState(false)

  const receivedCount = subjectivities.filter((s) => s.checked).length

  function toggleSubjectivity(id: string) {
    setSubjectivities((prev) => prev.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s)))
  }

  function fmtMoney(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  if (bound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center mb-4">
          <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-success mb-2">Policy Bound!</h2>
        <p className="text-muted text-sm mb-1">
          Carrier: <strong className="text-ink">{carrier?.name ?? accepted?.carrierName}</strong>
        </p>
        <p className="text-muted text-sm mb-1">
          Premium: <strong className="text-ink">{fmtMoney(accepted?.annualPremium ?? 0)}</strong>
        </p>
        <p className="text-muted text-sm">
          Effective: <strong className="text-ink">{rfqDetails.effectiveDate}</strong> — {rfqDetails.expirationDate}
        </p>
        <button
          className="btn-primary mt-6"
          onClick={() => setBound(false)}
        >
          Start New RFQ
        </button>
      </div>
    )
  }

  return (
    <>
      {/* ── Accepted Quote Summary ── */}
      <div className="section-card mb-4">
        <div className="section-header">
          <svg className="w-4 h-4 fill-muted" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <span>Accepted Quote — {carrier?.name ?? accepted?.carrierName}</span>
        </div>
        <div className="section-body">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Insured</div>
              <div className="font-semibold text-ink">{rfqDetails.accountName || 'CaptiveAgentAccountTest1'}</div>
            </div>
            <div>
              <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Premium</div>
              <div className="text-2xl font-bold text-ink">
                {fmtMoney(accepted?.annualPremium ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Effective</div>
              <div className="font-semibold text-ink">{rfqDetails.effectiveDate}</div>
            </div>
            <div>
              <div className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">Expiration</div>
              <div className="font-semibold text-ink">{rfqDetails.expirationDate}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Subjectivities ── */}
      <div className="section-card mb-4">
        <div className="section-header">
          <svg className="w-4 h-4 fill-muted" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <span>Subjectivities</span>
          <span className="ml-auto text-xs text-muted font-normal">
            {receivedCount} / {subjectivities.length} received
          </span>
        </div>
        <div className="section-body space-y-2">
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div
              className="bg-success h-1.5 rounded-full transition-all"
              style={{ width: `${(receivedCount / subjectivities.length) * 100}%` }}
            />
          </div>
          {subjectivities.map((s) => (
            <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="accent-brand w-4 h-4"
                checked={s.checked}
                onChange={() => toggleSubjectivity(s.id)}
              />
              <span
                className={`text-sm ${s.checked ? 'line-through text-muted' : 'text-ink'} group-hover:text-brand transition-colors`}
              >
                {s.label}
              </span>
              {s.checked && (
                <span className="ml-auto badge-received text-xs">Received</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* ── Premium & Payment ── */}
      <div className="section-card mb-4">
        <div className="section-header">
          <svg className="w-4 h-4 fill-muted" viewBox="0 0 24 24">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
          </svg>
          <span>Premium &amp; Payment</span>
        </div>
        <div className="section-body space-y-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              className="accent-brand w-4 h-4"
              checked={noCoverageLapse}
              onChange={(e) => setNoCoverageLapse(e.target.checked)}
            />
            Confirmed: No coverage lapse
          </label>
          <div className="max-w-xs">
            <label className="form-label">Payment Frequency</label>
            <select
              className="form-select"
              value={paymentFrequency}
              onChange={(e) => setPaymentFrequency(e.target.value)}
            >
              {PAYMENT_FREQUENCIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="border border-border rounded bg-gray-50 p-4 text-center text-muted text-sm">
            No payment details added.{' '}
            <button className="text-brand font-semibold hover:underline">+ Add payment schedule</button>
          </div>
        </div>
      </div>

      {/* ── Accordions ── */}
      <Accordion title="Additional Insureds">
        {additionalInsureds.length === 0 ? (
          <p className="text-sm text-muted">No additional insureds added.</p>
        ) : (
          <ul className="space-y-1 text-sm mb-2">
            {additionalInsureds.map((ins, i) => (
              <li key={i} className="flex justify-between">
                <span>{ins}</span>
                <button
                  className="text-muted hover:text-danger"
                  onClick={() => setAdditionalInsureds((p) => p.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          className="btn-secondary text-xs mt-2"
          onClick={() => setAdditionalInsureds((p) => [...p, `Additional Insured ${p.length + 1}`])}
        >
          + Add
        </button>
      </Accordion>

      <Accordion title="Certificate Holders">
        {certHolders.length === 0 ? (
          <p className="text-sm text-muted">No certificate holders added.</p>
        ) : (
          <ul className="space-y-1 text-sm mb-2">
            {certHolders.map((ch, i) => (
              <li key={i} className="flex justify-between">
                <span>{ch}</span>
                <button
                  className="text-muted hover:text-danger"
                  onClick={() => setCertHolders((p) => p.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          className="btn-secondary text-xs mt-2"
          onClick={() => setCertHolders((p) => [...p, `Certificate Holder ${p.length + 1}`])}
        >
          + Add
        </button>
      </Accordion>

      <Accordion title="Notes to Underwriter">
        <textarea
          className="form-input w-full"
          rows={4}
          placeholder="Enter any special instructions or notes for the underwriter..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Accordion>

      {/* Bind confirmation */}
      <div className="mt-4 flex justify-end">
        <button
          className="btn-primary px-8 py-2.5 text-sm"
          onClick={() => setBound(true)}
        >
          Bind Policy
        </button>
      </div>
    </>
  )
}
