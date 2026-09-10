import React from 'react'
import { useRFQStore } from '../store/rfqStore'
import { Step } from '../types'

const STEPS: { num: Step; label: string }[] = [
  { num: 1, label: 'Create RFQ' },
  { num: 2, label: 'Publish to Carriers' },
  { num: 3, label: 'Compare Quotes' },
  { num: 4, label: 'Bind Policy' },
]

export default function Stepper() {
  const currentStep = useRFQStore((s) => s.step)
  const setStep = useRFQStore((s) => s.setStep)

  return (
    <nav className="flex bg-white border-b border-border flex-shrink-0 overflow-hidden">
      {STEPS.map((step, idx) => {
        const isCurrent = step.num === currentStep
        const isDone = step.num < currentStep

        return (
          <button
            key={step.num}
            onClick={() => setStep(step.num)}
            className={[
              'flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold flex-1 justify-center relative transition-colors',
              'border-r border-border last:border-r-0',
              isCurrent
                ? 'bg-brand text-white'
                : isDone
                ? 'bg-gray-50 text-brand hover:bg-blue-50 cursor-pointer'
                : 'bg-gray-50 text-muted cursor-pointer hover:bg-gray-100',
            ].join(' ')}
          >
            {/* Step indicator */}
            <span
              className={[
                'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                isCurrent
                  ? 'bg-white text-brand'
                  : isDone
                  ? 'bg-brand text-white'
                  : 'bg-gray-200 text-muted',
              ].join(' ')}
            >
              {isDone ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              ) : (
                step.num
              )}
            </span>
            <span className="hidden sm:block">{step.label}</span>

            {/* Chevron separator */}
            {idx < STEPS.length - 1 && (
              <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-border">
                <svg width="10" height="20" viewBox="0 0 10 20" fill="none">
                  <path d="M0 0 L10 10 L0 20" stroke="#dddbda" strokeWidth="1.5" fill="none" />
                </svg>
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
