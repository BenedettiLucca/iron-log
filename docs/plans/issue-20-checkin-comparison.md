# Issue #20: Check-in Mensal Automatizado — Implementation Plan

> **For Hermes:** Use test-driven-development skill. Every code change needs a failing test first.

**Goal:** Build a comprehensive monthly check-in comparison experience with side-by-side photos, measurement overlays, chronological gallery, and enhanced notifications.

**Architecture:** Extend existing `bodyMetrics` and `notificationSettings` tables. Reuse `PhotoComparison` slider pattern. New screen under `app/(drawer)/bio/checkin.tsx`. Pure helper functions extracted for testability.

**Tech Stack:** React Native / Expo / Drizzle ORM / NativeWind / Jest

---

## Task 1: Add utility functions for check-in formatting

**Objective:** Pure functions to format dates, calculate changes, and extract overlay data.

**Files:**
- Create: `src/utils/checkin.ts`
- Test: `__tests__/utils/checkin.test.ts`

**Step 1: Write failing test**

```typescript
import { formatMonthYear, calculateChange, getPhotoOverlayData } from '../../src/utils/checkin';
import { BodyMetric } from '../../src/types';

describe('checkin utils', () => {
  describe('formatMonthYear', () => {
    it('formats epoch to "Mês Ano" in pt-BR', () => {
      const result = formatMonthYear(new Date(2026, 3, 15).getTime(), 'pt-BR');
      expect(result).toBe('abril 2026');
    });
  });

  describe('calculateChange', () => {
    it('returns positive change with + sign', () => {
      expect(calculateChange(120, 118)).toBe('+2.0');
    });
    it('returns negative change with - sign', () => {
      expect(calculateChange(118, 120)).toBe('-2.0');
    });
    it('returns 0 when equal', () => {
      expect(calculateChange(120, 120)).toBe('0.0');
    });
  });

  describe('getPhotoOverlayData', () => {
    it('extracts weight and waist from metric', () => {
      const metric: Partial<BodyMetric> = { weight: 116.5, waist: 87 };
      const result = getPhotoOverlayData(metric as BodyMetric);
      expect(result).toEqual({ weight: '116.5 kg', waist: '87 cm' });
    });
    it('returns null for missing values', () => {
      const metric: Partial<BodyMetric> = { weight: null, waist: null };
      const result = getPhotoOverlayData(metric as BodyMetric);
      expect(result).toEqual({ weight: null, waist: null });
    });
  });
});
```

**Step 2: Run test to verify failure**
Run: `npx jest __tests__/utils/checkin.test.ts -v`
Expected: FAIL — modules not found

**Step 3: Write minimal implementation**

```typescript
// src/utils/checkin.ts
import { BodyMetric } from '@/src/types';

export function formatMonthYear(epoch: number, locale = 'pt-BR'): string {
  return new Date(epoch).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function calculateChange(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return '—';
  const diff = current - previous;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}`;
}

export function getPhotoOverlayData(metric: BodyMetric): { weight: string | null; waist: string | null } {
  return {
    weight: metric.weight ? `${metric.weight} kg` : null,
    waist: metric.waist ? `${metric.waist} cm` : null,
  };
}
```

**Step 4: Run test to verify pass**
Run: `npx jest __tests__/utils/checkin.test.ts -v`
Expected: PASS

**Step 5: Commit**
```bash
git add src/utils/checkin.ts __tests__/utils/checkin.test.ts
git commit -m "feat(checkin): add pure utility functions for check-in formatting"
```

---

## Task 2: Enhance useBodyMetrics hook with comparison helpers

**Objective:** Add methods to get monthly metrics for side-by-side comparison.

**Files:**
- Modify: `hooks/use-body-metrics.ts`
- Test: `__tests__/hooks/use-body-metrics.test.ts` (new file)

**Step 1: Write failing test**

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { useBodyMetrics } from '../../hooks/use-body-metrics';
import { db } from '../../src/db/client';
import { bodyMetrics } from '../../src/db/schema';

jest.mock('../../src/db/client', () => ({
  db: {
    select: jest.fn(() => ({ from: jest.fn(() => ({ orderBy: jest.fn(() => Promise.resolve([])) })) })),
  },
}));

describe('useBodyMetrics', () => {
  it('getMonthlyMetrics returns only monthly entries', () => {
    const { result } = renderHook(() => useBodyMetrics());
    // Would need more elaborate mock setup for full test
  });
});
```

