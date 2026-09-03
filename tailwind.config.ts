import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Rotaract-inspired but deliberately restrained: cranberry accent on neutral ground. */
        brand: {
          50: '#fdf2f6',
          100: '#fce7ef',
          200: '#fbcfe0',
          300: '#f7a8c6',
          400: '#f0739f',
          500: '#e2467c',
          600: '#cd2a63',
          700: '#ac1c4f',
          800: '#8f1b44',
          900: '#781b3d',
          950: '#48081f',
        },
        azure: {
          50: '#eff8ff',
          100: '#dbeefe',
          500: '#1f7ae0',
          600: '#1462bd',
          700: '#134f99',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#dfe3ea',
          300: '#c6ccd8',
          400: '#98a1b3',
          500: '#6b7385',
          600: '#4e5566',
          700: '#3b4150',
          800: '#252a36',
          900: '#161a23',
        },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        pop: '0 8px 30px rgba(16,24,40,.12)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
