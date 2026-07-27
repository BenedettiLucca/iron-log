import fs from 'node:fs';
import path from 'node:path';
import { en } from '../../src/i18n/translations/en';
import { es } from '../../src/i18n/translations/es';
import { pt } from '../../src/i18n/translations/pt';
import { zh } from '../../src/i18n/translations/zh';

const projectRoot = path.resolve(__dirname, '../..');
const readSource = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
const sourceSection = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Missing source section: ${start} -> ${end}`);
  return source.slice(startIndex, endIndex);
};
const getTranslation = (locale: Record<string, unknown>, key: string): unknown =>
  key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, locale);

const bioSource = readSource('app/(tabs)/bio.tsx');
const analyticsSource = readSource('app/bio/analytics.tsx');
const analyticsServiceSource = readSource('services/AnalyticsService.ts');
const quickActionsSection = sourceSection(bioSource, '{/* Botões de Ação Rápida */}', '{/* Check-in Mensal */}');
const historySection = sourceSection(bioSource, '{/* Histórico Detalhado */}', '{/* Modal de Check-in */}');
const insightsSection = sourceSection(analyticsSource, '{/* Insights Card */}', '{/* Strength Score');
const weeklyVolumeSection = sourceSection(analyticsSource, '{/* Volume weekly bar chart card */}', '{/* Body Weight Chart */}');
const bodyWeightSection = sourceSection(analyticsSource, '{/* Body Weight Chart */}', '{/* Volume Distribution Card */}');
const strengthSection = sourceSection(analyticsSource, '{/* Strength Score */}', '{/* Top Exercise Progressions */}');
const topProgressionSection = sourceSection(analyticsSource, '{/* Top Exercise Progressions */}', '{/* Estimated 1RM */}');
const estimatedRmSection = sourceSection(analyticsSource, '{/* Estimated 1RM */}', '<View className="h-8"');

const sprint4AnalyticsKeys = [
  'bioAnalytics.sessionCount30d',
  'bioAnalytics.period30d',
  'bioAnalytics.period12Weeks',
  'bioAnalytics.noComparison',
  'bioAnalytics.stable',
  'bioAnalytics.avgSrpe',
  'bioAnalytics.avgDuration',
  'bioAnalytics.bodyWeight',
  'bioAnalytics.insights',
  'bioAnalytics.weightChartHint',
  'bioAnalytics.volumeDistribution',
  'bioAnalytics.byMuscleGroup',
  'bioAnalytics.noVolumeDistribution',
  'bioAnalytics.noWeeklyVolume',
  'bioAnalytics.newExercise',
  'bioAnalytics.previousValue',
  'bioAnalytics.insightVolumeUnavailableDesc',
] as const;

describe('Sprint 4 batch A — Bio hierarchy and honest data', () => {
  it('uses readable flat quick-action rows instead of a clipped three-column tile grid', () => {
    expect(quickActionsSection).not.toContain('min-w-[30%]');
    expect(quickActionsSection).not.toContain('numberOfLines={1}');
    expect(quickActionsSection).not.toContain('uppercase');
    expect(quickActionsSection).toContain('min-h-[44px]');
    expect(quickActionsSection).toContain('border-b border-border/50');
  });

  it('keeps one responsive monthly photo preview and removes the duplicate gallery surface', () => {
    expect(bioSource).not.toContain('{/* Galeria Recente (Último Monthly) */}');
    expect(bioSource.match(/\['photoFront', 'photoBack', 'photoSide'\]/g) ?? []).toHaveLength(1);
    expect(bioSource).toContain('latestMonthlyWithPhotos');
    expect(bioSource).not.toMatch(/metrics\.find\(m => m\.type === 'monthly' && m\[p\]\)/);
    expect(bioSource).toContain('className="flex-row gap-2"');
    expect(bioSource).not.toContain('w-[31%]');
  });

  it('renders history as flat rows and never prints nullkg', () => {
    expect(historySection).not.toMatch(/bg-card[^"\n]*rounded-2xl/);
    expect(historySection).toContain('border-b border-border/50');
    expect(historySection).toContain('isDisplayableBodyMetricValue(item.weight)');
    expect(historySection).not.toMatch(/<Card[^>]*>[\s\S]*metrics\.length\s*>\s*0/);
  });

  it('does not coerce an omitted monthly weight to zero', () => {
    expect(bioSource).not.toContain('Number(todayWeight) ||');
    expect(bioSource).toContain('latestValidWeight');
    expect(bioSource).toMatch(/weight:\s*[^,]+\?\?\s*null/);
  });

  it('names the weight input, monthly CTA and photo poses for assistive technology', () => {
    expect(bioSource).toContain("accessibilityLabel={t('bio.registerWeight')}");
    expect(bioSource).toContain("accessibilityLabel={t('bio.monthlyCheckin')}");
    expect(bioSource).toContain("accessibilityHint={t('bio.openMonthlyCheckinHint')}");
    expect(bioSource).toContain('accessibilityLabel={t(labelKey)}');
  });

  it('supports Android Back and keyboard-safe interaction in the monthly modal', () => {
    expect(bioSource).toContain('onRequestClose={handleCloseModal}');
    expect(bioSource.match(/automaticallyAdjustKeyboardInsets/g) ?? []).toHaveLength(2);
    expect(bioSource.match(/keyboardShouldPersistTaps="handled"/g) ?? []).toHaveLength(2);
  });

  it('preserves Bio data, media, dirty-form and navigation behavior', () => {
    for (const invariant of [
      'useBodyMetrics()',
      'validateMonthlyCheckin(monthlyData)',
      'getMonthlyCheckinDateRange(now)',
      'isCheckinDirty({ photos, monthlyData, photoNotes })',
      'ImagePicker.requestMediaLibraryPermissionsAsync()',
      'ImageManipulator.manipulateAsync(',
      'FileSystem.copyAsync(',
      "'/bio/goals'",
      "'/bio/evolution'",
      "'/bio/analytics'",
      "'/supplements'",
      "'/reports/weekly'",
    ]) {
      expect(bioSource).toContain(invariant);
    }
  });
});

describe('Sprint 4 batch A — Analytics hierarchy, charts and comparison honesty', () => {
  it('folds key metrics into the 30-day anchor instead of rendering four StatTiles', () => {
    expect(analyticsSource).not.toMatch(/import\s+\{[^}]*\bStatTile\b[^}]*\}\s+from/);
    expect(analyticsSource).not.toContain('<StatTile');
    expect(analyticsSource).toContain('recentSessionsCount');
    expect(analyticsSource).not.toContain('consistency.sessionsThisMonth}</Text>');
  });

  it('leaves header ownership to the root Stack and stays inside the product type/color scale', () => {
    expect(analyticsSource).not.toContain('<Stack.Screen');
    expect(analyticsSource).not.toContain('text-5xl');
    expect(analyticsSource).not.toContain('bg-primary/5');
  });

  it('routes all visible Analytics copy through i18n', () => {
    expect(analyticsSource).not.toMatch(/language\s*===/);
    for (const key of sprint4AnalyticsKeys) {
      expect(analyticsSource).toContain(`t('${key}'`);
    }
  });

  it('keeps stale content visible but announces refresh failures', () => {
    expect(analyticsSource).toContain('hasError && data &&');
    expect(analyticsSource).toContain('accessibilityLiveRegion="polite"');
  });

  it('publishes analytics only after secondary queries succeed', () => {
    expect(analyticsSource.indexOf('setData(analytics)')).toBeGreaterThan(
      analyticsSource.indexOf('setWeightData(chartWeights)'),
    );
  });

  it('represents missing comparisons and samples as unavailable rather than stable zeroes', () => {
    expect(analyticsSource).toContain('getMetricTrend');
    expect(analyticsSource).toContain('getPercentageTrend');
    expect(analyticsSource).toMatch(/recentAvgRpe:\s*number\s*\|\s*null/);
    expect(analyticsSource).toMatch(/recentAvgDur:\s*number\s*\|\s*null/);
    expect(analyticsSource).toContain("strengthScore.labelKey === 'noData'");
    expect(analyticsSource).toContain("strengthScore.labelKey === 'error'");
    expect(strengthSection).not.toContain('<ErrorState');
  });

  it('does not call unavailable data stable or fake a weekly bar', () => {
    expect(analyticsSource).toContain("volTrend.direction === 'stable'");
    expect(analyticsSource).toContain("t('bioAnalytics.insightVolumeUnavailableDesc')");
    expect(weeklyVolumeSection).toContain("t('bioAnalytics.period12Weeks')");
    expect(weeklyVolumeSection).not.toContain("t('bioAnalytics.period30d')");
    expect(weeklyVolumeSection).toContain('const visibleVolumeTrends = volumeTrends.slice(-12)');
    expect(weeklyVolumeSection).toContain('Math.max(...visibleVolumeTrends.map');
    expect(weeklyVolumeSection).toContain('week.totalVolume > 0 ? Math.max(barWidth, 2) : 0');
    expect(weeklyVolumeSection).not.toContain('width: `${Math.max(barWidth, 2)}%`');
    expect(analyticsSource).toContain('hasWeeklyVolume');
    expect(weeklyVolumeSection).toContain("t('bioAnalytics.noWeeklyVolume')");
  });

  it('formats trend units once and keeps the 30-day anchor readable at 320dp', () => {
    expect(analyticsSource).not.toContain('isPercentage');
    expect(analyticsSource).not.toContain("suffix: '%'");
    expect(analyticsSource).toContain('flex-row justify-between items-start gap-3');
    expect(analyticsSource).toContain("t('bioAnalytics.period30d')");
  });

  it('uses sentence case for ordinary score labels and allows long exercise names to wrap', () => {
    expect(strengthSection).toContain('accessibilityLabel={`${t("bioAnalytics.volume")}: ${strengthScore.volumeScore}/40`}');
    expect(strengthSection).not.toMatch(/accessibilityLabel=.*ProgressBar/);
    expect(topProgressionSection).toContain('min-w-0');
    expect(topProgressionSection).toContain('gap-3');
    expect(estimatedRmSection).not.toContain('numberOfLines={1}');
  });

  it('makes chart axes theme-aware, labels the unit, and uses fixed viewport period chart', () => {
    for (const contract of [
      'yAxisTextStyle',
      'ChartXAxisLabels',
      'xAxisLabelsHeight={0}',
      'yAxisLabelSuffix',
      "t('chartPeriods.accessibilityLabel')",
    ]) {
      expect(analyticsSource).toContain(contract);
    }
    expect(analyticsSource).not.toContain('getScrollableChartWidth');
    expect(analyticsSource).not.toContain('showsHorizontalScrollIndicator');
    expect(analyticsSource).toContain('yAxisLabelWidth');
  });

  it('retains complete valid weight history and buckets at render time instead of hardcoding 30 days', () => {
    expect(analyticsSource).toContain('bucketChartSeries');
    expect(analyticsSource).not.toContain('}).slice(-30)');
    expect(bodyWeightSection).toContain('SegmentedControl');
    expect(bodyWeightSection).toContain("t('bioAnalytics.weightChartHint')");
  });

  it('keeps unclassified exercise volume visible in the translated Other bucket', () => {
    expect(analyticsSource.match(/other:\s*0/g) ?? []).toHaveLength(2);
  });

  it('shows intentional partial states for short weight history and empty volume distribution', () => {
    expect(analyticsSource).toContain('consistency.totalSessions === 0 && weightData.length === 0');
    expect(analyticsSource).toContain('weightChart.populatedCount < 2');
    expect(analyticsSource).toContain("t('bioAnalytics.weightChartHint')");
    expect(analyticsSource).toContain('hasVolumeDistribution');
    expect(analyticsSource).toContain("t('bioAnalytics.noVolumeDistribution')");
  });

  it('reuses the canonical accessible ProgressBar for strength sub-scores', () => {
    expect(analyticsSource).toMatch(/import\s+\{[^}]*\bProgressBar\b[^}]*\}\s+from/);
    expect(analyticsSource).toContain('<ProgressBar');
    expect(analyticsSource).not.toMatch(/style=\{\{ width: `\$\{\(strengthScore\./);
  });

  it('keeps insight rows flat inside their section container', () => {
    expect(insightsSection).not.toContain('bg-successSurface');
    expect(insightsSection).not.toContain('bg-primary/5');
    expect(insightsSection).not.toMatch(/rounded-xl[^"\n]*p-3/);
  });

  it('propagates internal analytics query failures instead of returning fake zeros', () => {
    expect(analyticsServiceSource.match(/throw e;/g) ?? []).toHaveLength(5);
  });

  it('does not manufacture +100% progression without a prior baseline', () => {
    expect(analyticsServiceSource).toContain('previousMaxWeight: number | null');
    expect(analyticsServiceSource).toContain('progress: number | null');
    expect(analyticsServiceSource).toContain('previousMax.get(exerciseId) ?? null');
    expect(analyticsServiceSource).not.toMatch(/prevMax\s*>\s*0\s*\?[^:]+:\s*100/);
    expect(analyticsSource).toContain("t('bioAnalytics.newExercise')");
    expect(analyticsSource).not.toContain("previousMaxWeight || '?'");
  });

  it('preserves Analytics loading, refresh and active-row query contracts', () => {
    for (const invariant of [
      'AnalyticsService.getFullAnalytics()',
      'db.select().from(sessions).where(isNull(sessions.deletedAt))',
      'db.select().from(sets).where(isNull(sets.deletedAt))',
      'db.select().from(personalRecords)',
      'db.select().from(bodyMetrics).orderBy(asc(bodyMetrics.date))',
      'onRefresh={onRefresh}',
      'refreshing={refreshing}',
    ]) {
      expect(analyticsSource).toContain(invariant);
    }
  });

  it('defines the new data-window and partial-state copy in every locale', () => {
    for (const locale of [pt, en, es, zh]) {
      for (const key of sprint4AnalyticsKeys) {
        expect(typeof getTranslation(locale as unknown as Record<string, unknown>, key)).toBe('string');
      }
    }
  });
});