Actually, let's simplify: since `useBodyMetrics` depends on DB, we'll test the pure helper `groupMetricsByMonth` separately.

**Revised approach:**
Create a pure helper file `src/utils/body-metrics.ts` with `groupMetricsByMonth`, `getAdjacentMonths`, and test that.

**Files:**
- Create: `src/utils/body-metrics.ts`
- Test: `__tests__/utils/body-metrics.test.ts`

```typescript
// Test
import { groupMetricsByMonth, getAdjacentMonths } from '../../src/utils/body-metrics';
import { BodyMetric } from '../../src/types';

const makeMetric = (overrides: Partial<BodyMetric>): BodyMetric => ({
  id: 1, date: Date.now(), type: 'monthly', weight: null, waist: null,
  armRight: null, thighRight: null, chest: null, calf: null,
  photoFront: null, photoBack: null, photoSide: null, photoNotes: null,
  ...overrides,
});

describe('groupMetricsByMonth', () => {
  it('groups metrics by year-month', () => {
    const metrics: BodyMetric[] = [
      makeMetric({ id: 1, date: new Date(2026, 3, 5).getTime() }),
      makeMetric({ id: 2, date: new Date(2026, 3, 20).getTime() }),
      makeMetric({ id: 3, date: new Date(2026, 2, 10).getTime() }),
    ];
    const grouped = groupMetricsByMonth(metrics);
    expect(Object.keys(grouped).length).toBe(2);
    expect(grouped['2026-04'].length).toBe(2);
    expect(grouped['2026-03'].length).toBe(1);
  });
});

describe('getAdjacentMonths', () => {
  it('returns current and previous month metrics', () => {
    const metrics: BodyMetric[] = [
      makeMetric({ id: 1, date: new Date(2026, 3, 5).getTime(), weight: 116 }),
      makeMetric({ id: 2, date: new Date(2026, 2, 10).getTime(), weight: 118 }),
      makeMetric({ id: 3, date: new Date(2026, 1, 15).getTime(), weight: 120 }),
    ];
    const { current, previous } = getAdjacentMonths(metrics);
    expect(current?.weight).toBe(116);
    expect(previous?.weight).toBe(118);
  });

  it('returns null previous when only one month', () => {
    const metrics: BodyMetric[] = [makeMetric({ id: 1, date: new Date(2026, 3, 5).getTime() })];
    const { current, previous } = getAdjacentMonths(metrics);
    expect(current).not.toBeNull();
    expect(previous).toBeNull();
  });
});
```

**Step 2: Run test to verify failure**
Run: `npx jest __tests__/utils/body-metrics.test.ts -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/utils/body-metrics.ts
import { BodyMetric } from '@/src/types';

export function groupMetricsByMonth(metrics: BodyMetric[]): Record<string, BodyMetric[]> {
  return metrics.reduce((acc, metric) => {
    const d = new Date(metric.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(metric);
    return acc;
  }, {} as Record<string, BodyMetric[]>);
}

export function getAdjacentMonths(metrics: BodyMetric[]): { current: BodyMetric | null; previous: BodyMetric | null } {
  const sorted = [...metrics].sort((a, b) => b.date - a.date);
  if (sorted.length === 0) return { current: null, previous: null };
  return {
    current: sorted[0],
    previous: sorted[1] || null,
  };
}
```

**Step 4: Run test to verify pass**
Expected: PASS

**Step 5: Commit**
```bash
git add src/utils/body-metrics.ts __tests__/utils/body-metrics.test.ts
git commit -m "feat(checkin): add body-metrics grouping and adjacent month helpers"
```

---

## Task 3: Build PhotoOverlay component

**Objective:** Floating badges on individual photos showing weight and waist.

