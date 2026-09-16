/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        'neon': '0 0 20px rgba(217, 4, 41, 0.3), 0 0 40px rgba(217, 4, 41, 0.1)',
        'neon-lg': '0 0 30px rgba(217, 4, 41, 0.4), 0 0 60px rgba(217, 4, 41, 0.2)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(217, 4, 41, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(217, 4, 41, 0.5)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}