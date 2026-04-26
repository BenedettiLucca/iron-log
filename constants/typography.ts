/**
 * Typography Scale for Iron Log
 * Consistent font sizes, line heights, and spacing
 */

export const typography = {
  // Font Sizes (in px)
  xs: 12,    // Small labels, metadata (minimum accessible size)
  sm: 14,    // Body text
  base: 16,   // Subheadings
  lg: 18,    // Section headers
  xl: 20,    // Primary headings
  '2xl': 24,  // Large headings
  '3xl': 30,  // Display numbers
  '4xl': 36,  // Extra large display

  // Line Heights (ratios)
  leading: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },

  // Font Weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },

  // Letter Spacing
  tracking: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

export type TypographySize = keyof typeof typography;
export type FontWeight = keyof typeof typography.fontWeight;
export type LineHeight = keyof typeof typography.leading;
export type Tracking = keyof typeof typography.tracking;

// Helper to get Tailwind class for font size
export const getSizeClass = (size: TypographySize): string => {
  const sizes: Record<string, string> = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
  };
  return sizes[size];
};

// Helper to get Tailwind class for font weight
export const getWeightClass = (weight: FontWeight): string => {
  const weights: Record<string, string> = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    black: 'font-black',
  };
  return weights[weight];
};

// Helper to get Tailwind class for line height
export const getLeadingClass = (leading: LineHeight): string => {
  const leadings: Record<string, string> = {
    tight: 'leading-tight',
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
  };
  return leadings[leading];
};

// Helper to get Tailwind class for tracking
export const getTrackingClass = (tracking: Tracking): string => {
  const trackings: Record<string, string> = {
    tight: 'tracking-tight',
    normal: 'tracking-normal',
    wide: 'tracking-wide',
    wider: 'tracking-wider',
    widest: 'tracking-widest',
  };
  return trackings[tracking];
};
