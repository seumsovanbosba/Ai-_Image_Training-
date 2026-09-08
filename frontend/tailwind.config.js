/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#c4e7ff',
          400: '#8ed5ff',
          500: '#38bdf8',
          600: '#38bdf8',
          700: '#00668a',
        },
        surface: {
          base: '#101319',
          panel: '#1d2026',
          subpanel: '#191c22',
          card: '#272a31',
          border: '#3e484f',
          borderLight: '#87929a',
          hover: '#32353c',
        },
        background: '#101319',
        'on-surface': '#e1e2eb',
        'on-surface-variant': '#bdc8d1',
        'surface-container-lowest': '#0b0e14',
        'surface-container-low': '#191c22',
        'surface-container': '#1d2026',
        'surface-container-high': '#272a31',
        'surface-container-highest': '#32353c',
        'surface-bright': '#363940',
        'surface-dim': '#101319',
        primary: '#8ed5ff',
        'primary-container': '#38bdf8',
        'primary-fixed-dim': '#7bd0ff',
        'on-primary': '#00354a',
        'on-primary-container': '#004965',
        secondary: '#adc6ff',
        'secondary-container': '#0566d9',
        tertiary: '#56e5a9',
        'tertiary-container': '#30c88f',
        outline: '#87929a',
        'outline-variant': '#3e484f',
      },
      spacing: {
        'dock-max-width': '54rem',
        'sidebar-width': '17.5rem',
        sidebar: '17.5rem',
        'modal-width': '28rem',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        'display-hero': ['40px', { lineHeight: '48px', letterSpacing: '-0.03em', fontWeight: '600' }],
        'headline-md': ['18px', { lineHeight: '26px', letterSpacing: '-0.015em', fontWeight: '500' }],
        'body-lg': ['15px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '400' }],
        'body-md': ['13px', { lineHeight: '20px', letterSpacing: '0em', fontWeight: '400' }],
        'label-caps': ['11px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '500' }],
        'mono-data': ['12px', { lineHeight: '18px', letterSpacing: '-0.01em', fontWeight: '400' }],
      },
      boxShadow: {
        dock: '0 20px 50px rgba(0,0,0,0.65)',
        dockFocus: '0 0 24px rgba(56,189,248,0.22)',
      },
      maxWidth: {
        dock: '54rem',
      },
      width: {
        sidebar: '17.5rem',
      },
    }
  },
  plugins: [],
}
