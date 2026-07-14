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
});
