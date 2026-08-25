/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: 'media',
  theme: {
    extend: {
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        'xs': ['12px', { lineHeight: '1.4', letterSpacing: '0.04em' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'base': ['16px', { lineHeight: '1.5' }],
        'lg': ['18px', { lineHeight: '1.4' }],
        'xl': ['20px', { lineHeight: '1.3' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['30px', { lineHeight: '1.2', fontWeight: '700' }],
        '4xl': ['36px', { lineHeight: '1.1', fontWeight: '800' }],
      },
      colors:{
        background: 'rgb(var(--background) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        subtext: 'rgb(var(--subtext) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        
        primary: 'rgb(var(--primary) / <alpha-value>)',
        onPrimary: 'rgb(var(--on-primary) / <alpha-value>)',
        primaryText: 'rgb(var(--primary-text) / <alpha-value>)',
        primarySurface: 'rgb(var(--primary-surface) / <alpha-value>)',

        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        onSecondary: 'rgb(var(--on-secondary) / <alpha-value>)',
        secondaryText: 'rgb(var(--secondary-text) / <alpha-value>)',
        secondarySurface: 'rgb(var(--secondary-surface) / <alpha-value>)',

        accent: 'rgb(var(--accent) / <alpha-value>)',
        onAccent: 'rgb(var(--on-accent) / <alpha-value>)',
        accentText: 'rgb(var(--accent-text) / <alpha-value>)',
        accentSurface: 'rgb(var(--accent-surface) / <alpha-value>)',
        
        success: 'rgb(var(--success) / <alpha-value>)',
        onSuccess: 'rgb(var(--on-success) / <alpha-value>)',
        successText: 'rgb(var(--success-text) / <alpha-value>)',
        successSurface: 'rgb(var(--success-surface) / <alpha-value>)',

        warning: 'rgb(var(--warning) / <alpha-value>)',
        onWarning: 'rgb(var(--on-warning) / <alpha-value>)',
        warningText: 'rgb(var(--warning-text) / <alpha-value>)',
        warningSurface: 'rgb(var(--warning-surface) / <alpha-value>)',

        danger: 'rgb(var(--danger) / <alpha-value>)',
        onDanger: 'rgb(var(--on-danger) / <alpha-value>)',
        dangerText: 'rgb(var(--danger-text) / <alpha-value>)',
        dangerSurface: 'rgb(var(--danger-surface) / <alpha-value>)',
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.08)',
        'sm': '0 2px 3px 0 rgb(0 0 0 / 0.12)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.16)',
        'lg': '0 8px 12px -2px rgb(0 0 0 / 0.20)',
        'xl': '0 12px 16px -4px rgb(0 0 0 / 0.25)',
      },
    },
  },
  plugins: [],
}
