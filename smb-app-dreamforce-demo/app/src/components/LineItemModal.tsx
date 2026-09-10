import React, { useState, useEffect } from 'react'
import { LINE_ITEM_PRODUCT_TYPES } from '../data/mockData'
import { useRFQStore } from '../store/rfqStore'

interface Props {
  onClose: () => void
}

export default function LineItemModal({ onClose }: Props) {
  const addLineItem = useRFQStore((s) => s.addLineItem)
  const [selectedType, setSelectedType] = useState(LINE_ITEM_PRODUCT_TYPES[2].id) // "vehicle"
  const [itemName, setItemName] = useState('')
  const [insuredValue, setInsuredValue] = useState('')

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const selectedProduct = LINE_ITEM_PRODUCT_TYPES.find((t) => t.id === selectedType)
  const selectedCount = 1

  const handleSave = (addAnother: boolean) => {
    if (!itemName.trim()) return
    addLineItem({
      name: itemName.trim(),
      type: selectedProduct?.label ?? selectedType,
      insuredValue: parseFloat(insuredValue) || 0,
      coverages: [],
    })
    if (addAnother) {
      setItemName('')
      setInsuredValue('')
      setSelectedType(LINE_ITEM_PRODUCT_TYPES[2].id)
    } else {
      onClose()
    }
  }

  // Group types by category
  const groups: Record<string, typeof LINE_ITEM_PRODUCT_TYPES> = {}
  LINE_ITEM_PRODUCT_TYPES.forEach((t) => {
    if (!groups[t.category]) groups[t.category] = []
    groups[t.category].push(t)
  })

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-16 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-modal w-full max-w-2xl overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-ink">Configure Line Item</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-muted mb-3">
            Pick one or more products and configure their attributes. Configuration rules and pricing
            run automatically when you save.
          </p>

          {/* Product type grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {LINE_ITEM_PRODUCT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={[
                  'flex flex-col text-left px-3 py-2.5 rounded border text-sm transition-colors',
                  selectedType === type.id
                    ? 'border-brand bg-brand-light text-brand'
                    : 'border-border bg-white text-ink hover:bg-gray-50',
                ].join(' ')}
              >
                <span className="font-semibold">{type.label}</span>
                <span className="text-xs text-muted mt-0.5">{type.category}</span>
              </button>
            ))}
          </div>

          {/* Selection count */}
          {selectedType && (
            <p className="text-xs font-bold text-ink mb-3 uppercase tracking-wide">
              Selected: {selectedCount} product
            </p>
          )}

          {/* Dynamic form */}
          {selectedType && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">
                  Item Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={selectedProduct?.label ?? 'Item name'}
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">
                  Insured Value <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                  <input
                    type="number"
                    className="form-input pl-6"
                    placeholder="0"
                    value={insuredValue}
                    onChange={(e) => setInsuredValue(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-gray-50">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleSave(true)}
            disabled={!itemName.trim()}
          >
            Save &amp; Add Another
          </button>
          <button
            className="btn-primary"
            onClick={() => handleSave(false)}
            disabled={!itemName.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
