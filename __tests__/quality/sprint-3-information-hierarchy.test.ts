import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

const aboutSource = readSource('../../app/about.tsx');
const settingsSource = readSource('../../app/(tabs)/settings.tsx');
const weeklyReportSource = readSource('../../app/reports/weekly.tsx');

describe('Sprint 3 information hierarchy', () => {
  it('flattens static About sections and keeps the root-owned header', () => {
    expect(aboutSource).not.toMatch(/import\s+\{[^}]*\bCard\b[^}]*\}\s+from/);
    expect(aboutSource).not.toContain('<Card');
    expect(aboutSource).not.toContain('<Stack.Screen');
  });

  it('renders Settings as flat sections rather than ornamental cards', () => {
    expect(settingsSource).not.toMatch(/import\s+\{[^}]*\bCard\b[^}]*\}\s+from/);
    expect(settingsSource).not.toContain('<Card');
  });

  it('keeps language selections at the 44dp touch-target floor', () => {
    expect(settingsSource).toMatch(/setLanguage\(lang\)[\s\S]{0,220}min-h-\[44px\]/);
  });

  it('uses theme roles for the native settings switch', () => {
    expect(settingsSource).toContain('trackColor={{ false: theme.border, true: theme.primary }}');
    expect(settingsSource).toContain('thumbColor={theme.onPrimary}');
    expect(settingsSource).not.toContain('Colors.white');
  });

  it('keeps only the period banner as the Weekly Report card anchor', () => {
    expect(weeklyReportSource.match(/<Card\b/g) ?? []).toHaveLength(1);
  });

  it('does not duplicate the root-owned Weekly Report title', () => {
    expect(weeklyReportSource).not.toMatch(/\{t\(['"]reports\.title['"]\)\}/);
  });
});
