import fs from 'node:fs';
import path from 'node:path';

const exerciseScreen = fs.readFileSync(
  path.resolve(__dirname, '../../app/session/exercise.tsx'),
  'utf8',
);

describe('Sprint 5 warm-up control wiring', () => {
  it('uses the native animated toggle instead of unsupported utility transitions', () => {
    expect(exerciseScreen).toContain("import { WarmupToggle }");
    expect(exerciseScreen).toContain('<WarmupToggle');
    expect(exerciseScreen).not.toContain('transition-all');
    expect(exerciseScreen).not.toContain('translate-x-5');
  });
});
