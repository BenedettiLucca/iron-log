import fs from 'node:fs';
import path from 'node:path';
import { pt } from '@/src/i18n/translations/pt';
import { en } from '@/src/i18n/translations/en';
import { es } from '@/src/i18n/translations/es';
import { zh } from '@/src/i18n/translations/zh';

const root = path.resolve(__dirname, '../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function findProgressBarUsageFiles(relativeDirectory: string): string[] {
  const absoluteDirectory = path.join(root, relativeDirectory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return findProgressBarUsageFiles(relativePath);
    if (!entry.name.endsWith('.tsx')) return [];
    return read(relativePath).includes('<ProgressBar')
      ? [relativePath.split(path.sep).join('/')]
      : [];
  });
}

describe('ProgressBar call-site contracts', () => {
  it('enumerates every product usage so new call sites require an explicit contract decision', () => {
    const usageFiles = [
      ...findProgressBarUsageFiles('app'),
      ...findProgressBarUsageFiles('components'),
    ].sort();

    expect(usageFiles).toEqual([
      'app/(tabs)/index.tsx',
      'app/session/[routineId].tsx',
      'components/session/ExerciseHeader.tsx',
    ]);
  });
  it('keeps dashboard volume progress decorative inside its accessible card', () => {
    const source = read('app/(tabs)/index.tsx');
    expect(source).toMatch(
      /<ProgressBar\s+current=\{weeklyVolume\}\s+total=\{Math\.max\(weeklyVolume, avgWeeklyVolume, 1\)\}\s+showLabel=\{false\}\s+isAccessible=\{false\}\s*\/>/
    );
  });

  it('selects localized singular and plural exercise labels in the active header', () => {
    const source = read('components/session/ExerciseHeader.tsx');
    expect(source).toContain('totalExercises === 1');
    expect(source).toContain("'session.exerciseProgressSingular'");
    expect(source).toContain("'session.exerciseProgressPlural'");
  });

  it('keeps the routine heading visual and the progressbar as the sole semantic value', () => {
    const source = read('app/session/[routineId].tsx');
    expect(source).toContain("'session.exercisesCompletedProgressSingular'");
    expect(source).toContain("'session.exercisesCompletedProgressPlural'");
    expect(source).toContain('accessibilityElementsHidden');
    expect(source).toContain('importantForAccessibility="no-hide-descendants"');
    expect(source).toContain('label={progressLabel}');
    expect(source).not.toContain('de ${totalCount} concluídos');
  });

  it('uses grammatically correct 1/1 progress copy in every locale', () => {
    expect(pt.session.exerciseProgressSingular).toBe('{current} de {total} exercício');
    expect(en.session.exerciseProgressSingular).toBe('{current} of {total} exercise');
    expect(es.session.exerciseProgressSingular).toBe('{current} de {total} ejercicio');
    expect(zh.session.exerciseProgressSingular).toBe('{current}/{total} 个动作');

    expect(pt.session.exercisesCompletedProgressSingular).toBe(
      '{current} de {total} exercício concluído'
    );
    expect(en.session.exercisesCompletedProgressSingular).toBe(
      '{current} of {total} exercise completed'
    );
    expect(es.session.exercisesCompletedProgressSingular).toBe(
      '{current} de {total} ejercicio completado'
    );
    expect(zh.session.exercisesCompletedProgressSingular).toBe('已完成 {current}/{total} 个动作');
  });
});
