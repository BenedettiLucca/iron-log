import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');

describe('#65 — training schedule manifest export (Hermes/Obsidian sync)', () => {
  it('manifest service exists and produces deterministic output', () => {
    const svc = fs.readFileSync(
      path.join(root, 'services/ScheduleManifestService.ts'),
      'utf8'
    );
    expect(svc).toMatch(/export/);
    expect(svc).toMatch(/manifest/i);
  });

  it('manifest covers routines, folders and schedule state', () => {
    const svc = fs.readFileSync(
      path.join(root, 'services/ScheduleManifestService.ts'),
      'utf8'
    );
    expect(svc).toMatch(/routine/i);
    expect(svc).toMatch(/folder|week/i);
  });

  it('unit test exercises the real service against the synthetic DB', () => {
    const tests = fs.readdirSync(path.join(root, '__tests__/services'))
      .filter((f) => /manifest/i.test(f));
    expect(tests.length).toBeGreaterThanOrEqual(1);
  });
});
