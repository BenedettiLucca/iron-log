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

const count = (source: string, token: string) => source.split(token).length - 1;

describe('shared form keyboard safety', () => {
  it.each(keyboardSafeForms)(
    'keeps $file keyboard-aware across $containers form container(s)',
    ({ file, containers }) => {
      const source = fs.readFileSync(path.join(root, file), 'utf8');

      expect(count(source, 'automaticallyAdjustKeyboardInsets')).toBeGreaterThanOrEqual(containers);
      expect(count(source, 'keyboardShouldPersistTaps="handled"')).toBeGreaterThanOrEqual(containers);
      expect(count(source, 'keyboardDismissMode="on-drag"')).toBeGreaterThanOrEqual(containers);
    }
  );
});
