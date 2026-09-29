/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tiktok: {
          red: '#FE2C55',
          cyan: '#25F4EE',
          dark: '#121212',
          black: '#010101',
          card: '#161823',
          cardLight: '#1f212d',
          border: 'rgba(255, 255, 255, 0.12)',
          muted: '#8a8b91',
        },
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
        },
      },
      animation: {
        'spin-slow': 'spin 4s linear infinite',
        marquee: 'marquee 12s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      boxShadow: {
        'tiktok-glow': '0 0 15px -3px rgba(37, 244, 238, 0.4), 0 0 15px -3px rgba(254, 44, 85, 0.4)',
      },
    },
  },
  plugins: [],
};
