/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ceaune: {
          navy:  '#0a1f3d',
          gold:  '#c9a227',
          teal:  '#1a5c52',
          'navy-light': '#0f2d5a',
          'gold-light': '#e0b840',
          'teal-light': '#226b60',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
