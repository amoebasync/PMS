/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // InterとNoto Sans JPを優先的に使う設定
        sans: ['var(--font-inter)', 'var(--font-notojp)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      boxShadow: {
        'up': '0 -2px 8px -2px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}