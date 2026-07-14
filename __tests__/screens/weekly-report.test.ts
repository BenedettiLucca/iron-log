import fs from 'node:fs';
import path from 'node:path';

const weeklyReportSource = fs.readFileSync(
  path.resolve(__dirname, '../../app/reports/weekly.tsx'),
  'utf8'
);

describe('weekly report presentation', () => {
  it('does not present a completed lifecycle badge', () => {
    expect(weeklyReportSource).not.toContain("reports.completed");
  });
});
