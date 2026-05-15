/**
 * Design tokens for the customer mobile app.
 *
 * Mirrors the brand palette used on the public website / dashboard so the
 * three customer-facing surfaces stay visually consistent. Importable from
 * both styled (NativeWind className) and unstyled (StyleSheet / inline)
 * components.
 */
export const colors = {
  bg: '#f7f8fb',
  bgDark: '#0b1220',
  surface: '#ffffff',
  surfaceDark: '#111827',
  ink: '#0b1220',
  inkMuted: '#475569',
  inkSubtle: '#94a3b8',
  brand: '#0f59db',
  brand50: '#eef4ff',
  brand600: '#0f59db',
  brand700: '#0945a8',
  accent: '#22c55e',
  warn: '#f59e0b',
  danger: '#ef4444',
  border: '#e5e7eb',
  white: '#ffffff',
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 24,
  full: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  h2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  micro: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
} as const;

export const shadow = {
  sm: {
    shadowColor: '#0b1220',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: '#0b1220',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
} as const;

export type ColorName = keyof typeof colors;
