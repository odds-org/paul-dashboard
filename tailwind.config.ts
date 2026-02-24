import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        barlow: ['var(--font-barlow)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        amber:      '#f5b014',
        'live':     '#00e68a',
        'danger':   '#ff3355',
        'info':     '#3d8bff',
        surface:    '#0c1120',
        'surface2': '#131928',
        'card-border': 'rgba(255,255,255,0.065)',
      },
      animation: {
        'slide-in':    'slideIn 0.35s ease-out forwards',
        'pulse-slow':  'pulseSlow 2s ease-in-out infinite',
        'fade-in':     'fadeIn 0.6s ease-out forwards',
      },
      keyframes: {
        slideIn: {
          '0%':   { transform: 'translateX(-6px)', opacity: '0', backgroundColor: 'rgba(245,176,20,0.07)' },
          '100%': { transform: 'translateX(0)',    opacity: '1', backgroundColor: 'transparent' },
        },
        pulseSlow: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.35' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
