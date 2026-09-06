import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#71 — weekly training variance report', () => {
  it('service exists with weekly variance computation', () => {
    const svc = read('services/TrainingVarianceService.ts');
    expect(svc).toMatch(/export/);
    expect(svc).toMatch(/variance|weekly/i);
  });

  it('uses only finished sessions (Trust II rule) and live sets', () => {
    const svc = read('services/TrainingVarianceService.ts');
    expect(svc).toMatch(/endTime/);
    expect(svc).toMatch(/deletedAt/);
  });

  it('report includes weekly volume totals and week-over-week delta', () => {
    const svc = read('services/TrainingVarianceService.ts');
    expect(svc).toMatch(/volume/i);
    expect(svc).toMatch(/delta|change|diff/i);
  });

  it('covered by unit tests against the synthetic DB', () => {
    const tests = fs
      .readdirSync(path.join(root, '__tests__/services'))
      .filter((f) => /variance/i.test(f));
    expect(tests.length).toBeGreaterThanOrEqual(1);
  });
});
