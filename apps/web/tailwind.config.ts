import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07060a',
          900: '#0b0910',
          800: '#141019',
          700: '#1e1826',
          600: '#2a2234',
          500: '#3a3046',
        },
        velvet: {
          DEFAULT: '#e0475f',
          deep: '#9e1f3a',
          soft: '#f57d8f',
        },
        spot: {
          DEFAULT: '#f2c14e',
          soft: '#f8dc95',
        },
        like: '#3ddc97',
        nope: '#ff5d73',
        super: '#5aa9ff',
        mist: '#c9bfd6',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 60px -10px rgba(242, 193, 78, 0.45)',
        card: '0 20px 50px -20px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [],
} satisfies Config;
