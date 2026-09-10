import React, { useState } from 'react'
import { useRFQStore } from '../store/rfqStore'
import { CARRIERS, MOCK_QUOTES } from '../data/mockData'
import QuoteCard from '../components/QuoteCard'

type Filter = 'all' | 'received' | 'pending' | 'declined' | 'stale'

export default function Step3CompareQuotes() {
  const quotes = useRFQStore((s) => s.quotes)
  const acceptedQuoteId = useRFQStore((s) => s.acceptedQuoteId)
  const acceptQuote = useRFQStore((s) => s.acceptQuote)
  const selectedCarriers = useRFQStore((s) => s.selectedCarriers)
  const setQuotes = useRFQStore((s) => s.setQuotes)

  const [filter, setFilter] = useState<Filter>('all')
  const [aiRunning, setAiRunning] = useState(false)
  const [aiDone, setAiDone] = useState(false)

  const displayQuotes = quotes.length > 0 ? quotes : MOCK_QUOTES

  const counts = {
    received: displayQuotes.filter((q) => q.status === 'received').length,
    pending: displayQuotes.filter((q) => q.status === 'pending').length,
    declined: displayQuotes.filter((q) => q.status === 'declined').length,
    stale: displayQuotes.filter((q) => q.status === 'stale').length,
  }

  const filteredQuotes =
    filter === 'all' ? displayQuotes : displayQuotes.filter((q) => q.status === filter)

  const selectedCarrierData = CARRIERS.filter((c) => selectedCarriers.includes(c.id))

  function handleAiCompare() {
    setAiRunning(true)
    setTimeout(() => {
      setAiRunning(false)
      setAiDone(true)
      const sorted = [...displayQuotes]
        .filter((q) => q.status === 'received')
        .sort((a, b) => a.annualPremium - b.annualPremium)
      const updated = displayQuotes.map((q) => ({
        ...q,
        isBestPremium: q.id === sorted[0]?.id,
      }))
      setQuotes(updated)
    }, 2000)
  }

  return (
    <>
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Compare Carrier Quotes</h1>
          <p className="text-sm text-muted mt-0.5">
            {counts.received} of {displayQuotes.length} responses received
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-1.5 text-xs">
            <svg className="w-3.5 h-3.5 fill-muted" viewBox="0 0 24 24">
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
            </svg>
            Simulate Responses
          </button>
          <button
            onClick={handleAiCompare}
            disabled={aiRunning}
            className={[
              'flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold border transition-colors',
              aiRunning
                ? 'border-violet-300 bg-violet-50 text-violet-600 cursor-wait'
                : 'border-violet-600 text-violet-700 hover:bg-violet-50',
            ].join(' ')}
          >
            {aiRunning ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
                  <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
                </svg>
                Comparing…
              </>
            ) : (
              '✨ AI Compare Insights'
            )}
          </button>
        </div>
      </div>

      {/* AI recommendation banner */}
      {aiDone && (
        <div className="mb-5 p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-800 font-medium flex items-start gap-2">
          <span className="text-lg leading-none">✨</span>
          <span>
            Einstein recommends <strong>Travelers</strong> — lowest premium at $16,800 with the
            best deductible ($1,000), 12-month business income coverage, and cyber add-on included.
          </span>
        </div>
      )}

      {/* ── Status filter tiles ── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { key: 'received', label: 'Received', count: counts.received, bg: 'bg-green-50', border: 'border-green-300', text: 'text-success' },
          { key: 'pending',  label: 'Pending',  count: counts.pending,  bg: 'bg-gray-50',  border: 'border-border',     text: 'text-muted' },
          { key: 'declined', label: 'Declined', count: counts.declined, bg: 'bg-red-50',   border: 'border-red-200',    text: 'text-danger' },
          { key: 'stale',    label: 'Stale',    count: counts.stale,    bg: 'bg-orange-50',border: 'border-orange-200', text: 'text-warning' },
        ].map((tile) => (
          <button
            key={tile.key}
            onClick={() => setFilter(filter === tile.key ? 'all' : (tile.key as Filter))}
            className={[
              'border rounded-lg p-4 text-center transition-all',
              tile.bg, tile.border, tile.text,
              filter === tile.key ? 'ring-2 ring-offset-1 ring-current' : 'hover:shadow-card',
            ].join(' ')}
          >
            <div className="text-3xl font-bold">{tile.count}</div>
            <div className="text-xs font-bold mt-1 uppercase tracking-wide">{tile.label}</div>
          </button>
        ))}
      </div>

      {/* ── 3-column pricing table ── */}
      {filteredQuotes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start mb-6">
          {filteredQuotes.map((q) => (
            <QuoteCard
              key={q.id}
              quote={q}
              isAccepted={acceptedQuoteId === q.id}
              isRecommended={!!q.isBestPremium}
              onAccept={acceptQuote}
            />
          ))}
        </div>
      ) : (
        <div className="section-card mb-6">
          <div className="section-body text-center text-muted py-12">
            <p className="text-sm">No quotes match the selected filter.</p>
          </div>
        </div>
      )}

      {/* ── RFQ Destinations mini-summary ── */}
      {selectedCarrierData.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <svg className="w-4 h-4 fill-muted" viewBox="0 0 24 24">
              <path d="M12 7V3H2v18h20V7H12z" />
            </svg>
            <span>RFQ Destinations</span>
            <span className="ml-auto text-xs text-muted font-normal">
              {selectedCarrierData.length} destination{selectedCarrierData.length !== 1 ? 's' : ''}
            </span>
            <button className="ml-3 btn-primary text-xs py-1 px-2.5">+ New Destination</button>
          </div>
          <div className="section-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedCarrierData.map((c) => {
                const quote = displayQuotes.find((q) => q.carrierId === c.id)
                return (
                  <div key={c.id} className="flex items-center gap-3 border border-border rounded p-3 bg-gray-50">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-ink">{c.name}</div>
                      <div className="text-xs text-muted">Code: {c.code} · Type: carrier</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.lob.map((l) => <span key={l} className="lob-pill">{l}</span>)}
                      </div>
                    </div>
                    {quote && quote.status === 'received' && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-muted">Premium</div>
                        <div className="font-bold text-sm text-ink">
                          ${quote.annualPremium.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
