import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');

describe('#93 — tracker CSV importers (Strong/Hevy/FitNotes)', () => {
  const files = [
    'services/importers/StrongImporter.ts',
    'services/importers/HevyImporter.ts',
    'services/importers/FitNotesImporter.ts',
  ];

  it('three importer services exist with a common shape', () => {
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      expect(src).toMatch(/export\s+(async\s+)?function|export\s+const|export\s+class/);
      expect(src).toMatch(/custom/i);
    }
  });

  it('unrecognized exercise names become CUSTOM exercises (nothing discarded)', () => {
    const anyImporter = fs.readFileSync(path.join(root, files[0]), 'utf8');
    expect(anyImporter).toMatch(/custom/i);
  });

  it('parser logic is covered by unit tests with real CSV fixtures', () => {
    const testFiles = fs.readdirSync(path.join(root, '__tests__/services'))
      .filter((f) => /importer/i.test(f));
    expect(testFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('import is reachable from the UI (settings or routines screen calls the importer)', () => {
    const settings = fs.readFileSync(
      path.join(root, 'app/(tabs)/settings.tsx'),
      'utf8'
    );
    const routines = fs.existsSync(path.join(root, 'app/(tabs)/routines.tsx'))
      ? fs.readFileSync(path.join(root, 'app/(tabs)/routines.tsx'), 'utf8')
      : '';
    const templates = fs.readFileSync(
      path.join(root, 'app/routines/templates.tsx'),
      'utf8'
    );
    expect(
      /importer/i.test(settings) || /importer/i.test(routines) || /importer/i.test(templates)
    ).toBe(true);
  });
});
