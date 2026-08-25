import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const readSource = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const bioSource = readSource('app/(tabs)/bio.tsx');
const analyticsSource = readSource('app/bio/analytics.tsx');
const evolutionSource = readSource('app/bio/evolution.tsx');
const chartXAxisLabelsPath = path.join(root, 'components/ChartXAxisLabels.tsx');
const chartXAxisLabelsSource = fs.existsSync(chartXAxisLabelsPath)
  ? fs.readFileSync(chartXAxisLabelsPath, 'utf8')
  : '';

describe('Sprint 4 physical QA regressions', () => {
  it('keeps breathing room between the Bio header and first card', () => {
    expect(bioSource).toContain('className="px-4 pt-4 pb-4"');
  });

  it('uses fixed period charts instead of nested horizontal scrolling', () => {
    for (const source of [analyticsSource, evolutionSource]) {
      expect(source).toContain('bucketChartSeries');
      expect(source).toContain('getChartYAxisScale');
      expect(source).toContain('buildPositionedChartSeries');
      expect(source).not.toContain('interpolateMissingValues');
      expect(source).not.toContain('extrapolateMissingValues');
      expect(source).not.toContain('showDataPointsForMissingValues');
    }

    expect(analyticsSource).not.toContain('getScrollableChartWidth');
    expect(evolutionSource).not.toContain('getScrollableChartWidth');
  });

  it('makes both chart axes explicitly theme-aware', () => {
    for (const source of [analyticsSource, evolutionSource]) {
      expect(source).toContain('yAxisTextStyle={{ color: theme.subtext');
      expect(source).toContain('<ChartXAxisLabels');
      expect(source).toContain('xAxisLabelsHeight={0}');
      expect(source).toContain('yAxisThickness={0}');
      expect(source).not.toContain('xAxisLabelTextStyle=');
      expect(source).toContain('yAxisOffset={chartScale.yAxisOffset}');
    }

    expect(chartXAxisLabelsSource).toContain('text-subtext');
  });

  it('offers weekly, monthly and yearly chart periods', () => {
    for (const source of [analyticsSource, evolutionSource]) {
      expect(source).toContain("key: 'week'");
      expect(source).toContain("key: 'month'");
      expect(source).toContain("key: 'year'");
    }
  });

  it('shows the latest real weight instead of averaging weight entries', () => {
    expect(analyticsSource).toMatch(
      /bucketChartSeries\([\s\S]*?weightData[\s\S]*?'latest'[\s\S]*?\)/,
    );
    expect(evolutionSource).toContain(
      "renderChart(weightData, t('bio.weightEvolution'), theme.primaryText, 'kg', 'latest')",
    );
    expect(evolutionSource).not.toContain('movingAverageLabel');
  });

  it('gives TalkBack a concise summary for charts whose visual axis labels are hidden', () => {
    for (const source of [analyticsSource, evolutionSource]) {
      expect(source).toContain('accessibilityRole="image"');
      expect(source).toMatch(/accessibilityLabel=\{\w*[Cc]hartAccessibilityLabel\}/);
    }
  });
});
