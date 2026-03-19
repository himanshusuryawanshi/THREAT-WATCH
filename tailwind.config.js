/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark:    '#080b10',
        panel:   '#0a0e15',
        panel2:  '#0d1117',
        border:  '#1a2030',
        border2: '#1f2937',
        muted:   '#6b7280',
        threat:  '#ff2a2a',
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        oswald: ['Oswald', 'sans-serif'],
      },
    },
  },
  plugins: [],
}