import {
  bucketChartSeries,
  getChartBucketCount,
  getChartPeriodRange,
  getChartYAxisScale,
  formatChartBucketLabel,
  buildPositionedChartSeries,
} from '../../src/utils/chart-periods';

describe('chart periods', () => {
  const reference = new Date(2026, 6, 15, 12).getTime();

  it('uses complete local calendar ranges for week, month and year', () => {
    const week = getChartPeriodRange('week', reference);
    expect(week.start).toBe(new Date(2026, 6, 13).getTime());
    expect(week.end).toBe(new Date(2026, 6, 20).getTime());

    const month = getChartPeriodRange('month', reference);
    expect(month.start).toBe(new Date(2026, 6, 1).getTime());
    expect(month.end).toBe(new Date(2026, 7, 1).getTime());

    const year = getChartPeriodRange('year', reference);
    expect(year.start).toBe(new Date(2026, 0, 1).getTime());
    expect(year.end).toBe(new Date(2027, 0, 1).getTime());
  });

  it('limits point count to the selected period and viewport', () => {
    expect(getChartBucketCount('week', 240)).toBe(7);
    expect(getChartBucketCount('month', 240)).toBe(6);
    expect(getChartBucketCount('year', 240)).toBe(12);
    expect(getChartBucketCount('year', 520)).toBe(12);
  });

  it('keeps monthly annual buckets while showing December on a narrow axis', () => {
    const buckets = bucketChartSeries([], 'year', reference, 270);
    const positioned = buildPositionedChartSeries(buckets, 'year', 'pt-BR', 270);

    expect(buckets).toHaveLength(12);
    expect(positioned.axisLabels.filter(Boolean)).toEqual([
      'jan',
      'mar',
      'mai',
      'jul',
      'set',
      'dez',
    ]);
  });

  it('uses distinct short weekday labels for the weekly axis', () => {
    const monday = new Date(2026, 6, 13).getTime();
    const labels = Array.from({ length: 7 }, (_, index) =>
      formatChartBucketLabel('week', monday + index * 24 * 60 * 60 * 1000, 'pt-BR'),
    );

    expect(new Set(labels).size).toBe(7);
  });

  it('aggregates values into fixed calendar buckets without inventing zeroes', () => {
    const points = [
      { timestamp: new Date(2026, 6, 1, 8).getTime(), value: 120 },
      { timestamp: new Date(2026, 6, 2, 8).getTime(), value: 122 },
      { timestamp: new Date(2026, 6, 20, 8).getTime(), value: 118 },
      { timestamp: new Date(2026, 5, 30, 8).getTime(), value: 999 },
    ];

    const buckets = bucketChartSeries(points, 'month', reference, 240);

    expect(buckets).toHaveLength(6);
    expect(buckets[0]?.value).toBe(121);
    expect(buckets.some(bucket => bucket.value === 118)).toBe(true);
    expect(buckets.some(bucket => bucket.value === 999)).toBe(false);
    expect(buckets.some(bucket => bucket.value === 0)).toBe(false);
    expect(buckets.some(bucket => bucket.value === undefined)).toBe(true);
  });

  it('uses the latest recorded value when a weight bucket has multiple entries', () => {
    const points = [
      { timestamp: new Date(2026, 6, 27, 8).getTime(), value: 120 },
      { timestamp: new Date(2026, 6, 27, 18).getTime(), value: 118 },
    ];

    const buckets = bucketChartSeries(points, 'month', reference, 240, 'latest');
    const populated = buckets.find(bucket => bucket.sampleCount === 2);

    expect(populated?.value).toBe(118);
  });

  it('keeps the Y axis close to a narrow data range instead of forcing zero', () => {
    const scale = getChartYAxisScale([119.2, 119.4, 119.9]);

    expect(scale.yAxisOffset).toBeGreaterThan(0);
    expect(scale.yAxisOffset).toBeLessThan(119.2);
    expect(scale.yAxisOffset + scale.maxValue).toBeGreaterThan(119.9);
    expect(scale.maxValue).toBeLessThan(5);
  });

  it('keeps a safe visible range for a flat series', () => {
    const scale = getChartYAxisScale([80, 80]);

    expect(scale.yAxisOffset).toBeLessThan(80);
    expect(scale.yAxisOffset + scale.maxValue).toBeGreaterThan(80);
    expect(scale.maxValue).toBeGreaterThan(0);
  });

  describe('buildPositionedChartSeries', () => {
    it('returns empty data and base initial/end spacing for empty or all-missing inputs', () => {
      // Empty input
      const emptyResult = buildPositionedChartSeries([], 'week', 'en-US', 240);
      expect(emptyResult.data).toEqual([]);
      expect(emptyResult.initialSpacing).toBe(20);
      expect(emptyResult.endSpacing).toBe(20);

      // All-missing input
      const allMissingBuckets = [
        { start: 1000, end: 2000, value: undefined, sampleCount: 0 },
        { start: 2000, end: 3000, value: undefined, sampleCount: 0 },
      ];
      const allMissingResult = buildPositionedChartSeries(allMissingBuckets, 'week', 'en-US', 240);
      expect(allMissingResult.data).toEqual([]);
      expect(allMissingResult.initialSpacing).toBe(20);
      expect(allMissingResult.endSpacing).toBe(20);
    });

    it('correctly maps values, spacing, and leading/trailing spacing using a 5-bucket fixture', () => {
      // Use a manually built 5-bucket fixture and viewport 240 so slotSpacing = 50.
      // Buckets at:
      // index 0: leading empty
      // index 1: populated (value: 10)
      // index 2: empty middle bucket (should cause doubled spacing)
      // index 3: populated (value: 20)
      // index 4: trailing empty
      const buckets = [
        { start: 1000, end: 2000, value: undefined, sampleCount: 0 },
        { start: 2000, end: 3000, value: 10, sampleCount: 1 },
        { start: 3000, end: 4000, value: undefined, sampleCount: 0 },
        { start: 4000, end: 5000, value: 20, sampleCount: 1 },
        { start: 5000, end: 6000, value: undefined, sampleCount: 0 },
      ];

      const result = buildPositionedChartSeries(buckets, 'week', 'en-US', 240);

      expect(result.axisLabels).toEqual(buckets.map(bucket =>
        formatChartBucketLabel('week', bucket.start, 'en-US')
      ));
      expect(result.slotSpacing).toBe(50);

      // 1. Proving numeric-only output, no fabricated 0 values, and only populated buckets
      expect(result.data).toHaveLength(2);
      expect(result.data[0].value).toBe(10);
      expect(result.data[1].value).toBe(20);
      expect(result.data.every(d => typeof d.value === 'number')).toBe(true);
      expect(result.data.some(d => d.value === 0)).toBe(false);
      expect(result.data.some(d => 'label' in d)).toBe(false);

      // 2. Proving leading/trailing space (initialSpacing / endSpacing)
      // slotSpacing = (240 - 20 - 20) / max(5 - 1, 1) = 200 / 4 = 50.
      // leadingEmptyBucketCount = 1 -> initialSpacing = 20 + 1 * 50 = 70.
      // trailingEmptyBucketCount = 1 -> endSpacing = 20 + 1 * 50 = 70.
      expect(result.initialSpacing).toBe(70);
      expect(result.endSpacing).toBe(70);

      // 3. Proving doubled spacing across one empty middle bucket
      // Distance from index 1 to index 3 is 2. So spacing for first point should be 2 * slotSpacing = 100.
      expect(result.data[0].spacing).toBe(100);

      // Last point spacing should be 0
      expect(result.data[1].spacing).toBe(0);

      // The custom axis positions every bucket on the same timeline used by sparse points.
      expect(result.initialSpacing).toBe(20 + result.slotSpacing);
      expect(result.initialSpacing + result.data[0].spacing).toBe(20 + 3 * result.slotSpacing);
    });
  });
});
