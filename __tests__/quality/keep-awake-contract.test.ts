import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('keep awake contract (#88)', () => {
  it('hook owns persistence, defaults ON, and gates activation on the setting', () => {
    const hook = read('hooks/use-keep-awake-setting.ts');
    expect(hook).toContain("from 'expo-keep-awake'");
    expect(hook).toContain('activateKeepAwakeAsync');
    expect(hook).toContain('deactivateKeepAwake');
    expect(hook).toContain('STORAGE_KEY');
    expect(hook).toContain('AsyncStorage');
    expect(hook).toContain('DEFAULT_ENABLED = true');
    expect(hook).toContain('export function useKeepAwakeSetting');
    expect(hook).toContain('export function useSessionKeepAwake');
  });

  it('both active-session screens integrate through the single wrapper hook', () => {
    expect(read('app/session/exercise.tsx')).toContain('useSessionKeepAwake()');
    expect(read('app/session/finish.tsx')).toContain('useSessionKeepAwake()');
    // screens must NOT import expo-keep-awake directly — one integration point
    expect(read('app/session/exercise.tsx')).not.toContain('expo-keep-awake');
    expect(read('app/session/finish.tsx')).not.toContain('expo-keep-awake');
  });

  it('exposes the toggle in Settings with i18n keys in all four languages', () => {
    const settings = read('app/(tabs)/settings.tsx');
    expect(settings).toContain('useKeepAwakeSetting');
    expect(settings).toContain('keepAwake');
    for (const lang of ['pt', 'en', 'es', 'zh']) {
      expect(read(`src/i18n/translations/${lang}.ts`)).toMatch(/keepAwake:/);
    }
  });
});
