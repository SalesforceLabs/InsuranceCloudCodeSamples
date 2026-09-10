import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { IconSettings } from '@salesforce/design-system-react'
import { DemoFlowProvider } from '@/contexts/DemoFlowContext'

// Base path prefix for static assets under public/ (empty locally, set for GitHub Pages).
const ASSET_PREFIX = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || ''

export default function App({ Component, pageProps }: AppProps) {
  return (
    <DemoFlowProvider totalSteps={10}>
      <IconSettings
        iconPath={`${ASSET_PREFIX}/assets/salesforce-lightning-design-system/icons`}
      >
        <div className="slds-scope">
          <Component {...pageProps} />
        </div>
      </IconSettings>
    </DemoFlowProvider>
  )
}
