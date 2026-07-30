import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const routine = read('app/routines/editor.tsx');
const program = read('app/programs/create.tsx');
const supplements = read('app/supplements/index.tsx');
const goals = read('app/bio/goals.tsx');

const translations = [
  read('src/i18n/translations/pt.ts'),
  read('src/i18n/translations/en.ts'),
  read('src/i18n/translations/es.ts'),
  read('src/i18n/translations/zh.ts'),
];

describe('Sprint 5 form state and validation', () => {

  it('guards dirty route forms through beforeRemove and dispatches only after confirmation', () => {
    for (const source of [routine, program]) {
      expect(source).toContain("navigation.addListener('beforeRemove'");
      expect(source).toContain('isFormDirty(');
      expect(source).toMatch(/if \(!\['GO_BACK', 'POP'\]\.includes\(e\.data\.action\.type\)\) return/);
      expect(source).toMatch(/beforeRemove[\s\S]*e\.preventDefault\(\)[\s\S]*navigation\.dispatch/);
    }
  });

  it('uses strict integer validation and keeps the name error reachable', () => {
    expect(program).toContain('Number(weeksDuration)');
    expect(program).toContain('Number.isInteger(weeks)');
    expect(program).toContain('Number(deloadWeek)');
    expect(program).toContain('Number.isInteger(deload)');
    expect(program).toContain('disabled={isSubmitting}');
    expect(program).not.toContain('disabled={!name.trim() || isSubmitting}');
  });

  it('prevents stale routine hydration from overwriting editable state', () => {
    expect(routine).toContain('hydrationGenerationRef');
    expect(routine).toContain('generation !== hydrationGenerationRef.current');
    expect(routine).toContain('if (isHydrating)');
    expect(routine).toContain('<LoadingState');
    expect(routine).toContain('<ErrorState');
  });

  it('localizes routine validation and replaces the create route after one locked submit', () => {
    expect(routine).toContain("const msg = t('common.invalidName')");
    expect(routine).not.toContain('nameValidation.error.issues[0]?.message');
    expect(program).toContain('if (isSubmittingRef.current) return');
    expect(program).toContain('router.replace(');
    expect(program).not.toContain('navigationTimerRef');
    expect(program).not.toContain('setTimeout(');
  });

  it('keeps the program preview date finite for malformed week input', () => {
    expect(program).toContain('safeWeeksDuration');
    expect(program).toContain('Number.isFinite(parsedWeeksDuration)');
  });

  it('uses one dirty-aware close handler for modal buttons and Android Back', () => {
    expect(supplements).toMatch(/<Modal[\s\S]*onRequestClose=\{requestCloseModal\}/);
    expect(supplements).toContain('onPress={requestCloseModal}');
    expect(goals).toMatch(/<Modal[\s\S]*onRequestClose=\{requestCloseModal\}/);
    expect(goals).toContain('onPress={requestCloseModal}');
    expect(supplements).toContain('isFormDirty(');
    expect(goals).toContain('isFormDirty(');
  });

  it('shows inline field errors in every form', () => {
    expect(routine).toContain('error={nameError}');
    expect(routine).toContain('exerciseError');
    expect(program).toContain('error={weeksError}');
    expect(program).toContain('error={deloadError}');
    expect(supplements).toContain('error={nameError}');
    expect(supplements).toContain('error={dosageError}');
    expect(supplements).toContain('error={timingError}');
    expect(goals).toContain('error={targetValueError}');
    expect(goals).toContain('error={targetDateError}');
  });

  it('focuses text errors and scrolls non-text errors into view', () => {
    for (const source of [routine, program, supplements, goals]) {
      expect(source).toContain('.current?.focus()');
      expect(source).toMatch(/scroll(To|ResponderScrollNativeHandleToKeyboard)/);
    }
  });

  it('defines generic discard copy in every locale', () => {
    for (const source of translations) {
      expect(source).toContain('discardChangesTitle:');
      expect(source).toContain('discardChangesMessage:');
      expect(source).toContain('discardChanges:');
      expect(source).toContain('dateInvalid:');
    }
    expect(goals).toContain("newGoal.targetDate ? t('bioGoals.dateInvalid') : t('bioGoals.dateRequired')");
  });
});
