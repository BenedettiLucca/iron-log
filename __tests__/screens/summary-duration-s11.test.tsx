import { es } from '@/src/i18n/translations/es';
import fs from 'fs';
import path from 'path';

describe('Sprint 11 - Summary & Duration Controls Contract', () => {
  it('has compact Spanish newWorkout translation in es.ts to avoid wrapping', () => {
    expect(es.summary.newWorkout).toBe('Nuevo Entreno');
    expect(es.summary.newWorkout.length).toBeLessThanOrEqual(14);
  });

  it('uses consistent min-h-[50px], w-full and size="md" for duration controls in exercise.tsx', () => {
    const exercisePath = path.resolve(__dirname, '../../app/session/exercise.tsx');
    const content = fs.readFileSync(exercisePath, 'utf8');

    // Duration section should render start/stop and save with consistent w-full and min-h-[50px] / size="md"
    expect(content).toContain('className={`w-full rounded-2xl items-center justify-center min-h-[50px]');
    expect(content).toContain('size="md"');
    expect(content).not.toContain('py-5 px-16 shadow-lg');
  });
});
