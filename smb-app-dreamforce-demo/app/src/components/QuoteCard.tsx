import React from 'react'
import { Quote } from '../types'
import { CARRIERS, QUOTE_DETAILS } from '../data/mockData'

interface Props {
  quote: Quote
  isAccepted: boolean
  isRecommended?: boolean
  onAccept: (id: string) => void
}

export default function QuoteCard({ quote, isAccepted, isRecommended, onAccept }: Props) {
  const carrier = CARRIERS.find((c) => c.id === quote.carrierId)
  const detail = QUOTE_DETAILS.find((d) => d.quoteId === quote.id)
  const isPending = quote.status === 'pending'

  function fmtMoney(n?: number) {
    if (n === undefined || n === null || n === 0) return null
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  function fmtDate(d: string) {
    try {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    } catch {
      return d
    }
  }

  const statusBadge = {
    received: 'badge-received',
    pending: 'badge-pending',
    declined: 'badge-declined',
    stale: 'badge-stale',
  }[quote.status]

  const detailRows = [
    { label: 'Liability Limit', value: detail?.liabilityLimit ?? '—' },
    { label: 'Property Deductible', value: detail?.propertyDeductible ?? '—' },
    { label: 'Business Income', value: detail?.businessIncome ?? '—' },
    { label: 'Cyber Add-on', value: detail?.cyberAddon ?? '—' },
    { label: 'Valid Until', value: fmtDate(quote.validUntil) },
  ]

  return (
    <div
      className={[
        'relative flex flex-col rounded-lg overflow-hidden transition-transform',
        isRecommended
          ? 'border-2 border-brand shadow-xl scale-[1.02] bg-white'
          : 'border border-border shadow-card bg-white',
        isAccepted ? 'ring-2 ring-offset-2 ring-brand' : '',
      ].join(' ')}
    >
      {/* Recommended ribbon */}
      {isRecommended && (
        <div className="bg-brand text-white text-xs font-bold text-center py-1.5 tracking-widest uppercase">
          Best Value / Recommended
        </div>
      )}

      {/* Carrier header */}
      <div className="flex flex-col items-center text-center p-5 bg-gray-50 border-b border-divider gap-2">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base"
          style={{ backgroundColor: carrier?.color ?? '#888' }}
        >
          {carrier?.initials ?? quote.carrierId.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-bold text-base text-ink">{quote.carrierName}</div>
          {carrier?.amBest && (
            <div className="text-xs text-muted mt-0.5">AM Best: {carrier.amBest}</div>
          )}
          <span className={`${statusBadge} mt-1 inline-block`}>
            {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Premium */}
      <div className="text-center py-5 border-b border-divider">
        {isPending ? (
          <p className="text-2xl font-bold text-muted">Calculating…</p>
        ) : (
          <p
            className={[
              'text-3xl font-bold',
              isRecommended ? 'text-brand' : 'text-ink',
            ].join(' ')}
          >
            {fmtMoney(quote.annualPremium) ?? '$—'}
            <span className="text-sm font-normal text-muted ml-1">/ annual</span>
          </p>
        )}
      </div>

      {/* Coverage detail rows */}
      <div className={`flex-1 divide-y divide-divider ${isPending ? 'opacity-40' : ''}`}>
        {detailRows.map((row) => (
          <div key={row.label} className="flex justify-between items-center px-4 py-2.5">
            <span className="text-xs text-muted">{row.label}</span>
            <span className="text-xs font-semibold text-ink text-right max-w-[55%]">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Accept CTA */}
      <div className="p-4 border-t border-divider">
        <button
          disabled={isPending}
          onClick={() => !isPending && onAccept(quote.id)}
          className={[
            'w-full py-2.5 px-4 rounded font-semibold text-sm transition-colors',
            isPending
              ? 'bg-gray-100 text-muted cursor-not-allowed border border-border'
              : isAccepted
              ? 'bg-success text-white hover:bg-green-700'
              : isRecommended
              ? 'btn-primary'
              : 'btn-secondary hover:border-brand hover:text-brand',
          ].join(' ')}
        >
          {isPending
            ? `Select ${quote.carrierName}`
            : isAccepted
            ? `✓ Accepted — ${quote.carrierName}`
            : `Accept ${quote.carrierName} Quote`}
        </button>
      </div>
    </div>
  )
}
