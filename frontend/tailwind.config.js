/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#07663D',
          50:  '#F1F7F3',
          100: '#E0EDE5',
          200: '#C2DBCC',
          300: '#94C2A8',
          400: '#4E9A72',
          500: '#0A7A47',
          600: '#07663D',
          700: '#054E2E',
          800: '#044026',
          900: '#032F1C',
        },
        brand: {
          green: '#07663D',
          gold:  '#C9A21C',
        },
      },
      fontFamily: {
        sans: ['Onest', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
