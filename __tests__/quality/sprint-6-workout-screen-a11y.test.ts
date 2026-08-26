import { jsxElements, propNames, source } from './jsx-source';

describe('Sprint 6 workout screen accessibility contracts', () => {
  describe('exercise.tsx – weight and reps inputs', () => {
    it('gives every strength-mode TextInput an accessibilityLabel', () => {
      const textInputs = jsxElements('app/session/exercise.tsx', 'TextInput');
      const numericInputs = textInputs.filter((el) => {
        const props = propNames(el);
        return props.includes('keyboardType') && !props.includes('multiline');
      });
      expect(numericInputs.length).toBeGreaterThanOrEqual(2);
      for (const input of numericInputs) {
        const props = propNames(input);
        expect(props).toContain('accessibilityLabel');
      }
    });
  });

  describe('finish.tsx – body-weight input', () => {
    it('labels the body-weight TextInput with finish.bodyWeight', () => {
      const src = source('app/session/finish.tsx');
      expect(src).toContain("accessibilityLabel={t('finish.bodyWeight')}");
    });
  });

  describe('finish.tsx – notes input', () => {
    it('labels the notes TextInput with finish.observations', () => {
      const src = source('app/session/finish.tsx');
      expect(src).toContain("accessibilityLabel={t('finish.observations')}");
    });
  });

  describe('finish.tsx – note-template buttons', () => {
    it('gives note-template TouchableOpacity clean button label and hides decorative emoji', () => {
      const src = source('app/session/finish.tsx');
      const touchables = jsxElements('app/session/finish.tsx', 'TouchableOpacity');
      const templateButton = touchables.find((el) => el.getText().includes('insertTemplate'));
      expect(templateButton).toBeDefined();
      const props = propNames(templateButton!);
      expect(props).toContain('accessibilityRole');
      expect(props).toContain('accessibilityLabel');
      expect(src).toContain('accessible={false}');
    });
  });

  describe('exercise.tsx – active duration timer', () => {
    it('marks the timer text as accessible with role timer and a composed label', () => {
      const src = source('app/session/exercise.tsx');
      expect(src).toContain("accessibilityRole=\"timer\"");
      expect(src).toContain("accessibilityLabel={`");
      expect(src).toContain("exerciseSession.elapsedTime");
      expect(src).toContain('accessible={true}');
    });

    it('does NOT use a live region on the timer', () => {
      const src = source('app/session/exercise.tsx');
      expect(src).not.toContain('accessibilityLiveRegion');
    });
  });
});
