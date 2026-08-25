/**
 * Iron Log Theme Colors
 * Centralized color tokens to avoid hardcoded hex values across the app.
 * For NativeWind classes, use the Tailwind theme (primary, secondary, etc.).
 * For inline styles / library configs that require hex, import from here.
 */

export const Colors = {
  // Brand
  primary: '#9E422E',
  secondary: '#3D5A80',
  accent: '#F2CC8F',

  // Semantic
  success: '#81B29A',
  danger: '#B42332',
  warning: '#F2CC8F',

  // Light Mode
  lightBackground: '#F4F1DE',
  lightCard: '#F4F1DE',
  lightText: '#3D405B',
  lightSubtext: '#686878',
  lightBorder: '#D6CFB8',

  // Dark Mode
  darkBackground: '#1D1917',
  darkCard: '#2A2422',
  darkText: '#F4F1DE',
  darkSubtext: '#9CA3AF',
  darkBorder: '#605050',

  // Theme-independent on* foregrounds
  onPrimary: '#F4F1DE',
  onSecondary: '#F4F1DE',
  onAccent: '#1D1917',
  onSuccess: '#1D1917',
  onWarning: '#1D1917',
  onDanger: '#F4F1DE',

  // Theme-specific light*Text and dark*Text values
  lightPrimaryText: '#9E422E',
  darkPrimaryText: '#E8927C',
  lightSecondaryText: '#3D5A80',
  darkSecondaryText: '#91ADD2',
  lightAccentText: '#7A5412',
  darkAccentText: '#F2CC8F',
  lightSuccessText: '#3F6F5C',
  darkSuccessText: '#81B29A',
  lightWarningText: '#7A5412',
  darkWarningText: '#F2CC8F',
  lightDangerText: '#B42332',
  darkDangerText: '#FF7B83',

  // Theme-specific light*Surface and dark*Surface values
  lightPrimarySurface: '#EADCC9',
  darkPrimarySurface: '#45332F',
  lightSecondarySurface: '#DEDFD3',
  darkSecondarySurface: '#38373B',
  lightAccentSurface: '#E5DEC6',
  darkAccentSurface: '#463C31',
  lightSuccessSurface: '#E6E7D4',
  darkSuccessSurface: '#363833',
  lightWarningSurface: '#E5DEC6',
  darkWarningSurface: '#463C31',
  lightDangerSurface: '#ECD8C9',
  darkDangerSurface: '#483030',

  // Common
  white: '#FFFFFF',
  black: '#000000',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  red400: '#EF4444',
  green500: '#10B981',
  blue300: '#cdd6f4',
  darkButton: '#3e3e3e',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export type ColorKey = keyof typeof Colors;

/**
 * Returns hex color tokens for the current theme.
 * Useful for RN components/props that don't support Tailwind classes.
 */
export function getThemeColors(colorScheme: 'light' | 'dark' | null | undefined) {
  const isDark = colorScheme === 'dark';
  return {
    background: isDark ? Colors.darkBackground : Colors.lightBackground,
    card: isDark ? Colors.darkCard : Colors.lightCard,
    text: isDark ? Colors.darkText : Colors.lightText,
    subtext: isDark ? Colors.darkSubtext : Colors.lightSubtext,
    border: isDark ? Colors.darkBorder : Colors.lightBorder,

    primary: Colors.primary,
    onPrimary: Colors.onPrimary,
    primaryText: isDark ? Colors.darkPrimaryText : Colors.lightPrimaryText,
    primarySurface: isDark ? Colors.darkPrimarySurface : Colors.lightPrimarySurface,

    secondary: Colors.secondary,
    onSecondary: Colors.onSecondary,
    secondaryText: isDark ? Colors.darkSecondaryText : Colors.lightSecondaryText,
    secondarySurface: isDark ? Colors.darkSecondarySurface : Colors.lightSecondarySurface,

    accent: Colors.accent,
    onAccent: Colors.onAccent,
    accentText: isDark ? Colors.darkAccentText : Colors.lightAccentText,
    accentSurface: isDark ? Colors.darkAccentSurface : Colors.lightAccentSurface,

    success: Colors.success,
    onSuccess: Colors.onSuccess,
    successText: isDark ? Colors.darkSuccessText : Colors.lightSuccessText,
    successSurface: isDark ? Colors.darkSuccessSurface : Colors.lightSuccessSurface,

    warning: Colors.warning,
    onWarning: Colors.onWarning,
    warningText: isDark ? Colors.darkWarningText : Colors.lightWarningText,
    warningSurface: isDark ? Colors.darkWarningSurface : Colors.lightWarningSurface,

    danger: Colors.danger,
    onDanger: Colors.onDanger,
    dangerText: isDark ? Colors.darkDangerText : Colors.lightDangerText,
    dangerSurface: isDark ? Colors.darkDangerSurface : Colors.lightDangerSurface,

    overlay: Colors.overlay,
  } as const;
}
