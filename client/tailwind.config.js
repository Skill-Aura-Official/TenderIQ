/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        primary: {
          DEFAULT: '#0052cc',
          hover: '#0043a4',
          light: '#e6f0ff',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          550: '#64748b', // Custom slate text color matching Stripe/Ramp
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        success: {
          DEFAULT: '#10b981', // Emerald green
          light: '#ecfdf5',
        },
        warning: {
          DEFAULT: '#f59e0b', // Amber
          light: '#fffbeb',
        },
        critical: {
          DEFAULT: '#ef4444', // Red
          light: '#fef2f2',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      spacing: {
        '8': '8px',
        '16': '16px',
        '24': '24px',
        '32': '32px',
      }
    },
  },
  plugins: [],
}
