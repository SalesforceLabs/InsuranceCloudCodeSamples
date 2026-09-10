import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRFQStore } from '../store/rfqStore'
import { MOCK_ACCOUNTS, COVERAGE_LINES } from '../data/mockData'
import LineItemModal from '../components/LineItemModal'

// ── Section definitions ───────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'sec-lob', label: 'Line of Business', icon: '🏢' },
  { id: 'sec-app', label: 'RFQ Application', icon: '📄' },
  { id: 'sec-insured', label: 'Insured Information', icon: '👤' },
  { id: 'sec-coverage', label: 'Lines of Coverage', icon: '🛡️' },
  { id: 'sec-period', label: 'Policy Period', icon: '📅' },
  { id: 'sec-items', label: 'Line Items', icon: '📋' },
]

// ── LOB visual-picker data ────────────────────────────────────────────────────
const LOB_PICKS = [
  {
    value: 'Commercial Property',
    title: 'Commercial Property',
    subtitle: 'Buildings, contents, business personal property',
    accent: '#f3b23f',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3l-9 8h3v9h5v-6h2v6h5v-9h3z" />
      </svg>
    ),
  },
  {
    value: 'Commercial Auto',
    title: 'Commercial Auto',
    subtitle: 'Fleet vehicles, liability, physical damage',
    accent: '#0070d2',
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81L6.85 7zM19 17H5v-5h14v5zM7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
      </svg>
    ),
  },
]

// ── Small helpers ─────────────────────────────────────────────────────────────
function SvgIcon({ path }: { path: string }) {
  return (
    <svg className="w-4 h-4 fill-muted flex-shrink-0" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  )
}

