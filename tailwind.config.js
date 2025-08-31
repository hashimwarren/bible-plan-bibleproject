/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{liquid,md,njk,html,js}",
    "./_site/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#FAFAF7",
        primary: "#222222",
        secondary: "#555555",
        accent: {
          teal: "#0C5A65",
          orange: "#D25B2D",
        },
        border: "#E5E5E5",
      },
      fontFamily: {
        sans: ["Inter", "Lato", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["Merriweather", "Georgia", "serif"],
      },
      fontSize: {
        h1: "32px",
        h2: "24px",
        h3: "18px",
        body: "16px",
        small: "14px",
      },
      maxWidth: {
        content: "56rem",
      },
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}