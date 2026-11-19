/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './*.html',
    './js/**/*.js',
    './components/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EAF5F8', 100: '#E0F2F6', 200: '#B6E0EA', 300: '#68BECF', 400: '#2FA0B8',
          500: '#0A87A3', 600: '#00708E', 700: '#005A74', 800: '#064A5E', 900: '#06303C',
          green: '#06502F',
          ink: '#122128',
        },
      },
    },
  },
  plugins: [],
};
