import fs from 'node:fs';
import path from 'node:path';
import { Colors, getThemeColors } from '../../constants/colors';

const projectRoot = path.resolve(__dirname, '../..');
const globalCss = fs.readFileSync(path.join(projectRoot, 'global.css'), 'utf8');
// Tailwind's runtime config is CommonJS; requiring it here tests the actual exported object.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require('../../tailwind.config.js');

const expected = {
  light: {
    background: '#F4F1DE', card: '#F4F1DE', text: '#3D405B', subtext: '#686878', border: '#D6CFB8',
    primary: '#9E422E', onPrimary: '#F4F1DE', primaryText: '#9E422E', primarySurface: '#EADCC9',
    secondary: '#3D5A80', onSecondary: '#F4F1DE', secondaryText: '#3D5A80', secondarySurface: '#DEDFD3',
    accent: '#F2CC8F', onAccent: '#1D1917', accentText: '#7A5412', accentSurface: '#E5DEC6',
    success: '#81B29A', onSuccess: '#1D1917', successText: '#3F6F5C', successSurface: '#E6E7D4',
    warning: '#F2CC8F', onWarning: '#1D1917', warningText: '#7A5412', warningSurface: '#E5DEC6',
    danger: '#B42332', onDanger: '#F4F1DE', dangerText: '#B42332', dangerSurface: '#ECD8C9',
  },
  dark: {
    background: '#1D1917', card: '#2A2422', text: '#F4F1DE', subtext: '#9CA3AF', border: '#605050',
    primary: '#9E422E', onPrimary: '#F4F1DE', primaryText: '#E8927C', primarySurface: '#45332F',
    secondary: '#3D5A80', onSecondary: '#F4F1DE', secondaryText: '#91ADD2', secondarySurface: '#38373B',
    accent: '#F2CC8F', onAccent: '#1D1917', accentText: '#F2CC8F', accentSurface: '#463C31',
    success: '#81B29A', onSuccess: '#1D1917', successText: '#81B29A', successSurface: '#363833',
    warning: '#F2CC8F', onWarning: '#1D1917', warningText: '#F2CC8F', warningSurface: '#463C31',
    danger: '#B42332', onDanger: '#F4F1DE', dangerText: '#FF7B83', dangerSurface: '#483030',
  },
} as const;

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)!.map((value) => parseInt(value, 16) / 255);
  const [r, g, b] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseCssVariables(section: string): Record<string, string> {
  return Object.fromEntries([...section.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)].map((match) => {
    const hex = `#${[match[2], match[3], match[4]].map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    return [match[1], hex];
  }));
}

function collectUiFiles(): string[] {
  const files: string[] = [];
  const visit = (relativeDir: string) => {
    for (const entry of fs.readdirSync(path.join(projectRoot, relativeDir), { withFileTypes: true })) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) visit(relativePath);
      else if (/\.tsx$/.test(entry.name)) files.push(relativePath);
    }
  };
  ['app', 'components'].forEach(visit);
  return files;
}

const semanticRoles = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger'] as const;

function findAlphaSemanticTextPairs(relativePath: string, source: string): string[] {
  const lines = source.split('\n');
  const violations: string[] = [];

  lines.forEach((line, index) => {
    for (const role of semanticRoles) {
      if (!new RegExp(`\\bbg-${role}/[0-9]+\\b`).test(line)) continue;

      if (line.includes(`text-${role}Text`)) {
        violations.push(`${relativePath}:${index + 1} ${role}`);
        continue;
      }

      const isJsxContainer = line.includes('<') && line.includes('className') && !line.includes('/>');
      if (!isJsxContainer) continue;

      const openingIndent = line.match(/^\s*/)![0].length;
      for (let childIndex = index + 1; childIndex < Math.min(lines.length, index + 100); childIndex += 1) {
        const childLine = lines[childIndex];
        const childIndent = childLine.match(/^\s*/)![0].length;
        if (childIndent === openingIndent && childLine.trimStart().startsWith('</')) break;
        if (childLine.includes(`text-${role}Text`)) {
          violations.push(`${relativePath}:${index + 1} ${role}`);
          break;
        }
      }
    }
  });

  return violations;
}

function findMissingSurfaceForegrounds(relativePath: string, source: string): string[] {
  const lines = source.split('\n');
  const violations: string[] = [];
  const explicitForeground = /\btext-(text|subtext|primaryText|secondaryText|accentText|successText|warningText|dangerText|onPrimary|onSecondary|onAccent|onSuccess|onWarning|onDanger|white|black)\b/;

  lines.forEach((line, index) => {
    for (const role of semanticRoles) {
      if (!line.includes(`bg-${role}Surface`) || !line.includes('<') || !line.includes('className') || line.includes('/>')) continue;

      const openingIndent = line.match(/^\s*/)![0].length;
      for (let childIndex = index + 1; childIndex < Math.min(lines.length, index + 100); childIndex += 1) {
        const childLine = lines[childIndex];
        const childIndent = childLine.match(/^\s*/)![0].length;
        if (childIndent === openingIndent && childLine.trimStart().startsWith('</')) break;

        const textMatch = childLine.match(/<Text\s+className="([^"]+)"[^>]*>([^<{]*[A-Za-z0-9])/);
        if (textMatch && !explicitForeground.test(textMatch[1])) {
          violations.push(`${relativePath}:${childIndex + 1} ${role}`);
        }
      }
    }
  });

  return violations;
}

describe('semantic design tokens', () => {
  it('exposes the locked light and dark contracts through getThemeColors', () => {
    expect(getThemeColors('light')).toMatchObject(expected.light);
    expect(getThemeColors('dark')).toMatchObject(expected.dark);
    expect(Colors.primary).toBe('#9E422E');
  });

  it.each(['light', 'dark'] as const)('%s text roles pass WCAG AA on page and semantic surfaces', (theme) => {
    const palette = expected[theme];
    expect(contrast(palette.text, palette.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.subtext, palette.background)).toBeGreaterThanOrEqual(4.5);

    for (const role of ['primary', 'secondary', 'accent', 'success', 'warning', 'danger'] as const) {
      const text = palette[`${role}Text`];
      const surface = palette[`${role}Surface`];
      const onFill = palette[`on${role[0].toUpperCase()}${role.slice(1)}` as keyof typeof palette];
      expect(contrast(text, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(onFill, palette[role])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps CSS variables and Tailwind semantic aliases complete', () => {
    const [lightCss, darkCss] = globalCss.split('@media (prefers-color-scheme: dark)');
    const lightVariables = parseCssVariables(lightCss);
    const darkVariables = parseCssVariables(darkCss);
    const cssNames = ['on-primary', 'primary-text', 'primary-surface', 'on-secondary', 'secondary-text', 'secondary-surface', 'on-accent', 'accent-text', 'accent-surface', 'on-success', 'success-text', 'success-surface', 'on-warning', 'warning-text', 'warning-surface', 'on-danger', 'danger-text', 'danger-surface'];

    expect(cssNames.every((name) => lightVariables[name] && darkVariables[name])).toBe(true);

    const cssNameFor = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    for (const [key, value] of Object.entries(expected.light)) {
      expect(lightVariables[cssNameFor(key)]).toBe(value);
    }
    for (const [key, value] of Object.entries(expected.dark)) {
      expect(darkVariables[cssNameFor(key)]).toBe(value);
    }

    const tailwindColors = tailwindConfig.theme.extend.colors;
    for (const alias of ['onPrimary', 'primaryText', 'primarySurface', 'onSecondary', 'secondaryText', 'secondarySurface', 'onAccent', 'accentText', 'accentSurface', 'onSuccess', 'successText', 'successSurface', 'onWarning', 'warningText', 'warningSurface', 'onDanger', 'dangerText', 'dangerSurface']) {
      expect(tailwindColors[alias]).toContain('var(--');
    }
  });

  it('does not use ambiguous semantic fill tokens as text colors', () => {
    const ambiguous = /\btext-(primary|secondary|accent|success|warning|danger)(?!Text)\b/g;
    const violations = collectUiFiles().flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
      return [...source.matchAll(ambiguous)].map((match) => `${relativePath}:${source.slice(0, match.index).split('\n').length} ${match[0]}`);
    });

    expect(violations).toEqual([]);
  });

  it('reserves literal white foregrounds for media scrims', () => {
    const literalWhite = /\btext-white\b|Colors\.white|color=["']white["']/g;
    const occurrences = Object.fromEntries(collectUiFiles().map((relativePath) => {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
      return [relativePath, [...source.matchAll(literalWhite)].length] as const;
    }).filter(([, count]) => count > 0));

    expect(occurrences).toEqual({
      'app/bio/checkin.tsx': 1,
      'components/PhotoComparison.tsx': 2,
      'components/PhotoOverlay.tsx': 2,
    });
  });

  it('uses theme text roles for inline semantic icons, charts, spinners, and text', () => {
    const rawSemantic = /Colors\.(primary|secondary|accent|success|warning|danger)\b/;
    const allowedFill = /===\s*Colors\.|backgroundColor:|selectedDayBackgroundColor:|selectedColor:|trackColor=|trackColor:|minimumTrackTintColor=|thumbTintColor=|headerStyle:/;
    const rawThemeForeground = /(textColor|color|stroke|fill)=\{theme\.(primary|secondary|accent|success|warning|danger)\}/;
    const violations = collectUiFiles().flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
      return source.split('\n').flatMap((line, index) =>
        (rawSemantic.test(line) && !allowedFill.test(line)) || rawThemeForeground.test(line)
          ? [`${relativePath}:${index + 1} ${line.trim()}`]
          : []
      );
    });

    expect(violations).toEqual([]);
  });

  it('requires semantic Surface tokens when semantic text is nested inside a tinted container', () => {
    const fixture = '<View className="bg-danger/20">\n  <Text className="text-dangerText">Error</Text>\n</View>';
    expect(findAlphaSemanticTextPairs('fixture.tsx', fixture)).toEqual(['fixture.tsx:1 danger']);

    const violations = collectUiFiles().flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
      return findAlphaSemanticTextPairs(relativePath, source);
    });

    expect(violations).toEqual([]);
  });

  it('requires an explicit foreground for literal text inside semantic surfaces', () => {
    const fixture = '<View className="bg-dangerSurface">\n  <Text className="text-2xl">0-1</Text>\n</View>';
    expect(findMissingSurfaceForegrounds('fixture.tsx', fixture)).toEqual(['fixture.tsx:2 danger']);

    const violations = collectUiFiles().flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
      return findMissingSurfaceForegrounds(relativePath, source);
    });

    expect(violations).toEqual([]);
  });

  it('keeps the system status bar legible against colored headers and headerless screens', () => {
    const rootLayout = fs.readFileSync(path.join(projectRoot, 'app/_layout.tsx'), 'utf8');
    const tabsLayout = fs.readFileSync(path.join(projectRoot, 'app/(tabs)/_layout.tsx'), 'utf8');

    expect(rootLayout).toContain("statusBarStyle: 'light'");
    expect(tabsLayout).toContain('<StatusBar style="light" />');
    expect(rootLayout).toContain("statusBarStyle: colorScheme === 'dark' ? 'light' : 'dark'");
  });
});
