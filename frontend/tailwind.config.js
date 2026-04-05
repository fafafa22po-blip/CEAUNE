/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        marino: {
          DEFAULT: '#0a1f3d',
          50:  '#eef2f8',
          100: '#d5dff0',
          200: '#aabfe0',
          300: '#7a9bcc',
          400: '#4e78b8',
          500: '#2e5a9e',
          600: '#1e4080',
          700: '#152f60',
          800: '#0d2048',
          900: '#0a1f3d',
        },
        dorado: {
          DEFAULT: '#c9a227',
          50:  '#fdf8e8',
          100: '#faefc3',
          200: '#f5de88',
          300: '#efca4e',
          400: '#e6b52a',
          500: '#c9a227',
          600: '#a07d1a',
          700: '#7a5e12',
          800: '#55410d',
          900: '#322607',
        },
        crema: {
          DEFAULT: '#f8f7f4',
          dark:    '#eeecea',
        },
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'float':   '0 8px 28px rgba(0,0,0,0.13), 0 4px 10px rgba(0,0,0,0.06)',
        'bottom':  '0 -2px 16px rgba(0,0,0,0.07)',
        'topbar':  '0 2px 16px rgba(10,31,61,0.18)',
        'scan':    '0 4px 16px rgba(201,162,39,0.40)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      keyframes: {
        scanline: {
          '0%, 100%': { top: '8%' },
          '50%':      { top: '88%' },
        },
        'spring-up': {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '65%':  { transform: 'translateY(-8px)',  opacity: '1' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1)    translateY(0)'   },
        },
        'bounce-pop': {
          '0%':   { opacity: '0', transform: 'scale(0.75)' },
          '60%':  { opacity: '1', transform: 'scale(1.06)' },
          '100%': { opacity: '1', transform: 'scale(1)'    },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
        'fade-in-fast': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Transición entre páginas: fade limpio sin translateY (patrón nativo)
        'page-enter': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        scanline:       'scanline 2.2s ease-in-out infinite',
        'spring-up':    'spring-up 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'scale-in':     'scale-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'bounce-pop':   'bounce-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-up':      'fade-up 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in-fast': 'fade-in-fast 0.18s ease-out forwards',
        'page-enter':   'page-enter 0.13s ease-out forwards',
      },
    },
  },
  plugins: [],
}
