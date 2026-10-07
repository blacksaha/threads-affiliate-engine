/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#fdfbf7',
        main: '#ffb347',
        accent: '#ff6b6b',
        border: '#111111',
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px rgba(17, 17, 17, 1)',
        'neo-sm': '2px 2px 0px 0px rgba(17, 17, 17, 1)',
        'neo-hover': '2px 2px 0px 0px rgba(17, 17, 17, 1)',
      }
    },
  },
  plugins: [],
}
