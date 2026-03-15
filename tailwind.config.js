/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef6ff',
          100: '#daeaff',
          200: '#bdd9ff',
          300: '#90c0ff',
          400: '#5c9ef8',
          500: '#3a7ef0',
          600: '#1B6CA8',
          700: '#0F2942',
          800: '#0a1e32',
          900: '#071628',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
