/**
 * Iron Log Theme Colors
 * Centralized color tokens to avoid hardcoded hex values across the app.
 * For NativeWind classes, use the Tailwind theme (primary, secondary, etc.).
 * For inline styles / library configs that require hex, import from here.
 */

export const Colors = {
  // Brand
  primary: '#E07A5F',
  secondary: '#3D5A80',
  accent: '#F2CC8F',

  // Semantic
  success: '#81B29A',
  danger: '#E63946',
  warning: '#F2CC8F',

  // Light Mode
  lightBackground: '#F4F1DE',
  lightCard: '#FFFFFF',
  lightText: '#3D405B',
  lightSubtext: '#818185',
  lightBorder: '#E0E0E0',

  // Dark Mode
  darkBackground: '#1D1917',
  darkCard: '#2A2422',
  darkText: '#F4F1DE',
  darkSubtext: '#9CA3AF',
  darkBorder: '#605050',

  // Common
  white: '#FFFFFF',
  black: '#000000',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  red400: '#EF4444',
  green500: '#10B981',
  blue300: '#cdd6f4',
  darkButton: '#3e3e3e',
} as const;

export type ColorKey = keyof typeof Colors;
