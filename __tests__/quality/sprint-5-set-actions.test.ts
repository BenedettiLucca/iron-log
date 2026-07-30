import fs from 'fs';
import path from 'path';
import { pt } from '@/src/i18n/translations/pt';
import { en } from '@/src/i18n/translations/en';
import { es } from '@/src/i18n/translations/es';
import { zh } from '@/src/i18n/translations/zh';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const setCard = read('components/SetCard.tsx');
const setList = read('components/session/SetList.tsx');
const exerciseScreen = read('app/session/exercise.tsx');
const exerciseHook = read('hooks/use-exercise-sets.ts');
const translations = [pt, en, es, zh];

describe('Sprint 5 set action and animation contracts', () => {
  it('retains swipe and accessibility shortcuts', () => {
    expect(setCard).toContain('renderRightActions');
    expect(setCard).toContain('accessibilityActions');
  });

  it('collapses status badges and removes the decorative completion check', () => {
    expect(setCard).not.toContain('bg-success items-center justify-center');
    expect(setCard).not.toContain('🔥');
    expect(setCard).not.toContain('isPR');
  });

  it('wires hydration state from the data hook into the list', () => {
    expect(setList).toContain('hasLoadedSessionSets');
    expect(exerciseHook).toContain('hasLoadedSessionSets');
    expect(exerciseScreen).toContain('hasLoadedSessionSets={hasLoadedSessionSets}');
  });

  it('defines localized labels for the visible action alternative', () => {
    for (const translation of translations) {
      expect(translation.setCard.actionsTitle).toBeTruthy();
      expect(translation.setCard.openActions).toBeTruthy();
      expect(translation.setCard.edited).toBeTruthy();
    }
  });
});