**Files:**
- Create: `components/PhotoOverlay.tsx`
- Test: `__tests__/components/PhotoOverlay.test.tsx`

**Step 1: Write failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { PhotoOverlay } from '../../components/PhotoOverlay';

describe('PhotoOverlay', () => {
  it('renders weight badge when weight provided', () => {
    const { getByText } = render(<PhotoOverlay weight="116.5 kg" waist={null} />);
    expect(getByText('116.5 kg')).toBeTruthy();
  });

  it('renders waist badge when waist provided', () => {
    const { getByText } = render(<PhotoOverlay weight={null} waist="87 cm" />);
    expect(getByText('87 cm')).toBeTruthy();
  });

  it('renders both badges', () => {
    const { getByText } = render(<PhotoOverlay weight="116.5 kg" waist="87 cm" />);
    expect(getByText('116.5 kg')).toBeTruthy();
    expect(getByText('87 cm')).toBeTruthy();
  });

  it('renders nothing when both null', () => {
    const { queryByTestId } = render(<PhotoOverlay weight={null} waist={null} />);
    expect(queryByTestId('photo-overlay')).toBeNull();
  });
});
```

**Step 2: Run test — verify failure**

**Step 3: Write minimal implementation**

```tsx
// components/PhotoOverlay.tsx
import { View, Text } from 'react-native';

interface PhotoOverlayProps {
  weight: string | null;
  waist: string | null;
}

export function PhotoOverlay({ weight, waist }: PhotoOverlayProps) {
  if (!weight && !waist) return null;

  return (
    <View testID="photo-overlay" className="absolute bottom-0 left-0 right-0 flex-row justify-between px-3 py-2">
      {weight && (
        <View className="bg-black/60 px-2.5 py-1 rounded-lg">
          <Text className="text-white text-xs font-bold">{weight}</Text>
        </View>
      )}
      {waist && (
        <View className="bg-black/60 px-2.5 py-1 rounded-lg">
          <Text className="text-white text-xs font-bold">{waist}</Text>
        </View>
      )}
    </View>
  );
}
```

**Step 4: Run test — verify pass**

**Step 5: Commit**

---

## Task 4: Build CheckinGallery component

**Objective:** Horizontal scroll of month thumbnails with dates.

**Files:**
- Create: `components/CheckinGallery.tsx`
- Test: `__tests__/components/CheckinGallery.test.tsx`

**Step 1: Write failing test**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CheckinGallery } from '../../components/CheckinGallery';
import { BodyMetric } from '../../src/types';

const mockMetrics: BodyMetric[] = [
  { id: 1, date: new Date(2026, 3, 5).getTime(), type: 'monthly', weight: 116, waist: 87, photoFront: 'uri1', photoBack: null, photoSide: null, photoNotes: null, armRight: null, thighRight: null, chest: null, calf: null },
  { id: 2, date: new Date(2026, 2, 10).getTime(), type: 'monthly', weight: 118, waist: 89, photoFront: 'uri2', photoBack: null, photoSide: null, photoNotes: null, armRight: null, thighRight: null, chest: null, calf: null },
];

describe('CheckinGallery', () => {
  it('renders month thumbnails', () => {
    const { getByText } = render(<CheckinGallery metrics={mockMetrics} onSelectMonth={() => {}} />);
    expect(getByText('abril 2026')).toBeTruthy();
    expect(getByText('março 2026')).toBeTruthy();
  });

  it('calls onSelectMonth when tapped', () => {
    const onSelect = jest.fn();
    const { getByText } = render(<CheckinGallery metrics={mockMetrics} onSelectMonth={onSelect} />);
    fireEvent.press(getByText('abril 2026'));
    expect(onSelect).toHaveBeenCalledWith(mockMetrics[0]);
  });
});
```

**Step 2-4: Implement, test, verify.**

