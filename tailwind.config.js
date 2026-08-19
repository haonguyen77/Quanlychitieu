/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F3EAFF',
          100: '#E4D4FF',
          200: '#C9A9FF',
          300: '#AE7EFF',
          400: '#9353FF',
          500: '#6C2BD9',
          600: '#5A22B8',
          700: '#481A96',
          800: '#361275',
          900: '#240A53',
        },
      },
    },
  },
  plugins: [],
};
