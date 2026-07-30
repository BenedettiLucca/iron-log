import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const section = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  return source.slice(startIndex, endIndex);
};

const routineSource = read('app/routines/editor.tsx');
const goalsSource = read('app/bio/goals.tsx');
const supplementsSource = read('app/supplements/index.tsx');

describe('Sprint 5 inset-aware form actions', () => {
  it('keeps routine save actions in normal flow above the bottom safe area', () => {
    const actions = section(routineSource, '</ScrollView>', '<ExercisePickerModal');

    expect(routineSource).toContain('useSafeAreaInsets');
    expect(routineSource).not.toContain('className="h-40"');
    expect(actions).not.toContain('absolute bottom-0');
    expect(actions).toContain('paddingBottom: 16 + insets.bottom');
  });

  it('keeps the goals CTA above the bottom safe area', () => {
    const actions = section(goalsSource, '{/* Add Goal Button as Bottom CTA */}', '{/* Add/Edit Goal Modal */}');

    expect(goalsSource).toContain('useSafeAreaInsets');
    expect(actions).toContain('paddingBottom: 16 + insets.bottom');
  });

  it('keeps the supplements FAB above the bottom safe area', () => {
    const actions = section(supplementsSource, '{/* FAB */}', '{/* Add/Edit Modal */}');

    expect(supplementsSource).toContain('useSafeAreaInsets');
    expect(actions).not.toContain('bottom-6');
    expect(actions).toContain('bottom: 24 + insets.bottom');
  });
});