describe('Sprint 4 batch B — Goals progress and data integrity', () => {
  const goalsSource = readSource('app/bio/goals.tsx');

  it('uses calculateGoalProgress helper and removes local calculateProgress', () => {
    expect(goalsSource).toContain("calculateGoalProgress, findGoalBaseline");
    expect(goalsSource).toContain("calculateGoalProgress(");
    expect(goalsSource).not.toContain("const calculateProgress =");
  });

  it('resets achieved status and achievedDate on edit update without resetting startDate', () => {
    expect(goalsSource).toContain("achieved: false");
    expect(goalsSource).toContain("achievedDate: null");
    expect(goalsSource).not.toMatch(/startDate:\s*null/);
  });

  it('removes Portuguese fallback literals', () => {
    expect(goalsSource).not.toMatch(/t\([^)]+\)\s*\|\|\s*['"]/);
  });

  it('adds contextual accessibility labels to edit/delete buttons', () => {
    expect(goalsSource).toContain("accessibilityLabel={t('bioGoals.editActionLabel', { name: MEASUREMENT_LABELS[goal.type as MeasurementType] })}");
    expect(goalsSource).toContain("accessibilityLabel={t('bioGoals.deleteActionLabel', { name: MEASUREMENT_LABELS[goal.type as MeasurementType] })}");
  });

  it('defines the goal action accessibility labels in all locales', () => {
    const keys = [
      'bioGoals.editActionLabel',
      'bioGoals.deleteActionLabel',
      'bioGoals.progressUnavailable',
    ];
    for (const locale of [pt, en, es, zh]) {
      for (const key of keys) {
        expect(typeof getTranslation(locale as unknown as Record<string, unknown>, key)).toBe('string');
      }
    }
  });

  it('does not announce unavailable progress as zero to assistive technology', () => {
    expect(goalsSource).toContain("accessibilityLabel={progress === null ? t('bioGoals.progressUnavailable') : undefined}");
    expect(goalsSource).toContain('isAccessible={progress !== null}');
  });
});
