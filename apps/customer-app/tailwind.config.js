/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#f7f8fb', dark: '#0b1220' },
        surface: { DEFAULT: '#ffffff', dark: '#111827' },
        ink: {
          DEFAULT: '#0b1220',
          muted: '#475569',
          subtle: '#94a3b8',
        },
        brand: {
          DEFAULT: '#0f59db',
          50: '#eef4ff',
          100: '#dbe7ff',
          200: '#b3cdff',
          300: '#85adff',
          400: '#558cff',
          500: '#1f6efc',
          600: '#0f59db',
          700: '#0945a8',
          800: '#073780',
          900: '#062b65',
        },
        accent: '#22c55e',
        warn: '#f59e0b',
        danger: '#ef4444',
        border: '#e5e7eb',
      },
      fontFamily: {
        sans: ['Inter', 'System'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
