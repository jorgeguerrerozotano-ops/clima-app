/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Semánticos: usan variables CSS para una única fuente de verdad */
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          light: 'rgb(var(--color-primary-light) / <alpha-value>)',
        },
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        waypoint: 'rgb(var(--color-waypoint) / <alpha-value>)',
        /* Superficies */
        surface: {
          body: 'rgb(var(--color-surface-body) / <alpha-value>)',
          card: 'rgb(var(--color-surface-card) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        },
        /* Texto y bordes */
        muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        'border-default': 'rgb(var(--color-border-default) / <alpha-value>)',
        /* Uso en mapas/gráficos (referencia; en JS usar theme.js) */
        'map-container': 'rgb(var(--color-map-container) / <alpha-value>)',
      },
      fontSize: {
        /* Estandarizar tamaños pequeños: evitar text-[9px] / text-[10px] arbitrarios */
        xxs: ['0.625rem', { lineHeight: '1.25rem' }],   /* 10px */
        xxxs: ['0.5625rem', { lineHeight: '1.125rem' }], /* 9px */
      },
    },
  },
  plugins: [],
}