import React from 'react'
import { useRFQStore } from '../store/rfqStore'
import { MOCK_QUOTES } from '../data/mockData'

interface StickyFooterProps {
  onPublish?: () => void
  onBind?: () => void
}

export default function StickyFooter({ onPublish, onBind }: StickyFooterProps) {
  const step = useRFQStore((s) => s.step)
  const setStep = useRFQStore((s) => s.setStep)
  const acceptedQuoteId = useRFQStore((s) => s.acceptedQuoteId)
  const setQuotes = useRFQStore((s) => s.setQuotes)

  const goBack = () => setStep((step - 1) as 1 | 2 | 3 | 4)

  const handleNext = () => {
    if (step === 2 && onPublish) onPublish()
    if (step === 3 && acceptedQuoteId) {
      setStep(4)
      return
    }
    if (step < 4) setStep((step + 1) as 2 | 3 | 4)
  }

  // Simulate quote delivery on publish
  const handlePublish = () => {
    setQuotes(MOCK_QUOTES)
    setStep(3)
  }

  return (
    <footer className="flex items-center justify-between px-6 py-3 bg-white border-t border-border shadow-footer flex-shrink-0 z-20">
      <div className="flex items-center gap-2">
        <button className="btn-danger" onClick={() => {}}>
          Cancel
        </button>
        <button className="btn-secondary" onClick={() => {}}>
          Save as Draft
        </button>
      </div>

      <div className="flex items-center gap-2">
        {step > 1 && (
          <button className="btn-secondary" onClick={goBack}>
            ← Back
          </button>
        )}

        {step === 1 && (
          <button className="btn-primary" onClick={() => setStep(2)}>
            Next: Publish to Carriers →
          </button>
        )}

        {step === 2 && (
          <button className="btn-primary" onClick={handlePublish}>
            Publish &amp; Send →
          </button>
        )}

        {step === 3 && (
          <button
            className="btn-primary disabled:opacity-40"
            disabled={!acceptedQuoteId}
            onClick={() => acceptedQuoteId && setStep(4)}
          >
            Bind Selected →
          </button>
        )}

        {step === 4 && (
          <button className="btn-primary" onClick={onBind}>
            Bind Policy
          </button>
        )}
      </div>
    </footer>
  )
}
