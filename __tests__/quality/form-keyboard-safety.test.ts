import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');

const keyboardSafeForms = [
  { file: 'app/programs/create.tsx', containers: 1 },
  { file: 'app/supplements/index.tsx', containers: 1 },
  { file: 'app/bio/goals.tsx', containers: 1 },
  { file: 'app/routines/editor.tsx', containers: 2 },
  { file: 'app/(tabs)/bio.tsx', containers: 1 },
] as const;

const keyboardSafeContainerPattern = /<(?:ScrollView|FlatList)\b(?=[^>]*\bautomaticallyAdjustKeyboardInsets\b)(?=[^>]*\bkeyboardShouldPersistTaps="handled")(?=[^>]*\bkeyboardDismissMode="on-drag")[^>]*>/g;

const countKeyboardSafeContainers = (source: string) =>
  source.match(keyboardSafeContainerPattern)?.length ?? 0;

describe('shared form keyboard safety', () => {
  it.each(keyboardSafeForms)(
    'keeps $file keyboard-aware across $containers form container(s)',
    ({ file, containers }) => {
      const source = fs.readFileSync(path.join(root, file), 'utf8');

      expect(countKeyboardSafeContainers(source)).toBeGreaterThanOrEqual(containers);
    }
  );

  it('resizes the routine editor viewport above the Android keyboard', () => {
    const editor = fs.readFileSync(path.join(root, 'app/routines/editor.tsx'), 'utf8');

    expect(editor).toContain('KeyboardAvoidingView');
    expect(editor).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
    expect(editor).toContain("keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}");
  });

  it('scrolls every routine exercise field above the Android keyboard and fixed footer when focused', () => {
    const editor = fs.readFileSync(path.join(root, 'app/routines/editor.tsx'), 'utf8');

    expect(editor).toMatch(/Keyboard\.addListener\(\s*['"]keyboardDidShow['"]/);
    expect(editor).toMatch(/Keyboard\.addListener\(\s*['"]keyboardDidHide['"]/);
    expect(editor).toContain('Keyboard.isVisible()');
    expect(editor).toContain('focusedExerciseInputRef.current = event.target');
    expect(editor).toContain('focusedExerciseInputRef.current = null');
    expect(editor).toContain('scrollResponderScrollNativeHandleToKeyboard');
    expect(editor).toContain('footerHeightRef.current + 24');
    expect(editor).toContain('footerHeightRef.current = event.nativeEvent.layout.height');
    expect(editor.match(/onFocus=\{handleExerciseInputFocus\}/g) ?? []).toHaveLength(3);
    expect(editor.match(/onBlur=\{handleExerciseInputBlur\}/g) ?? []).toHaveLength(3);
  });

  it('keeps real scroll-content spacing between the last routine card and footer', () => {
    const editor = fs.readFileSync(path.join(root, 'app/routines/editor.tsx'), 'utf8');

    expect(editor).toContain('contentContainerStyle={{ gap: 16, paddingBottom: 24 }}');
  });
});