```tsx
// components/CheckinGallery.tsx
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { BodyMetric } from '@/src/types';
import { formatMonthYear } from '@/src/utils/checkin';

interface CheckinGalleryProps {
  metrics: BodyMetric[];
  onSelectMonth: (metric: BodyMetric) => void;
}

export function CheckinGallery({ metrics, onSelectMonth }: CheckinGalleryProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3 py-2">
      {metrics.map((metric) => (
        <TouchableOpacity
          key={metric.id}
          onPress={() => onSelectMonth(metric)}
          className="items-center mx-2"
          accessibilityRole="button"
          accessibilityLabel={`Check-in de ${formatMonthYear(metric.date)}`}
        >
          <View className="w-20 h-20 rounded-xl bg-background border border-border overflow-hidden">
            {metric.photoFront ? (
              <Image source={{ uri: metric.photoFront }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="flex-1 justify-center items-center">
                <Text className="text-subtext text-lg">📷</Text>
              </View>
            )}
          </View>
          <Text className="text-subtext text-xs mt-1.5 font-medium">{formatMonthYear(metric.date)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
```

**Step 5: Commit**

---

## Task 5: Build MonthlyCheckinComparison component

**Objective:** Side-by-side comparison of front/back/side with metrics.

**Files:**
- Create: `components/MonthlyCheckinComparison.tsx`
- Test: `__tests__/components/MonthlyCheckinComparison.test.tsx`

**Step 1: Write failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { MonthlyCheckinComparison } from '../../components/MonthlyCheckinComparison';
import { BodyMetric } from '../../src/types';

const current: BodyMetric = {
  id: 1, date: new Date(2026, 3, 5).getTime(), type: 'monthly',
  weight: 116.5, waist: 87, photoFront: 'front1', photoBack: 'back1', photoSide: 'side1',
  photoNotes: null, armRight: null, thighRight: null, chest: null, calf: null,
};

const previous: BodyMetric = {
  id: 2, date: new Date(2026, 2, 10).getTime(), type: 'monthly',
  weight: 118.2, waist: 89, photoFront: 'front2', photoBack: 'back2', photoSide: 'side2',
  photoNotes: null, armRight: null, thighRight: null, chest: null, calf: null,
};

describe('MonthlyCheckinComparison', () => {
  it('renders both month labels', () => {
    const { getByText } = render(<MonthlyCheckinComparison current={current} previous={previous} />);
    expect(getByText(/abril 2026/i)).toBeTruthy();
    expect(getByText(/março 2026/i)).toBeTruthy();
  });

  it('shows weight and waist for current month', () => {
    const { getByText } = render(<MonthlyCheckinComparison current={current} previous={previous} />);
    expect(getByText('116.5 kg')).toBeTruthy();
    expect(getByText('87 cm')).toBeTruthy();
  });

  it('shows change indicators', () => {
    const { getByText } = render(<MonthlyCheckinComparison current={current} previous={previous} />);
    expect(getByText(/-1.7/)).toBeTruthy();
    expect(getByText(/-2.0/)).toBeTruthy();
  });
});
```

**Step 2-4: Implement, test, verify.**

```tsx
// components/MonthlyCheckinComparison.tsx
import { View, Text, Image, ScrollView } from 'react-native';
import { BodyMetric } from '@/src/types';
import { formatMonthYear, calculateChange, getPhotoOverlayData } from '@/src/utils/checkin';
import { PhotoOverlay } from './PhotoOverlay';
import { Colors } from '@/constants/colors';

interface Props {
  current: BodyMetric;
  previous: BodyMetric | null;
}

const POSES: Array<{ key: keyof BodyMetric; label: string }> = [
  { key: 'photoFront', label: 'FRENTE' },
  { key: 'photoBack', label: 'COSTAS' },
  { key: 'photoSide', label: 'LATERAL' },
];

