import { CHART_INITIAL_SPACING, CHART_END_SPACING } from './chart-layout';

export type ChartPeriod = 'week' | 'month' | 'year';

export interface TimestampedChartValue {
  timestamp: number;
  value: number;
}

export interface ChartBucket {
  start: number;
  end: number;
  value?: number;
  sampleCount: number;
}

export interface ChartYAxisScale {
  yAxisOffset: number;
  maxValue: number;
}

export type ChartBucketAggregation = 'average' | 'latest';

export function getChartPeriodRange(period: ChartPeriod, referenceTime: number) {
  const reference = new Date(referenceTime);

  if (period === 'week') {
    const mondayOffset = (reference.getDay() + 6) % 7;
    const start = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate() - mondayOffset,
    );
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { start: start.getTime(), end: end.getTime() };
  }

  if (period === 'month') {
    return {
      start: new Date(reference.getFullYear(), reference.getMonth(), 1).getTime(),
      end: new Date(reference.getFullYear(), reference.getMonth() + 1, 1).getTime(),
    };
  }

  return {
    start: new Date(reference.getFullYear(), 0, 1).getTime(),
    end: new Date(reference.getFullYear() + 1, 0, 1).getTime(),
  };
}

export function getChartBucketCount(period: ChartPeriod, viewportWidth: number): number {
  if (period === 'week') return 7;
  if (period === 'month') return viewportWidth >= 480 ? 10 : 6;
  return 12;
}

function getBucketBoundaries(
  period: ChartPeriod,
  referenceTime: number,
  bucketCount: number,
): number[] {
  const reference = new Date(referenceTime);
  const range = getChartPeriodRange(period, referenceTime);

  if (period === 'week') {
    const start = new Date(range.start);
    return Array.from({ length: bucketCount + 1 }, (_, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index).getTime(),
    );
  }

  if (period === 'month') {
    const daysInMonth = new Date(
      reference.getFullYear(),
      reference.getMonth() + 1,
      0,
    ).getDate();

    return Array.from({ length: bucketCount + 1 }, (_, index) => {
      if (index === bucketCount) return range.end;
      const dayOffset = Math.floor((daysInMonth * index) / bucketCount);
      return new Date(reference.getFullYear(), reference.getMonth(), dayOffset + 1).getTime();
    });
  }

  return Array.from({ length: bucketCount + 1 }, (_, index) => {
    if (index === bucketCount) return range.end;
    const monthOffset = Math.floor((12 * index) / bucketCount);
    return new Date(reference.getFullYear(), monthOffset, 1).getTime();
  });
}

export function bucketChartSeries(
  points: TimestampedChartValue[],
  period: ChartPeriod,
  referenceTime: number,
  viewportWidth: number,
  aggregation: ChartBucketAggregation = 'average',
): ChartBucket[] {
  const bucketCount = getChartBucketCount(period, viewportWidth);
  const boundaries = getBucketBoundaries(period, referenceTime, bucketCount);

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]!;
    const samples = points.filter(point =>
      Number.isFinite(point.value) && point.timestamp >= start && point.timestamp < end,
    );

    return {
      start,
      end,
      value: samples.length > 0
        ? aggregation === 'latest'
          ? samples.reduce((latest, sample) =>
              sample.timestamp > latest.timestamp ? sample : latest
            ).value
          : samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length
        : undefined,
      sampleCount: samples.length,
    };
  });
}

export function formatChartBucketLabel(
  period: ChartPeriod,
  bucketStart: number,
  locale: string,
): string {
  const date = new Date(bucketStart);
  if (period === 'week') {
    return date.toLocaleDateString(locale, { weekday: 'short' }).replace(/\.$/, '');
  }
  if (period === 'month') {
    return date.toLocaleDateString(locale, { day: 'numeric' });
  }
  return date.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
}

export function getChartYAxisScale(values: number[]): ChartYAxisScale {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return { yAxisOffset: 0, maxValue: 1 };
  }

  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);
  const span = maximum - minimum;
  const padding = span === 0
    ? Math.max(Math.abs(minimum) * 0.02, 1)
    : Math.max(span * 0.2, 0.5);
  const yAxisOffset = Math.max(0, Math.floor((minimum - padding) * 10) / 10);
  const upperBound = Math.ceil((maximum + padding) * 10) / 10;

  return {
    yAxisOffset,
    maxValue: Math.max(Math.ceil((upperBound - yAxisOffset) * 10) / 10, 1),
  };
}

export interface PositionedChartPoint {
  value: number;
  spacing: number;
}

export interface PositionedChartSeries {
  data: PositionedChartPoint[];
  axisLabels: string[];
  slotSpacing: number;
  initialSpacing: number;
  endSpacing: number;
}

export function buildPositionedChartSeries(
  buckets: ChartBucket[],
  period: ChartPeriod,
  locale: string,
  viewportWidth: number,
): PositionedChartSeries {
  const totalBucketCount = buckets.length;

  const slotSpacing = Math.max(
    (viewportWidth - CHART_INITIAL_SPACING - CHART_END_SPACING) / Math.max(totalBucketCount - 1, 1),
    1
  );

  const useSparseAnnualLabels = period === 'year' && slotSpacing < 32;
  const axisLabels = buckets.map((bucket, index) => {
    if (
      useSparseAnnualLabels &&
      index !== totalBucketCount - 1 &&
      (index % 2 !== 0 || index === totalBucketCount - 2)
    ) {
      return '';
    }

    return formatChartBucketLabel(period, bucket.start, locale);
  });

  const populated = buckets
    .map((bucket, index) => ({ bucket, index }))
    .filter((item): item is { bucket: ChartBucket & { value: number }; index: number } => {
      return item.bucket.value !== undefined && item.bucket.value !== null;
    });

  if (populated.length === 0) {
    return {
      data: [],
      axisLabels,
      slotSpacing,
      initialSpacing: CHART_INITIAL_SPACING,
      endSpacing: CHART_END_SPACING,
    };
  }

  const leadingEmptyBucketCount = populated[0].index;
  const trailingEmptyBucketCount = totalBucketCount - 1 - populated[populated.length - 1].index;

  const data: PositionedChartPoint[] = populated.map((item, i) => {
    let spacing = 0;
    if (i < populated.length - 1) {
      const nextIndex = populated[i + 1].index;
      spacing = (nextIndex - item.index) * slotSpacing;
    }
    return {
      value: item.bucket.value,
      spacing,
    };
  });

  return {
    data,
    axisLabels,
    slotSpacing,
    initialSpacing: CHART_INITIAL_SPACING + leadingEmptyBucketCount * slotSpacing,
    endSpacing: CHART_END_SPACING + trailingEmptyBucketCount * slotSpacing,
  };
}
