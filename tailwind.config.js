/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{liquid,md,njk,html,js}",
    "./_site/**/*.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'Arial',
          'sans-serif',
        ],
        serif: [
          'Merriweather',
          'Georgia',
          'serif',
        ],
      },
      colors: {
        bg: '#FAFAF7',
        border: '#E5E5E5',
        text: {
          primary: '#222222',
          secondary: '#555555',
        },
        accent: {
          teal: '#0C5A65',
          orange: '#D25B2D',
        },
      },
      maxWidth: {
        'content': '56rem'
      },
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}