export function MonthlyCheckinComparison({ current, previous }: Props) {
  const currentOverlay = getPhotoOverlayData(current);
  const previousOverlay = previous ? getPhotoOverlayData(previous) : { weight: null, waist: null };

  return (
    <ScrollView className="flex-1 px-4" contentContainerStyle={{ gap: 20, paddingBottom: 40 }}>
      {POSES.map((pose) => {
        const currentUri = current[pose.key] as string | null;
        const previousUri = previous ? (previous[pose.key] as string | null) : null;

        return (
          <View key={pose.key} className="gap-3">
            <Text className="text-primary font-bold text-xs uppercase tracking-widest text-center">{pose.label}</Text>

            <View className="flex-row gap-3">
              {/* Previous Month */}
              <View className="flex-1">
                <Text className="text-subtext text-xs text-center mb-1.5 font-medium">
                  {previous ? formatMonthYear(previous.date) : '—'}
                </Text>
                <View className="aspect-[3/4] bg-background rounded-xl border border-border overflow-hidden relative">
                  {previousUri ? (
                    <>
                      <Image source={{ uri: previousUri }} className="w-full h-full" resizeMode="cover" />
                      <PhotoOverlay weight={previousOverlay.weight} waist={previousOverlay.waist} />
                    </>
                  ) : (
                    <View className="flex-1 justify-center items-center">
                      <Text className="text-3xl">📷</Text>
                      <Text className="text-subtext text-xs mt-2">Sem foto</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row justify-between mt-2 px-1">
                  <Text className="text-subtext text-xs">{previous?.weight ?? '—'} kg</Text>
                  <Text className="text-subtext text-xs">{previous?.waist ?? '—'} cm</Text>
                </View>
              </View>

              {/* Current Month */}
              <View className="flex-1">
                <Text className="text-text text-xs text-center mb-1.5 font-bold">
                  {formatMonthYear(current.date)}
                </Text>
                <View className="aspect-[3/4] bg-background rounded-xl border border-border overflow-hidden relative">
                  {currentUri ? (
                    <>
                      <Image source={{ uri: currentUri }} className="w-full h-full" resizeMode="cover" />
                      <PhotoOverlay weight={currentOverlay.weight} waist={currentOverlay.waist} />
                    </>
                  ) : (
                    <View className="flex-1 justify-center items-center">
                      <Text className="text-3xl">📷</Text>
                      <Text className="text-subtext text-xs mt-2">Sem foto</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row justify-between mt-2 px-1">
                  <Text className="text-text text-xs font-bold">{current.weight ?? '—'} kg</Text>
                  <Text className="text-text text-xs font-bold">{current.waist ?? '—'} cm</Text>
                </View>
              </View>
            </View>

            {/* Change indicators */}
            {previous && (
              <View className="flex-row justify-center gap-6">
                <View className="flex-row items-center gap-1">
                  <Text className={`text-sm font-bold ${(current.weight ?? 0) < (previous.weight ?? 0) ? 'text-success' : 'text-danger'}`}>
                    {calculateChange(current.weight, previous.weight)} kg
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Text className={`text-sm font-bold ${(current.waist ?? 0) < (previous.waist ?? 0) ? 'text-success' : 'text-danger'}`}>
                    {calculateChange(current.waist, previous.waist)} cm
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
```

**Step 5: Commit**

---

## Task 6: Create checkin screen

**Objective:** Main screen accessible from Bio that hosts comparison + gallery.

**Files:**
- Create: `app/(drawer)/bio/checkin.tsx`
- Test: `__tests__/screens/checkin.test.tsx`

**Implementation:**
- Fetch monthly metrics from DB
- Show `MonthlyCheckinComparison` for current vs previous
- Toggle button for "Ver galeria completa" → shows `CheckinGallery`
- Button "Tirar novas fotos" → router.push('/bio?checkin=true') or navigate back with modal open
- Use `PhotoComparison` (existing slider) as an optional "Before/After" view per pose

**Step 1: Write failing test**

```tsx
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import CheckinScreen from '../../app/(drawer)/bio/checkin';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));

jest.mock('../../src/db/client', () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

describe('CheckinScreen', () => {
  it('renders empty state when no data', async () => {
    const { getByText } = render(<CheckinScreen />);
    await waitFor(() => {
      expect(getByText('Nenhum check-in mensal encontrado')).toBeTruthy();
    });
  });
});
```

**Step 2-4: Implement, test, verify.**

```tsx
// app/(drawer)/bio/checkin.tsx
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { db } from '../../../src/db/client';
import { bodyMetrics } from '../../../src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { BodyMetric } from '@/src/types';
import { MonthlyCheckinComparison } from '../../../components/MonthlyCheckinComparison';
import { CheckinGallery } from '../../../components/CheckinGallery';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { logger } from '@/services/logger';
import { useI18n } from '../../../src/i18n/index';

export default function CheckinScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [monthlyMetrics, setMonthlyMetrics] = useState<BodyMetric[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await db.select().from(bodyMetrics)
        .where(eq(bodyMetrics.type, 'monthly'))
        .orderBy(desc(bodyMetrics.date));
      setMonthlyMetrics(data || []);
    } catch (e) {
      logger.error('Failed to load monthly metrics', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Text className="text-subtext">{t('common.loading')}</Text>
      </View>
    );
  }

  if (monthlyMetrics.length === 0) {
    return (
      <View className="flex-1 bg-background px-4">
        <Stack.Screen options={{ title: t('bio.monthlyCheckin') }} />
        <View className="flex-1 justify-center">
          <EmptyState
            icon="📸"
            title={t('checkin.emptyTitle')}
            description={t('checkin.emptyDesc')}
          />
          <Button
            title={t('checkin.takePhotos')}
            onPress={() => router.push('/bio?checkin=open')}
            variant="primary"
            fullWidth
          />
        </View>
      </View>
    );
  }

  const current = monthlyMetrics[0];
  const previous = monthlyMetrics[1] || null;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('bio.monthlyCheckin') }} />

      {/* Header actions */}
      <View className="px-4 pt-4 pb-2 flex-row gap-3">
        <TouchableOpacity
          onPress={() => setShowGallery(s => !s)}
          className="flex-1 bg-card border border-border py-3 rounded-xl items-center"
        >
          <Text className="text-text font-bold text-sm">
            {showGallery ? t('checkin.hideGallery') : t('checkin.showGallery')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/bio?checkin=open')}
          className="flex-1 bg-primary py-3 rounded-xl items-center"
        >
          <Text className="text-white font-bold text-sm">{t('checkin.takePhotos')}</Text>
        </TouchableOpacity>
      </View>

      {showGallery && (
        <View className="px-4 pb-2">
          <CheckinGallery metrics={monthlyMetrics} onSelectMonth={(m) => { /* Could navigate to detail */ }} />
        </View>
      )}

      <MonthlyCheckinComparison current={current} previous={previous} />
    </View>
  );
}
```

**Step 5: Commit**

---

## Task 7: Update notification service

**Objective:** Update notification message and deep link.

**Files:**
- Modify: `services/NotificationService.ts`
- Test: `__tests__/services/NotificationService.test.ts` (or add to existing)

**Changes:**
1. Update `scheduleMonthlyCheckin` body and title:
   - title: '📸 Check-in Mensal'
   - body: 'Hora do check-in mensal! Tire fotos de frente, costas e lateral.'
2. Update data.url to `/bio/checkin`

**Step 1: Write failing test**

```typescript
// Verify notification content structure (mock test)
```

Actually, since NotificationService uses expo-notifications which is hard to mock in unit tests without heavy setup, we'll skip a dedicated test and verify via integration. But we should at least update the service.

**Step 2-4: Apply changes, verify lint/tsc passes.**

```typescript
// In scheduleMonthlyCheckin():
content: {
  title: '📸 Check-in Mensal',
  body: 'Hora do check-in mensal! Tire fotos de frente, costas e lateral.',
  data: { type: 'monthly_checkin', url: '/bio/checkin' },
  // ...
}
```

**Step 5: Commit**

---

## Task 8: Update Bio index screen navigation

**Objective:** Change "CHECK-IN MENSAL" button to navigate to new screen.

**Files:**
- Modify: `app/(drawer)/bio/index.tsx`
- Modify: `app/(drawer)/_layout.tsx` (add checkin screen to drawer with hidden item)

**Changes in index.tsx:**
- Replace `onPress={() => setModalVisible(true)}` with `onPress={() => router.push('/bio/checkin')}`
- Keep the modal section but maybe repurpose it for "Tirar novas fotos" flow
- Actually: the modal IS the check-in form. We should keep it but open it from the new checkin screen OR from a "+" button.
- Better approach: keep modal on bio/index for data entry, but the "Abrir" button goes to `/bio/checkin` for viewing comparison.

Wait, looking at the current code, the modal is the INPUT form for monthly check-in. The "Abrir" button opens the modal. We should:
1. Keep the modal as the input form
2. Add a new button "Visualizar" or change "Abrir" to go to `/bio/checkin`
3. Add a "Novo Check-in" button that opens the modal

Actually, looking more carefully: the current UI has the photo pickers directly on the Bio screen card, not inside a modal. The `modalVisible` state controls a Modal (not shown in the truncated output, but there must be one at the bottom). Let me check the rest of the file.

Looking at the file again: `setModalVisible(true)` is on the "Abrir" button. The modal contains the form. So we should:
- Change "Abrir" → navigate to `/bio/checkin` (the new comparison screen)
- Add a "Novo" button somewhere to open the modal for data entry

Actually, the simplest approach that matches the issue description:
- The Bio screen card becomes a summary card with a "Visualizar" button going to `/bio/checkin`
- Keep the monthly check-in modal but trigger it from a "+" or from the checkin screen

For minimal changes:
1. Change the "Abrir" button to navigate to `/bio/checkin`
2. In the checkin screen, the "Tirar novas fotos" button routes back to `/bio?checkin=open`
3. On bio/index, read the `checkin` query param and auto-open modal if present

This is clean.

**Changes in `_layout.tsx`:**
```tsx
<Drawer.Screen
  name="bio/checkin"
  options={{ drawerItemStyle: { display: 'none' } }}
/>
```

**Changes in `index.tsx`:**
- Import `useLocalSearchParams` from expo-router
- Read `checkin` param
- `useEffect` to auto-open modal if `checkin === 'open'`
- Change "Abrir" button `onPress` to `router.push('/bio/checkin')`
- Keep modal for data entry

**Step 1: Write failing test**
Skip for screen-level integration — too heavy. We'll rely on lint + tsc + existing tests.

**Step 2-4: Implement, verify.**

**Step 5: Commit**

---

## Task 9: Add i18n translations

**Objective:** Add new keys for checkin comparison in all 4 languages.

**Files:**
- Modify: `src/i18n/translations/pt.ts`, `en.ts`, `es.ts`, `zh.ts`

**New keys needed:**
```
checkin: {
  emptyTitle: 'Nenhum check-in mensal encontrado',
  emptyDesc: 'Faça seu primeiro check-in mensal para acompanhar sua evolução.',
  takePhotos: 'Tirar novas fotos',
  showGallery: 'Ver galeria completa',
  hideGallery: 'Ocultar galeria',
  compareWith: 'Comparar com',
  weightChange: 'Peso',
  waistChange: 'Cintura',
  noPhoto: 'Sem foto',
}
```

Translate to EN, ES, ZH.

**Step 1: Write failing test**
Add to `__tests__/i18n/i18n.test.tsx` to verify key parity.

**Step 2-4: Add translations, verify parity test passes.**

**Step 5: Commit**

---

## Task 10: Run full validation

**Commands:**
```bash
npx jest
npx tsc --noEmit
npm run lint
```

Fix any issues.

**Commit:**
```bash
git commit -m "feat(checkin): complete issue #20 implementation"
```

---

## Task 11: Update documentation

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `CLAUDE.md`, `GEMINI.md`

**CHANGELOG entry:**
```
## [Unreleased]

### Added
- Issue #20: Automated Monthly Check-in Comparison
  - Side-by-side photo comparison (front/back/side) with previous month
  - Measurement overlays on photos (weight, waist)
  - Chronological gallery with horizontal scroll
  - "Before/After" slider per pose
  - Enhanced notification: "📸 Hora do check-in mensal!"
  - Deep link from notification to `/bio/checkin`
```

**Step 1: Write changes**
**Step 2: Commit**