function Field({
  label,
  required,
  children,
  span2,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  span2?: boolean
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="form-label">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Step1CreateRFQ() {
  const rfqDetails = useRFQStore((s) => s.rfqDetails)
  const updateRFQDetails = useRFQStore((s) => s.updateRFQDetails)
  const toggleLineOfCoverage = useRFQStore((s) => s.toggleLineOfCoverage)
  const removeLineItem = useRFQStore((s) => s.removeLineItem)
  const clearLineItems = useRFQStore((s) => s.clearLineItems)

  const [showModal, setShowModal] = useState(false)
  const [accountSearch, setAccountSearch] = useState(rfqDetails.accountName)
  const [showAccountResults, setShowAccountResults] = useState(false)
  const [activeSection, setActiveSection] = useState('sec-lob')

  const workspaceRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  // Intersection observer to track active section as user scrolls
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { root: workspaceRef.current, threshold: 0.3, rootMargin: '-10% 0px -60% 0px' }
    )
    SECTIONS.forEach(({ id }) => {
      const el = sectionRefs.current[id]
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const scrollTo = useCallback((id: string) => {
    const el = sectionRefs.current[id]
    if (el && workspaceRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(id)
    }
  }, [])

  const setSectionRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el
  }

  const accountResults = MOCK_ACCOUNTS.filter(
    (a) =>
      accountSearch.length > 0 &&
      (a.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
        a.city.toLowerCase().includes(accountSearch.toLowerCase()))
  ).slice(0, 5)

  const totalInsuredValue = rfqDetails.lineItems.reduce((s, li) => s + li.insuredValue, 0)

  function fmt(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  return (
    <div className="flex flex-1 overflow-hidden" style={{ height: '100%' }}>
      {/* ════════════ LEFT SIDEBAR — vertical section nav ════════════ */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-border flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-divider">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest">RFQ Progress</h2>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          <ul>
            {SECTIONS.map((sec, idx) => {
              const isActive = activeSection === sec.id
              return (
                <li key={sec.id}>
                  <button
                    onClick={() => scrollTo(sec.id)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors border-l-4',
                      isActive
                        ? 'border-brand bg-brand-light text-brand font-semibold'
                        : 'border-transparent text-ink hover:bg-gray-50 hover:text-brand',
                    ].join(' ')}
                  >
                    {/* Step circle */}
                    <span
                      className={[
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                        isActive ? 'bg-brand text-white' : 'bg-gray-100 text-muted',
                      ].join(' ')}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate">{sec.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Progress hint */}
        <div className="px-4 py-3 border-t border-divider">
          <div className="text-xs text-muted mb-1.5">Form progress</div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-brand h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.round(((SECTIONS.findIndex((s) => s.id === activeSection) + 1) / SECTIONS.length) * 100)}%`,
              }}
            />
          </div>
          <div className="text-xs text-muted mt-1">
            Step {SECTIONS.findIndex((s) => s.id === activeSection) + 1} of {SECTIONS.length}
          </div>
        </div>
      </aside>

      {/* ════════════ RIGHT WORKSPACE ════════════ */}
      <div ref={workspaceRef} className="flex-1 overflow-y-auto bg-page">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6 pb-12">

          {/* ── Line of Business (Visual Pickers) ── */}
          <section ref={setSectionRef('sec-lob')} id="sec-lob" className="scroll-mt-4">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink">Line of Business</h2>
              <p className="text-sm text-muted mt-0.5">Select the primary line of business for this RFQ.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {LOB_PICKS.map((pick) => {
                const selected = rfqDetails.lob === pick.value
                return (
                  <button
                    key={pick.value}
                    type="button"
                    onClick={() => updateRFQDetails({ lob: pick.value })}
                    className={[
                      'relative flex flex-col items-center text-center p-6 rounded-lg border-2 transition-all duration-150 group',
                      selected
                        ? 'border-brand bg-brand-light shadow-md'
                        : 'border-border bg-white hover:border-brand hover:shadow-card',
                    ].join(' ')}
                  >
                    {/* Selected checkmark */}
                    {selected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                        <svg className="w-3 h-3 fill-white" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    )}

                    {/* Icon */}
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center mb-3 text-white"
                      style={{ backgroundColor: pick.accent }}
                    >
                      {pick.icon}
                    </div>

                    <div className="font-bold text-base text-ink mb-1">{pick.title}</div>
                    <div className="text-sm text-muted">{pick.subtitle}</div>

                    {/* Radio indicator */}
                    <div className={[
                      'mt-3 flex items-center gap-1.5 text-xs font-semibold',
                      selected ? 'text-brand' : 'text-muted',
                    ].join(' ')}>
                      <div className={[
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                        selected ? 'border-brand' : 'border-muted',
                      ].join(' ')}>
                        {selected && <div className="w-2 h-2 rounded-full bg-brand" />}
                      </div>
                      {selected ? 'Selected' : pick.title.split(' ').pop()}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── RFQ Application ── */}
          <section ref={setSectionRef('sec-app')} id="sec-app" className="scroll-mt-4">
            <div className="section-card">
              <div className="section-header">
                <SvgIcon path="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                <span>RFQ Application</span>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="RFQ Application" required>
                    <div className="flex gap-4 mt-1">
                      {['New Application', 'Renew Existing'].map((opt) => (
                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name="rfqApp"
                            className="accent-brand"
                            checked={rfqDetails.isRenewal === (opt === 'Renew Existing')}
                            onChange={() => updateRFQDetails({ isRenewal: opt === 'Renew Existing' })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Application Name">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. ACME Renewal 2026"
                      value={rfqDetails.applicationName}
                      onChange={(e) => updateRFQDetails({ applicationName: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </section>

          {/* ── Insured Information ── */}
          <section ref={setSectionRef('sec-insured')} id="sec-insured" className="scroll-mt-4">
            <div className="section-card">
              <div className="section-header">
                <SvgIcon path="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                <span>Insured Information</span>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Account lookup */}
                  <div className="relative">
                    <label className="form-label">
                      Account (Insured)<span className="text-danger ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 fill-muted w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                      </svg>
                      <input
                        type="text"
                        className="form-input pl-8"
                        placeholder="Search accounts..."
                        value={accountSearch}
                        onChange={(e) => { setAccountSearch(e.target.value); setShowAccountResults(true) }}
                        onFocus={() => setShowAccountResults(true)}
                        onBlur={() => setTimeout(() => setShowAccountResults(false), 150)}
                      />
                    </div>
                    {showAccountResults && accountResults.length > 0 && (
                      <ul className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-border rounded shadow-card overflow-hidden">
                        {accountResults.map((a) => (
                          <li key={a.id}>
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-brand-light text-sm"
                              onMouseDown={() => {
                                updateRFQDetails({ accountName: a.name })
                                setAccountSearch(a.name)
                                setShowAccountResults(false)
                              }}
                            >
                              <div className="font-semibold text-ink">{a.name}</div>
                              <div className="text-xs text-muted">{a.industry} · {a.city}</div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <Field label="Primary Contact">
                    <input type="text" className="form-input" placeholder="Enter contact name"
                      value={rfqDetails.primaryContact}
                      onChange={(e) => updateRFQDetails({ primaryContact: e.target.value })} />
                  </Field>

                  <Field label="Contact Email">
                    <input type="email" className="form-input" placeholder="Enter email address"
                      value={rfqDetails.contactEmail}
                      onChange={(e) => updateRFQDetails({ contactEmail: e.target.value })} />
                  </Field>

                  <div className="sm:col-span-2">
                    <label className="form-label">Replicate from prior policy (optional)</label>
                    <input type="text" className="form-input" placeholder="Search this account's existing policies..."
                      value={rfqDetails.replicateFromPolicy}
                      onChange={(e) => updateRFQDetails({ replicateFromPolicy: e.target.value })} />
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input id="useExisting" type="checkbox" className="accent-brand"
                      checked={rfqDetails.useExistingData}
                      onChange={(e) => updateRFQDetails({ useExistingData: e.target.checked })} />
                    <label htmlFor="useExisting" className="text-sm cursor-pointer">Use this policy's data</label>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Lines of Coverage ── */}
          <section ref={setSectionRef('sec-coverage')} id="sec-coverage" className="scroll-mt-4">
            <div className="section-card">
              <div className="section-header">
                <SvgIcon path="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                <span>Lines of Coverage</span>
                {rfqDetails.linesOfCoverage.length > 0 && (
                  <span className="ml-auto text-xs font-semibold text-brand">
                    {rfqDetails.linesOfCoverage.length} selected
                  </span>
                )}
              </div>
              <div className="section-body">
                <p className="text-xs text-muted mb-3">
                  Select one or more coverage lines. Each becomes a separate RFQ in the submission package.
                </p>
                <div className="flex flex-wrap gap-2">
                  {COVERAGE_LINES.map((cov) => {
                    const selected = rfqDetails.linesOfCoverage.includes(cov.id)
                    return (
                      <button
                        key={cov.id}
                        type="button"
                        onClick={() => toggleLineOfCoverage(cov.id)}
                        className={[
                          'px-4 py-2 rounded border text-sm font-semibold transition-colors',
                          selected
                            ? 'bg-brand text-white border-brand'
                            : 'bg-white text-ink border-border hover:border-brand hover:text-brand',
                        ].join(' ')}
                      >
                        {selected && (
                          <svg className="inline w-3 h-3 mr-1 mb-0.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                        {cov.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* ── Policy Period & Requirements ── */}
          <section ref={setSectionRef('sec-period')} id="sec-period" className="scroll-mt-4">
            <div className="section-card">
              <div className="section-header">
                <SvgIcon path="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                <span>Policy Period &amp; Requirements</span>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Effective Date" required>
                    <input type="date" className="form-input" value={rfqDetails.effectiveDate}
                      onChange={(e) => updateRFQDetails({ effectiveDate: e.target.value })} />
                  </Field>
                  <Field label="Expiration Date" required>
                    <input type="date" className="form-input" value={rfqDetails.expirationDate}
                      onChange={(e) => updateRFQDetails({ expirationDate: e.target.value })} />
                  </Field>
                  <Field label="Response Deadline">
                    <input type="date" className="form-input" value={rfqDetails.responseDeadline}
                      onChange={(e) => updateRFQDetails({ responseDeadline: e.target.value })} />
                  </Field>
                  <div>
                    <label className="form-label">Total Insured Value</label>
                    <div className="form-input bg-gray-50 font-semibold text-ink">{fmt(totalInsuredValue)}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Insured Line Items ── */}
          <section ref={setSectionRef('sec-items')} id="sec-items" className="scroll-mt-4">
            <div className="section-card">
              <div className="section-header">
                <SvgIcon path="M3 9h6V3H3v6zm0 12h6v-6H3v6zm8 0h6v-6h-6v6zm8 0h6v-6h-6v6zm-8-8h6V7h-6v6zm8-10v6h6V3h-6z" />
                <span>Insured Line Items</span>
                <div className="ml-auto flex items-center gap-2">
                  {rfqDetails.lineItems.length > 0 && (
                    <span className="text-xs text-muted">
                      Total: <strong className="text-ink">{fmt(totalInsuredValue)}</strong>
                    </span>
                  )}
                  <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setShowModal(true)}>
                    + Add Line Item
                  </button>
                  {rfqDetails.lineItems.length > 0 && (
                    <button className="btn-secondary text-xs py-1.5 px-3" onClick={clearLineItems}>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="section-body p-0">
                {rfqDetails.lineItems.length === 0 ? (
                  <div className="text-center py-12 text-muted px-4">
                    <svg className="w-10 h-10 fill-border mx-auto mb-2" viewBox="0 0 24 24">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" />
                    </svg>
                    <p className="text-sm font-medium text-[#444]">No line items yet</p>
                    <p className="text-xs mt-1">
                      Pick a coverage line above and click "+ Add Line Item" to get started.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gray-50 text-xs uppercase tracking-wide text-muted">
                        <th className="text-left px-4 py-2">Name</th>
                        <th className="text-left px-4 py-2">Type</th>
                        <th className="text-right px-4 py-2">Insured Value</th>
                        <th className="text-right px-4 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfqDetails.lineItems.map((li) => (
                        <tr key={li.id} className="border-b border-divider hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-ink">{li.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="lob-pill">{li.type}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-ink">{fmt(li.insuredValue)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => removeLineItem(li.id)}
                              className="text-muted hover:text-danger" title="Remove">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      {showModal && <LineItemModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
