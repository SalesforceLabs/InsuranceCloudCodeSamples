import React from 'react'
import { useRFQStore } from '../store/rfqStore'

export default function Header() {
  const rfqId = useRFQStore((s) => s.rfqDetails.rfqId)
  const accountName = useRFQStore((s) => s.rfqDetails.accountName)

  return (
    <header className="bg-nav flex items-center gap-3 px-4 h-12 flex-shrink-0">
      {/* Salesforce logo */}
      <a className="flex items-center gap-2 text-white font-bold text-lg tracking-tight no-underline mr-2" href="#">
        <svg width="24" height="24" viewBox="0 0 52 52" fill="#00a1e0">
          <path d="M21.7 7.4C23.4 5.4 25.9 4 28.8 4c4.1 0 7.6 2.6 9 6.2.8-.3 1.7-.5 2.6-.5 4.1 0 7.4 3.3 7.4 7.4 0 .4 0 .8-.1 1.2C50 19.4 52 22 52 25c0 4.1-3.3 7.4-7.4 7.4H14.4C9.2 32.4 5 28.2 5 23c0-4.3 2.8-8 6.7-9.3-.1-.5-.1-1-.1-1.5 0-4.4 3.5-8 8-7.8-.9.3 1.4 2 2.1 3z" />
        </svg>
        Salesforce
      </a>

      {/* Search */}
      <div className="flex-1 max-w-sm relative">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 fill-[#aaa]" width="14" height="14" viewBox="0 0 24 24">
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <input
          type="text"
          placeholder="Search Salesforce..."
          className="w-full bg-nav2 border border-[#444] rounded text-white text-xs py-1.5 pl-7 pr-3 outline-none placeholder-[#aaa]"
        />
      </div>

      {/* RFQ ID + account name */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[#ccc] text-xs hidden sm:block">
          {accountName ? accountName : 'No account selected'}
        </span>
        <span className="bg-nav2 border border-[#444] text-[#ccc] text-xs font-mono px-2.5 py-1 rounded">
          {rfqId}
        </span>
        <span className="badge-draft">DRAFT</span>

        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold cursor-pointer">
          JD
        </div>
      </div>
    </header>
  )
}
