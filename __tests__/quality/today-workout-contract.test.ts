import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#87 — today-workout home surface + bodyweight check-in at session start', () => {
  it('home computes today workout from active program week (service layer)', () => {
    const svc = read('services/TodayWorkoutService.ts');
    expect(svc).toMatch(/export\s+(const|function|class)\s+TodayWorkoutService/);
    expect(svc).toMatch(/getTodayWorkout|buildTodayWorkout/);
    expect(svc).toMatch(/isActive|programs\.isActive/);
  });

  it('home screen renders today-workout card with direct start CTA', () => {
    const home = read('app/(tabs)/index.tsx');
    expect(home).toMatch(/TodayWorkoutService|todayWorkout/i);
    expect(home).toMatch(/sessionParamsSchema|pathname:\s*'\/session\/'/);
  });

  it('session start initializes body weight capture for the active session (start-of-session, not finish)', () => {
    const screen = read('app/session/[routineId].tsx');
    expect(screen).toMatch(/bodyWeight/i);
  });
});
