import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');

describe('ExerciseScreen keyboard avoiding layout', () => {
  it('does not apply behavior="height" on Android to prevent double resizing and bottom gaps', () => {
    const filePath = path.join(root, 'app/session/exercise.tsx');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('KeyboardAvoidingView');
    expect(source).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined}");
    expect(source).not.toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
  });
});
