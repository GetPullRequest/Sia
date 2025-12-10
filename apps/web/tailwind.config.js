// const { createGlobPatternsForDependencies } = require('@nx/next/tailwind');

// The above utility import will not work if you are using Next.js' --turbo.
// Instead you will have to manually add the dependent paths to be included.
// For example
// ../libs/buttons/**/*.{ts,tsx,js,jsx,html}',                 <--- Adding a shared lib
// !../libs/buttons/**/*.{stories,spec}.{ts,tsx,js,jsx,html}', <--- Skip adding spec/stories files from shared lib

// If you are **not** using `--turbo` you can uncomment both lines 1 & 19.
// A discussion of the issue can be found: https://github.com/nrwl/nx/issues/26510

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './{src,pages,components,app}/**/*.{ts,tsx,js,jsx,html}',
    '!./{src,pages,components,app}/**/*.{stories,spec}.{ts,tsx,js,jsx,html}',
    //     ...createGlobPatternsForDependencies(__dirname)
  ],
  theme: {
    extend: {
      fontSize: {
        // Custom sizes for our typography system
        subheading: ['14px', { lineHeight: '1.5' }],
        heading: ['16px', { lineHeight: '1.5' }],
        // Override Tailwind defaults to match our system
        // Base: 12px, Subheadings: 14px, Headings: 16px
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['14px', { lineHeight: '1.5' }], // Base text (12px)
        base: ['16px', { lineHeight: '1.5' }], // Also base (12px)
        lg: ['18px', { lineHeight: '1.5' }], // Subheadings (14px)
        xl: ['20px', { lineHeight: '1.5' }], // Headings (16px)
        '2xl': ['22px', { lineHeight: '1.5' }],
        '3xl': ['24px', { lineHeight: '1.5' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        // CSS variables now store hex values directly
        background: 'var(--app-background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
          lane: 'var(--card-lane)',
          sublane: 'var(--card-sublane)',
        },
        'app-background': 'var(--app-background)',
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          background: 'var(--sidebar-background)',
          selected: 'var(--sidebar-selected)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        selected: 'var(--selected)',
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',

        // Chart colors
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },

        // Status colors (same for both themes)
        status: {
          active: '#3fb950', // 142 71% 45%
          idle: '#fb8500', // 38 92% 50%
          offline: '#737373', // 0 0% 45% (light) / #a6a6a6 (dark)
          running: '#4493f8', // 217 91% 60%
          queued: '#fb8500', // 38 92% 50%
          completed: '#3fb950', // 142 71% 45%
          failed: '#e5534b', // 0 84% 60% (light) / #7c1d1d (dark)
        },
      },
      fontFamily: {
        sans: ['var(--font-nunito)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
