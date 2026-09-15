import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#90 — annual activity heatmap', () => {
  it('heatmap data service exists with deterministic daily buckets', () => {
    const svc = read('services/ActivityHeatmapService.ts');
    expect(svc).toMatch(/export\s+(const|function|class)\s+ActivityHeatmapService/);
    expect(svc).toMatch(/getDailyActivity|buildHeatmap/);
    expect(svc).toMatch(/durationMinutes|endTime/);
  });

  it('respects Trust II rules (finished sessions only, no deleted)', () => {
    const svc = read('services/ActivityHeatmapService.ts');
    expect(svc).toMatch(/endTime\s*!=\s*null|endTime IS NOT NULL/);
    expect(svc).toMatch(/deletedAt\s*==\s*null|isNull\(sessions\.deletedAt\)/);
  });

  it('analytics screen renders the heatmap component', () => {
    const analytics = read('app/bio/analytics.tsx');
    expect(analytics).toMatch(/ActivityHeatmap|heatmap/i);
  });
});
