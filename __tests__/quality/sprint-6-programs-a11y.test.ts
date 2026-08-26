import { jsxElements, propNames } from './jsx-source';

describe('Sprint 6 programs/routines/supplements residual accessibility', () => {
  it('marks all supplement decorative SVGs as accessible={false}', () => {
    const svgs = jsxElements('app/supplements/index.tsx', 'Svg');
    const visible = svgs.filter(
      (element) => !element.getText().includes('accessible={false}'),
    );
    expect({
      total: svgs.length,
      visible: visible.map((element) => element.getText().slice(0, 80)),
    }).toEqual({ total: svgs.length, visible: [] });
  });

  it('gives the supplements reminder-time trigger button semantics', () => {
    const touchables = jsxElements('app/supplements/index.tsx', 'TouchableOpacity');
    const reminderTrigger = touchables.find((element) => {
      const text = element.getText();
      return text.includes('reminderTime') && text.includes('onPress');
    });
    expect(reminderTrigger).toBeDefined();
    const props = propNames(reminderTrigger!);
    expect(props).toContain('accessibilityRole');
  });

  it('gives templates back button accessibilityRole and accessibilityLabel', () => {
    const touchables = jsxElements('app/routines/templates.tsx', 'TouchableOpacity');
    const backBtn = touchables.find(
      (element) => element.getText().includes('router.back()') && !element.getText().includes('onLongPress'),
    );
    expect(backBtn).toBeDefined();
    const props = propNames(backBtn!);
    expect(props).toContain('accessibilityRole');
    expect(props).toContain('accessibilityLabel');
  });

  it('keeps text-only back and rename controls at least 44dp with button semantics', () => {
    const controls = [
      jsxElements('app/programs/create.tsx', 'TouchableOpacity')
        .find((element) => element.getText().includes('router.back()')),
      jsxElements('app/routines/templates.tsx', 'TouchableOpacity')
        .find((element) => element.getText().includes('router.back()')),
      jsxElements('app/routines/editor.tsx', 'TouchableOpacity')
        .find((element) => element.getText().includes('setRenamingEx')),
    ];

    for (const control of controls) {
      expect(control).toBeDefined();
      expect(propNames(control!)).toEqual(expect.arrayContaining(['accessibilityRole', 'accessibilityLabel']));
      expect(control!.getText()).toContain('min-h-[44px]');
      expect(control!.getText()).toContain('min-w-[44px]');
    }
  });

  it('uses the active theme border for the supplements switch track', () => {
    const switches = jsxElements('app/supplements/index.tsx', 'Switch');
    const nighttime = switches.find((element) => element.getText().includes('isNighttime'));

    expect(nighttime).toBeDefined();
    expect(nighttime!.getText()).toContain('false: theme.border');
    expect(nighttime!.getText()).not.toContain('Colors.lightBorder');
  });
});
