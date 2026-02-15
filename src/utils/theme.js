/**
 * Puente de colores del Design System para uso en JS.
 * Leaflet y Recharts no entienden clases de Tailwind; usar estas constantes
 * evita hardcodear hex en componentes de mapa y gráficas.
 *
 * Mantener en sync con las variables CSS en src/index.css.
 */

/** Colores en hex para uso en APIs que no aceptan CSS (Leaflet, Recharts, etc.) */
export const COLORS = {
  /* Semánticos */
  primary: '#3b82f6',
  primaryLight: '#93c5fd',
  danger: '#ef4444',
  success: '#22c55e',
  warning: '#eab308',
  waypoint: '#8b5cf6',

  /* Slate / superficies y texto */
  surfaceBody: '#0f172a',
  surfaceCard: '#1e293b',
  surfaceElevated: '#334155',
  borderDefault: '#475569',
  textMain: '#f1f5f9',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',

  /* Específicos */
  mapContainer: '#d6dde0',
};

/** Valores rgba recurrentes (animaciones, sombras, glow) */
export const RGBA = {
  dangerLow: 'rgba(239, 68, 68, 0.6)',
  dangerHigh: 'rgba(239, 68, 68, 0.9)',
  primaryGlow: 'rgba(96, 165, 250, 0.8)',
  primaryRing: 'rgba(59, 130, 246, 0.4)',
  pinShadow: 'rgba(0, 0, 0, 0.3)',
  pinShadowStrong: 'rgba(0, 0, 0, 0.4)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
};

export default COLORS;
