import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const sourceRoots = ['app', 'components', 'hooks', 'services', 'src'];

function collectSourceFiles(relativeDirectory: string): string[] {
  const absoluteDirectory = path.join(root, relativeDirectory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relativePath);
    return /\.[jt]sx?$/.test(entry.name) ? [relativePath] : [];
  });
}

describe('Expo SQLite transaction safety', () => {
  it('never passes an async callback to the synchronous transaction API', () => {
    const violations = sourceRoots
      .flatMap(collectSourceFiles)
      .filter((relativePath) =>
        /\.transaction\s*\(\s*async\b/.test(fs.readFileSync(path.join(root, relativePath), 'utf8')),
      );

    expect(violations).toEqual([]);
  });

  it('keeps routine editor duplicate-name and same-frame save guards wired', () => {
    const editor = fs.readFileSync(path.join(root, 'app/routines/editor.tsx'), 'utf8');

    expect(editor).toContain('normalizeRoutineName');
    expect(editor).toContain('hasRoutineNameConflict');
    expect(editor).toContain('isRoutineNameUniqueConstraintError');
    expect(editor).toContain('isSavingRef.current');
  });

  it('keeps template copy localized and protected from same-frame double submits', () => {
    const templates = fs.readFileSync(path.join(root, 'app/routines/templates.tsx'), 'utf8');

    expect(templates).toContain('isCreatingRef.current');
    expect(templates).toContain("t('routines.templateCopy'");
    expect(templates).not.toContain('`${template.name} (Cópia)`');
  });

  it('delivers navigation success messages from the destination screen', () => {
    const editor = fs.readFileSync(path.join(root, 'app/routines/editor.tsx'), 'utf8');
    const templates = fs.readFileSync(path.join(root, 'app/routines/templates.tsx'), 'utf8');
    const routinesScreen = fs.readFileSync(path.join(root, 'app/(tabs)/routines.tsx'), 'utf8');
    const routineDetail = fs.readFileSync(path.join(root, 'app/routine/[routineId].tsx'), 'utf8');

    expect(editor).toContain('setPendingToast');
    expect(templates).toContain('setPendingToast');
    expect(routinesScreen).toContain('consumePendingToast');
    expect(routinesScreen).toContain("setToast({ visible: false, message: '', type: 'success' })");
    expect(routineDetail).toContain('consumePendingToast');
    expect(routineDetail).toContain("setToast({ visible: false, message: '', type: 'success' })");
    expect(routineDetail).toContain('<Toast');
  });
});
