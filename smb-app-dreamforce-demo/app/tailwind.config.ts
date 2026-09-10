import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#0070d2',
          dark: '#005fb2',
          light: '#eef4ff',
        },
        sfblue: '#00a1e0',
        page: '#f3f3f3',
        card: '#ffffff',
        nav: '#181818',
        nav2: '#2e2e2e',
        muted: '#706e6b',
        border: '#dddbda',
        divider: '#f3f2f2',
        ink: '#181818',
        danger: '#c23934',
        success: '#2e844a',
        warning: '#ea7600',
        purple: '#7c3aed',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
        modal: '0 12px 32px rgba(0,0,0,0.18)',
        footer: '0 -2px 8px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}

export default config
