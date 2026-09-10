import React from 'react'
import { useRFQStore } from './store/rfqStore'
import Header from './components/Header'
import Stepper from './components/Stepper'
import StickyFooter from './components/StickyFooter'
import Step1CreateRFQ from './views/Step1_CreateRFQ'
import Step2PublishCarriers from './views/Step2_PublishCarriers'
import Step3CompareQuotes from './views/Step3_CompareQuotes'
import Step4BindPolicy from './views/Step4_BindPolicy'

export default function App() {
  const step = useRFQStore((s) => s.step)

  return (
    <div className="flex flex-col h-screen bg-page overflow-hidden">
      <Header />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* App nav tabs (cosmetic) */}
        <nav className="bg-nav2 flex items-center gap-0 px-2 flex-shrink-0">
          {['Home', 'Accounts', 'Contacts', 'RFQs', 'Policies', 'Carriers', 'Reports'].map(
            (tab) => (
              <a
                key={tab}
                href="#"
                className={[
                  'px-4 py-2 text-xs font-semibold transition-colors border-b-2',
                  tab === 'RFQs'
                    ? 'text-white border-white'
                    : 'text-[#bbb] border-transparent hover:text-white',
                ].join(' ')}
              >
                {tab}
              </a>
            )
          )}
        </nav>

        <Stepper />

        {/* Scrollable content area */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Step 1 — full-bleed split screen (no container constraint) */}
          {step === 1 && <Step1CreateRFQ />}

          {/* Steps 2-4 — contained scrollable area */}
          {step !== 1 && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto px-4 py-4 pb-6">
                {step === 2 && <Step2PublishCarriers />}
                {step === 3 && <Step3CompareQuotes />}
                {step === 4 && <Step4BindPolicy />}
              </div>
            </div>
          )}
        </main>

        <StickyFooter />
      </div>
    </div>
  )
}
