/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FBF7EC', 100: '#F5ECD0', 200: '#EBD9A2', 300: '#DEC073', 400: '#D0A94F',
          500: '#C5A059', 600: '#A9843F', 700: '#866633', 800: '#6F532E', 900: '#5C4529', 950: '#35240F'
        },
        surface: {
          50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB', 400: '#9CA3AF',
          500: '#6B7280', 600: '#4B5563', 700: '#374151', 800: '#1F2937', 900: '#111827', 950: '#0B0F1A'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        luxury: '0 20px 50px -12px rgb(197 160 89 / 0.25)'
      },
      backdropBlur: { xs: '2px' }
    }
  },
  plugins: []
};
