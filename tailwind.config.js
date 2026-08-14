/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        quran: ['"Amiri Quran"', 'Amiri', 'serif'],
      },
    },
  },
  plugins: [],
};
