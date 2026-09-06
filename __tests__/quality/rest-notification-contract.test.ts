import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('rest notification contract (#89)', () => {
  it('schedules a local notification when rest starts, in the session hook (not the UI sheet)', () => {
    const hook = read('hooks/use-exercise-sets.ts');
    expect(hook).toContain('scheduleRestNotification');
    expect(hook).toContain('cancelRestNotification');
  });

  it('notification service exposes schedule/cancel pair anchored on rest identifier', () => {
    const svc = read('services/NotificationService.ts');
    expect(svc).toContain('export async function scheduleRestNotification');
    expect(svc).toContain('export async function cancelRestNotification');
    expect(svc).toMatch(/scheduleNotificationAsync/);
    expect(svc).toMatch(/cancelScheduledNotificationAsync/);
    expect(svc).toMatch(/REST_NOTIFICATION_ID|'rest-timer'/);
  });

  it('skip, close and unmount cancel via the hook — the screen never imports the service', () => {
    const hook = read('hooks/use-exercise-sets.ts');
    expect(hook).toMatch(/cancelRestNotification\(\)/);
    const screen = read('app/session/exercise.tsx');
    expect(screen).not.toMatch(/NotificationService/);
  });

  it('notification copy follows the existing static-PT precedent (i18n debt tracked in #107)', () => {
    for (const lang of ['pt', 'en', 'es', 'zh']) {
      const t = read(`src/i18n/translations/${lang}.ts`);
      expect(t).not.toMatch(/restNotification:/);
    }
  });

  it('respects permission denial — scheduling is best-effort, never throws into the timer flow', () => {
    const svc = read('services/NotificationService.ts');
    expect(svc).toMatch(/scheduleRestNotification[\s\S]*try\s*\{[\s\S]*catch/);
  });

  it('rest-timer scheduling is NOT gated by the storeClient check (device QA runs in Expo Go)', () => {
    const svc = read('services/NotificationService.ts');
    const restBlock = svc.split('export async function cancelRestNotification')[0]
      .split('export async function scheduleRestNotification')[1];
    expect(restBlock).toBeDefined();
    expect(restBlock).not.toMatch(/!isSupported/);
  });
});
