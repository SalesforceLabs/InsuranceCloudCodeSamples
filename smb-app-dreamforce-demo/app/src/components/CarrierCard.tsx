import React from 'react'
import { Carrier } from '../types'

interface Props {
  carrier: Carrier
  selected: boolean
  onToggle: (id: string) => void
}

export default function CarrierCard({ carrier, selected, onToggle }: Props) {
  return (
    <button
      onClick={() => onToggle(carrier.id)}
      className={[
        'relative flex flex-col items-center text-center p-4 rounded border transition-all',
        selected
          ? 'border-brand bg-brand-light shadow-md'
          : 'border-border bg-white hover:border-brand hover:shadow-card',
      ].join(' ')}
    >
      {/* Checkbox indicator */}
      <div
        className={[
          'absolute top-2 right-2 w-4 h-4 rounded border flex items-center justify-center',
          selected ? 'bg-brand border-brand' : 'border-border bg-white',
        ].join(' ')}
      >
        {selected && (
          <svg className="w-2.5 h-2.5 fill-white" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        )}
      </div>

      {/* Avatar */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2"
        style={{ backgroundColor: carrier.color }}
      >
        {carrier.initials}
      </div>

      <div className="font-bold text-sm text-ink">{carrier.name}</div>

      {carrier.amBest && (
        <div className="text-xs text-muted mt-0.5">AM Best: {carrier.amBest}</div>
      )}

      <div className="flex flex-wrap justify-center gap-1 mt-1.5">
        {carrier.lob.map((l) => (
          <span key={l} className="lob-pill">{l}</span>
        ))}
      </div>

      {selected && (
        <span className="mt-2 text-xs font-bold text-brand">Selected</span>
      )}
    </button>
  )
}
