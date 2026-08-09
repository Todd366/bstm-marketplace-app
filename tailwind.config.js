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
          purple: '#7C3AED',
          indigo: '#4F46E5',
          ink: '#1E1B4B',
        },
      },
    },
  },
  plugins: [],
};
