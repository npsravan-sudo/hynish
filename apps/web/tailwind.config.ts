import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/** Wrap a CSS var so Tailwind can apply opacity, e.g. bg-primary/10. */
const withOpacity = (variable: string) => `hsl(var(${variable}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', md: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1440px' },
    },
    extend: {
      screens: {
        xs: '390px',
      },
      colors: {
        background: withOpacity('--background'),
        foreground: withOpacity('--foreground'),
        card: { DEFAULT: withOpacity('--card'), foreground: withOpacity('--card-foreground') },
        popover: { DEFAULT: withOpacity('--popover'), foreground: withOpacity('--popover-foreground') },
        primary: { DEFAULT: withOpacity('--primary'), foreground: withOpacity('--primary-foreground') },
        secondary: { DEFAULT: withOpacity('--secondary'), foreground: withOpacity('--secondary-foreground') },
        muted: { DEFAULT: withOpacity('--muted'), foreground: withOpacity('--muted-foreground') },
        accent: { DEFAULT: withOpacity('--accent'), foreground: withOpacity('--accent-foreground') },
        destructive: { DEFAULT: withOpacity('--danger'), foreground: withOpacity('--danger-foreground') },
        success: { DEFAULT: withOpacity('--success'), foreground: withOpacity('--success-foreground') },
        warning: { DEFAULT: withOpacity('--warning'), foreground: withOpacity('--warning-foreground') },
        danger: { DEFAULT: withOpacity('--danger'), foreground: withOpacity('--danger-foreground') },
        info: { DEFAULT: withOpacity('--info'), foreground: withOpacity('--info-foreground') },
        border: withOpacity('--border'),
        input: withOpacity('--input'),
        ring: withOpacity('--ring'),
        chart: {
          1: withOpacity('--chart-1'),
          2: withOpacity('--chart-2'),
          3: withOpacity('--chart-3'),
          4: withOpacity('--chart-4'),
          5: withOpacity('--chart-5'),
          6: withOpacity('--chart-6'),
        },
      },
      borderRadius: {
        '2xl': 'calc(var(--radius) + 6px)',
        xl: 'calc(var(--radius) + 2px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      backgroundImage: {
        'gradient-sales': 'var(--gradient-sales)',
        'gradient-revenue': 'var(--gradient-revenue)',
        'gradient-profit': 'var(--gradient-profit)',
        'gradient-expense': 'var(--gradient-expense)',
        'gradient-inventory': 'var(--gradient-inventory)',
        'gradient-customer': 'var(--gradient-customer)',
        'gradient-warning': 'var(--gradient-warning)',
        'gradient-info': 'var(--gradient-info)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
