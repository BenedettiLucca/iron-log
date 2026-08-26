import { jsxElements, propNames, source } from './jsx-source';

describe('Sprint 6 screen accessibility contracts', () => {
  it('gives every audited program back control button semantics', () => {
    for (const file of ['app/programs/create.tsx', 'app/programs/week-detail.tsx']) {
      const touchables = jsxElements(file, 'TouchableOpacity')
        .filter((element) => propNames(element).includes('onPress'));
      const unnamed = touchables.filter((element) => {
        const props = propNames(element);
        return !props.includes('accessibilityRole') || !props.includes('accessibilityLabel');
      });
      expect({ file, unnamed: unnamed.map((element) => element.getText()) }).toEqual({ file, unnamed: [] });
    }
  });

  it('marks audited decorative program SVGs as hidden from accessibility', () => {
    for (const file of ['app/programs/index.tsx', 'app/programs/detail.tsx']) {
      const visible = jsxElements(file, 'Svg')
        .filter((element) => !element.getText().includes('accessible={false}'));
      expect({ file, visible: visible.map((element) => element.getText()) }).toEqual({ file, visible: [] });
    }
  });

  it('names routine editor controls and traps its native modals', () => {
    const editor = source('app/routines/editor.tsx');
    const modals = jsxElements('app/routines/editor.tsx', 'Modal');
    const inputs = jsxElements('app/routines/editor.tsx', 'Input');

    expect(modals.every((modal) => propNames(modal).includes('accessibilityViewIsModal'))).toBe(true);
    expect(inputs.every((input) => {
      const props = propNames(input);
      return props.includes('label') || props.includes('accessibilityLabel');
    })).toBe(true);
    expect(editor).toContain('accessibilityRole="header"');
    expect(editor).toContain("accessibilityLabel={t('common.cancel')}");
  });

  it('uses the shared accessible progress bar and named controls for supplements', () => {
    const supplements = source('app/supplements/index.tsx');
    const modals = jsxElements('app/supplements/index.tsx', 'Modal');

    expect(supplements).toContain('<ProgressBar');
    expect(supplements).toContain("accessibilityLabel={t('supplements.addSupplement')}");
    expect(supplements).toContain("accessibilityLabel={t('supplements.reminderTime')}");
    expect(modals.every((modal) => propNames(modal).includes('accessibilityViewIsModal'))).toBe(true);
  });
});