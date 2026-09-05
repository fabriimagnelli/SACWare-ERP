/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif']
      },
      colors: {
        ink: '#0b1220',
        mist: '#eef4f4',
        aqua: '#86e3d1'
      }
    }
  },
  plugins: []
};
