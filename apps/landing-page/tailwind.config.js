const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        background: '#08090a',
        card: '#141516',
        text: '#f7f8f8',
        primary: '#e6e6e6',
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'sans-serif'],
      },
      fontSize: {
        'heading': ['2rem', { lineHeight: '1.3' }],        // Mobile: 32px
        'heading-md': ['2rem', { lineHeight: '1.3' }],   // Tablet: 40px
        'heading-lg': ['2.5rem', { lineHeight: '1.3' }],  // Desktop: 44px
        'subheading': ['1.2rem', { lineHeight: '1.4' }],  // Mobile: 20px
        'subheading-md': ['1.5rem', { lineHeight: '1.4' }], // Tablet: 24px
        'subheading-lg': ['1.5rem', { lineHeight: '1.4' }], // Desktop: 28px
        'body': ['1rem', { lineHeight: '1.6' }],       // Mobile: 14px
        'body-md': ['1rem', { lineHeight: '1.6' }],        // Desktop: 16px
      },
      fontWeight: {
        'heading': '500',
        'body': '200',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
