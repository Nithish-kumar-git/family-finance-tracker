/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)', surface: 'var(--color-surface)', ink: 'var(--color-ink)',
        muted: 'var(--color-muted)', line: 'var(--color-line)', accent: 'var(--color-accent)', 'accent-soft': 'var(--color-accent-soft)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
