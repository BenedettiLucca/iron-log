/**
 * Typography Scale for Iron Log
 * Consistent text sizing across the application
 */

export const typography = {
  xs: '10',   // Labels, metadata, badges
  sm: '12',   // Subtitles, secondary text
  base: '14', // Body text, default
  lg: '16',   // Headings, important text
  xl: '18',   // Large headings
  '2xl': '20', // Section headers, page titles
  '3xl': '24', // Special emphasis
  '4xl': '30', // Hero text, timers
  '5xl': '36', // Extra large displays
  '6xl': '48', // Massive displays
  '7xl': '60', // Maximum displays
} as const;

export type TypographyScale = keyof typeof typography;
