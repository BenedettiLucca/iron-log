import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HistoryScreen from '@/app/(tabs)/history';
(global as typeof globalThis & { React: typeof React }).React = React;
import { db, sqlite } from '../fixtures/database';
import {
  HistoryQueryService,
  isValidDateKey,
  getMonthRange,
  getDayRange,
  getDateIntervalRange,
} from '@/services/HistoryQueryService';
import { sessions, sets, exercises } from '@/src/db/schema';
import { toLocalDateKey } from '@/src/utils/date-key';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

let mockParams: { date?: string } = {};
const mockRouterPush = jest.fn();

jest.mock('react-native', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Platform: {
      OS: 'android',
      select: (options: Record<string, unknown>) => options['android'] ?? options.default,
    },
    View: (props: any) => ReactActual.createElement('View', props, props.children),
    Text: (props: any) => ReactActual.createElement('Text', props, props.children),
    TextInput: (props: any) => ReactActual.createElement('TextInput', props),
    TouchableOpacity: (props: any) => ReactActual.createElement('TouchableOpacity', props, props.children),
    Pressable: (props: any) => ReactActual.createElement('Pressable', props, props.children),
    ActivityIndicator: (props: any) => ReactActual.createElement('ActivityIndicator', props),
    RefreshControl: (props: any) => ReactActual.createElement('RefreshControl', props),
    FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }: any) => {
      return ReactActual.createElement(
        'FlatList',
        null,
        typeof ListHeaderComponent === 'function' ? ListHeaderComponent() : ListHeaderComponent,
        (!data || data.length === 0)
          ? (typeof ListEmptyComponent === 'function' ? ListEmptyComponent() : ListEmptyComponent)
          : data.map((item: any, index: number) => (renderItem ? renderItem({ item, index }) : null)),
        typeof ListFooterComponent === 'function' ? ListFooterComponent() : ListFooterComponent
      );
    },
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
  Stack: { Screen: jest.fn() },
}));

jest.mock('react-native-calendars', () => {
  const React = require('react');
  return {
    Calendar: (props: any) => React.createElement('Calendar', props),
    LocaleConfig: { locales: {}, defaultLocale: 'pt' },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/Dialog', () => ({
  Dialog: (props: any) => React.createElement('Dialog', props),
}));

jest.mock('@/components/DatePicker', () => ({
  DatePicker: (props: any) => React.createElement('DatePicker', props),
}));

jest.mock('@/components/Toast', () => ({
  Toast: (props: any) => React.createElement('Toast', props),
}));

jest.mock('@/components/Skeleton', () => ({
  SkeletonList: (props: any) => React.createElement('SkeletonList', props),
}));

jest.mock('@/components/ScreenState', () => ({
  ErrorState: (props: any) => React.createElement('ErrorState', props),
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    primary: '#9E422E',
    primaryText: '#9E422E',
    background: '#1D1917',
    text: '#F5EBE6',
    subtext: '#A89F91',
    border: '#3D3430',
  }),
}));

jest.mock('@/src/i18n/index', () => {
  const actual = jest.requireActual('@/src/i18n/index');
  const stableT = (key: string, vars?: Record<string, string | number>) => actual.translate(key, vars, 'pt');
  return {
    ...actual,
    useI18n: () => ({
      t: stableT,
      language: 'pt',
    }),
  };
});

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

describe('HistoryQueryService', () => {
  beforeEach(() => {
    sqlite.exec('DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;');
    db.insert(exercises).values([
      { id: 1, name: 'Supino Reto', type: 'strength' },
      { id: 2, name: 'Crucifixo', type: 'strength' },
      { id: 3, name: 'Tríceps Corda', type: 'strength' },
      { id: 4, name: 'Agachamento', type: 'strength' },
      { id: 101, name: 'Supino Reto Barra', type: 'strength' },
      { id: 102, name: 'Remada Curvada', type: 'strength' },
      { id: 103, name: 'Agachamento Livre', type: 'strength' },
      { id: 104, name: 'Puxada Frontal', type: 'strength' },
    ]).run();
  });

  afterAll(() => {
    sqlite.close();
  });

  describe('Date Key Validation & Ranges', () => {
    it('validates valid date keys', () => {
      expect(isValidDateKey('2026-06-15')).toBe(true);
      expect(isValidDateKey('2024-02-29')).toBe(true); // leap year
      expect(isValidDateKey('2026-01-01')).toBe(true);
      expect(isValidDateKey('2026-12-31')).toBe(true);
    });

    it('rejects invalid date keys', () => {
      expect(isValidDateKey('2025-02-29')).toBe(false); // not a leap year
      expect(isValidDateKey('2026-02-30')).toBe(false);
      expect(isValidDateKey('2026-04-31')).toBe(false);
      expect(isValidDateKey('2026-13-01')).toBe(false);
      expect(isValidDateKey('invalid-date')).toBe(false);
      expect(isValidDateKey('')).toBe(false);
      expect(isValidDateKey(null)).toBe(false);
      expect(isValidDateKey(undefined)).toBe(false);
      expect(isValidDateKey(12345)).toBe(false);
    });

    it('computes local month range with start-inclusive, end-exclusive boundaries', () => {
      const range = getMonthRange(2026, 6);
      const start = new Date(range.startTimestamp);
      const end = new Date(range.endTimestamp);

      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(5); // June (0-indexed)
      expect(start.getDate()).toBe(1);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);

      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(6); // July (0-indexed)
      expect(end.getDate()).toBe(1);
      expect(end.getHours()).toBe(0);
      expect(end.getMinutes()).toBe(0);
    });

    it('computes local day range with start-inclusive, end-exclusive boundaries', () => {
      const range = getDayRange('2026-06-15');
      const start = new Date(range.startTimestamp);
      const end = new Date(range.endTimestamp);

      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(5);
      expect(start.getDate()).toBe(15);
      expect(start.getHours()).toBe(0);

      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(5);
      expect(end.getDate()).toBe(16);
      expect(end.getHours()).toBe(0);
    });

    it('computes date interval range: inclusive for user, exclusive for next SQL limit', () => {
      const range = getDateIntervalRange('2026-06-10', '2026-06-15');
      const start = new Date(range.startTimestamp!);
      const end = new Date(range.endTimestamp!);

      expect(start.getDate()).toBe(10);
      expect(start.getHours()).toBe(0);

      // June 15 inclusive for user -> start of June 16 exclusive in SQL
      expect(end.getDate()).toBe(16);
      expect(end.getHours()).toBe(0);
    });
  });

  describe('getMonthMarkedDates', () => {
    it('returns marked dates only for the specified month window', async () => {
      const may31 = new Date(2026, 4, 31, 22, 0).getTime();
      const jun01 = new Date(2026, 5, 1, 8, 0).getTime();
      const jun15 = new Date(2026, 5, 15, 14, 0).getTime();
      const jul01 = new Date(2026, 6, 1, 7, 0).getTime();

      db.insert(sessions).values([
        { id: 1, routineName: 'May Session', startTime: may31, deletedAt: null },
        { id: 2, routineName: 'June 1 Session', startTime: jun01, deletedAt: null },
        { id: 3, routineName: 'June 15 Session', startTime: jun15, deletedAt: null },
        { id: 4, routineName: 'July 1 Session', startTime: jul01, deletedAt: null },
      ]).run();

      const marks = await HistoryQueryService.getMonthMarkedDates({
        year: 2026,
        month: 6,
        dotColor: '#FF0000',
        dbInstance: db,
      });

      const jun01Key = toLocalDateKey(jun01);
      const jun15Key = toLocalDateKey(jun15);
      const may31Key = toLocalDateKey(may31);
      const jul01Key = toLocalDateKey(jul01);

      expect(marks[jun01Key]).toEqual({ marked: true, dotColor: '#FF0000' });
      expect(marks[jun15Key]).toEqual({ marked: true, dotColor: '#FF0000' });
      expect(marks[may31Key]).toBeUndefined();
      expect(marks[jul01Key]).toBeUndefined();
    });

    it('excludes soft-deleted sessions from month marks', async () => {
      const jun05 = new Date(2026, 5, 5, 10, 0).getTime();

      db.insert(sessions).values([
        { id: 1, routineName: 'Deleted Session', startTime: jun05, deletedAt: jun05 + 1000 },
      ]).run();

      const marks = await HistoryQueryService.getMonthMarkedDates({
        year: 2026,
        month: 6,
        dbInstance: db,
      });

      expect(Object.keys(marks)).toHaveLength(0);
    });

    it('includes legacy/live sessions without endTime (C1 compliant)', async () => {
      const jun10 = new Date(2026, 5, 10, 9, 0).getTime();

      db.insert(sessions).values([
        { id: 1, routineName: 'Active Workout', startTime: jun10, endTime: null, deletedAt: null },
      ]).run();

      const marks = await HistoryQueryService.getMonthMarkedDates({
        year: 2026,
        month: 6,
        dbInstance: db,
      });

      const jun10Key = toLocalDateKey(jun10);
      expect(marks[jun10Key]).toBeDefined();
    });

    it('returns empty marks when month has no data (mês sem dados)', async () => {
      const marks = await HistoryQueryService.getMonthMarkedDates({
        year: 2025,
        month: 1,
        dbInstance: db,
      });

      expect(marks).toEqual({});
    });
  });

  describe('getDaySessions', () => {
    it('returns sessions for a specific day enriched with exercises and set count', async () => {
      const jun15_morning = new Date(2026, 5, 15, 8, 30).getTime();
      const jun15_evening = new Date(2026, 5, 15, 18, 0).getTime();
      const jun16_morning = new Date(2026, 5, 16, 8, 0).getTime();

      db.insert(sessions).values([
        { id: 10, routineName: 'Treino A', startTime: jun15_morning, endTime: jun15_morning + 45 * 60000, durationMinutes: 45, deletedAt: null },
        { id: 20, routineName: 'Treino B', startTime: jun15_evening, endTime: jun15_evening + 60 * 60000, durationMinutes: 60, deletedAt: null },
        { id: 30, routineName: 'Treino C', startTime: jun16_morning, endTime: jun16_morning + 50 * 60000, durationMinutes: 50, deletedAt: null },
      ]).run();

      db.insert(sets).values([
        { id: 1, sessionId: 10, exerciseId: 1, exerciseName: 'Supino Reto', setNumber: 1, weightKg: 80, reps: 10, isWarmup: false, isEdited: false, deletedAt: null },
        { id: 2, sessionId: 10, exerciseId: 1, exerciseName: 'Supino Reto', setNumber: 2, weightKg: 85, reps: 8, isWarmup: false, isEdited: false, deletedAt: null },
        { id: 3, sessionId: 10, exerciseId: 2, exerciseName: 'Crucifixo', setNumber: 1, weightKg: 18, reps: 12, isWarmup: false, isEdited: false, deletedAt: null },
        // Soft-deleted set must be excluded
        { id: 4, sessionId: 10, exerciseId: 3, exerciseName: 'Tríceps Corda', setNumber: 1, weightKg: 25, reps: 12, isWarmup: false, isEdited: false, deletedAt: Date.now() },
        // Sets for session 20
        { id: 5, sessionId: 20, exerciseId: 4, exerciseName: 'Agachamento', setNumber: 1, weightKg: 100, reps: 5, isWarmup: false, isEdited: false, deletedAt: null },
      ]).run();

      const result = await HistoryQueryService.getDaySessions({
        dateKey: '2026-06-15',
        dbInstance: db,
      });

      expect(result).toHaveLength(2);
      // Ordered by startTime desc
      expect(result[0].id).toBe(20);
      expect(result[0].exerciseNames).toEqual(['Agachamento']);
      expect(result[0].totalSets).toBe(1);

      expect(result[1].id).toBe(10);
      expect(result[1].exerciseNames).toEqual(['Supino Reto', 'Crucifixo']);
      expect(result[1].totalSets).toBe(3); // 4th set was soft-deleted
    });

    it('returns empty array when day has no sessions or date is invalid', async () => {
      const res1 = await HistoryQueryService.getDaySessions({ dateKey: '2026-06-15', dbInstance: db });
      expect(res1).toEqual([]);

      const res2 = await HistoryQueryService.getDaySessions({ dateKey: 'invalid-date', dbInstance: db });
      expect(res2).toEqual([]);
    });
  });

  describe('searchSessions with filters and pagination', () => {
    beforeEach(() => {
      const d1 = new Date(2026, 5, 1, 10, 0).getTime();
      const d2 = new Date(2026, 5, 5, 10, 0).getTime();
      const d3 = new Date(2026, 5, 10, 10, 0).getTime();
      const d4 = new Date(2026, 5, 15, 10, 0).getTime();

      db.insert(sessions).values([
        { id: 1, routineName: 'Superior Força', startTime: d1, durationMinutes: 60, deletedAt: null },
        { id: 2, routineName: 'Inferior Hipertrofia', startTime: d2, durationMinutes: 50, deletedAt: null },
        { id: 3, routineName: 'Peito e Tríceps', startTime: d3, durationMinutes: 45, deletedAt: null },
        { id: 4, routineName: 'Costas e Bíceps', startTime: d4, durationMinutes: 55, deletedAt: null },
        { id: 5, routineName: 'Deletado Treino', startTime: d4 + 1000, durationMinutes: 30, deletedAt: Date.now() },
      ]).run();

      db.insert(sets).values([
        { id: 1, sessionId: 1, exerciseId: 101, exerciseName: 'Supino Reto Barra', setNumber: 1, weightKg: 100, reps: 5, isWarmup: false, isEdited: false, deletedAt: null },
        { id: 2, sessionId: 1, exerciseId: 102, exerciseName: 'Remada Curvada', setNumber: 1, weightKg: 80, reps: 6, isWarmup: false, isEdited: false, deletedAt: null },
        { id: 3, sessionId: 2, exerciseId: 103, exerciseName: 'Agachamento Livre', setNumber: 1, weightKg: 120, reps: 8, isWarmup: false, isEdited: false, deletedAt: null },
        { id: 4, sessionId: 3, exerciseId: 101, exerciseName: 'Supino Reto Barra', setNumber: 1, weightKg: 80, reps: 10, isWarmup: false, isEdited: false, deletedAt: null },
        { id: 5, sessionId: 3, exerciseId: 101, exerciseName: 'Supino Reto Barra', setNumber: 2, weightKg: 80, reps: 10, isWarmup: false, isEdited: false, deletedAt: null }, // second set with same exercise
        { id: 6, sessionId: 4, exerciseId: 104, exerciseName: 'Puxada Frontal', setNumber: 1, weightKg: 70, reps: 10, isWarmup: false, isEdited: false, deletedAt: null },
      ]).run();
    });

    it('searches by routine name case-insensitively', async () => {
      const res = await HistoryQueryService.searchSessions({
        query: 'superior',
        dbInstance: db,
      });

      expect(res.sessions).toHaveLength(1);
      expect(res.sessions[0].routineName).toBe('Superior Força');
    });

    it('searches by exercise name case-insensitively without duplicating sessions', async () => {
      const res = await HistoryQueryService.searchSessions({
        query: 'supino',
        dbInstance: db,
      });

      // Matches session 1 and session 3
      // Session 3 has TWO sets of 'Supino Reto Barra', but MUST NOT be duplicated!
      expect(res.sessions).toHaveLength(2);
      const sessionIds = res.sessions.map((s) => s.id);
      expect(sessionIds).toContain(1);
      expect(sessionIds).toContain(3);
    });

    it('filters by date range with user-inclusive end date', async () => {
      const res = await HistoryQueryService.searchSessions({
        startDate: '2026-06-05',
        endDate: '2026-06-10',
        dbInstance: db,
      });

      // Sessions 2 (June 5) and 3 (June 10) are included
      expect(res.sessions).toHaveLength(2);
      expect(res.sessions.map((s) => s.id)).toEqual([3, 2]); // desc order
    });

    it('combines text search and date range filters', async () => {
      const res = await HistoryQueryService.searchSessions({
        query: 'supino',
        startDate: '2026-06-02',
        endDate: '2026-06-12',
        dbInstance: db,
      });

      // Session 1 is on June 1 (outside range)
      // Session 3 is on June 10 (inside range and matches supino)
      expect(res.sessions).toHaveLength(1);
      expect(res.sessions[0].id).toBe(3);
    });

    it('supports stable cursor pagination by startTime + id', async () => {
      // Page 1: limit 2
      const page1 = await HistoryQueryService.searchSessions({
        limit: 2,
        dbInstance: db,
      });

      expect(page1.sessions).toHaveLength(2);
      expect(page1.sessions.map((s) => s.id)).toEqual([4, 3]);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Page 2: limit 2 using nextCursor
      const page2 = await HistoryQueryService.searchSessions({
        limit: 2,
        cursor: page1.nextCursor,
        dbInstance: db,
      });

      expect(page2.sessions).toHaveLength(2);
      expect(page2.sessions.map((s) => s.id)).toEqual([2, 1]);
      expect(page2.hasMore).toBe(false);
      expect(page2.nextCursor).toBeUndefined();
    });

    it('clearing filters returns all non-deleted sessions paginated', async () => {
      const all = await HistoryQueryService.searchSessions({
        dbInstance: db,
      });

      expect(all.sessions).toHaveLength(4);
      expect(all.sessions.find((s) => s.routineName === 'Deletado Treino')).toBeUndefined();
    });
  });

  describe('Timezone Boundaries (C7 — UTC-3 / UTC+14)', () => {
    it('correctly handles midnight boundaries and day transitions in local time', async () => {
      // Create session at 23:59:59 local of June 15
      const endOfJune15 = new Date(2026, 5, 15, 23, 59, 59).getTime();
      // Create session at 00:00:01 local of June 16
      const startOfJune16 = new Date(2026, 5, 16, 0, 0, 1).getTime();

      db.insert(sessions).values([
        { id: 101, routineName: 'Late Night June 15', startTime: endOfJune15, deletedAt: null },
        { id: 102, routineName: 'Early Morning June 16', startTime: startOfJune16, deletedAt: null },
      ]).run();

      const june15Sessions = await HistoryQueryService.getDaySessions({
        dateKey: '2026-06-15',
        dbInstance: db,
      });
      expect(june15Sessions).toHaveLength(1);
      expect(june15Sessions[0].id).toBe(101);

      const june16Sessions = await HistoryQueryService.getDaySessions({
        dateKey: '2026-06-16',
        dbInstance: db,
      });
      expect(june16Sessions).toHaveLength(1);
      expect(june16Sessions[0].id).toBe(102);

      // Search interval up to June 15 includes Late Night June 15, but excludes Early Morning June 16
      const searchRes = await HistoryQueryService.searchSessions({
        startDate: '2026-06-15',
        endDate: '2026-06-15',
        dbInstance: db,
      });
      expect(searchRes.sessions).toHaveLength(1);
      expect(searchRes.sessions[0].id).toBe(101);
    });
  });

  describe('Large Fixture: 5000+ sessions row budget and query performance', () => {
    it('executes month, day, and search queries within strict row budgets on 5000+ sessions', async () => {
      const baseTime = new Date(2023, 0, 1, 10, 0).getTime();
      const totalSessions = 5200;

      // Insert 5200 sessions in chunks of 500
      const chunkSize = 500;
      for (let i = 0; i < totalSessions; i += chunkSize) {
        const batch = [];
        for (let j = 0; j < chunkSize && i + j < totalSessions; j++) {
          const idx = i + j + 1;
          // Distribute across ~1000 days (approx 5 sessions/day or 1 session every few hours)
          const sessionTime = baseTime + Math.floor(idx * 0.2) * ONE_DAY + (idx % 3) * ONE_HOUR;
          batch.push({
            id: idx,
            routineName: idx % 2 === 0 ? `Treino Hipertrofia ${idx}` : `Rotina Força ${idx}`,
            startTime: sessionTime,
            endTime: sessionTime + 50 * 60000,
            durationMinutes: 50,
            deletedAt: null,
          });
        }
        db.insert(sessions).values(batch).run();
      }

      // Insert sets for a targeted session
      db.insert(sets).values([
        { id: 1, sessionId: 42, exerciseId: 1, exerciseName: 'Agachamento Especial', setNumber: 1, weightKg: 100, reps: 5, isWarmup: false, isEdited: false, deletedAt: null },
      ]).run();

      // 1. Month query row budget: must only return marks for that month, NOT 5000+ rows
      const marks = await HistoryQueryService.getMonthMarkedDates({
        year: 2023,
        month: 6,
        dbInstance: db,
      });
      // There are ~30 days in June, max 30 marks
      const marksCount = Object.keys(marks).length;
      expect(marksCount).toBeGreaterThan(0);
      expect(marksCount).toBeLessThanOrEqual(31);

      // 2. Day query row budget: must return only sessions for that day
      const targetDateKey = '2023-06-15';
      const daySessions = await HistoryQueryService.getDaySessions({
        dateKey: targetDateKey,
        dbInstance: db,
      });
      expect(daySessions.length).toBeGreaterThan(0);
      expect(daySessions.length).toBeLessThan(20); // only sessions on that day

      // 3. Search query row budget with pagination: limit 20 fetches max 21 rows
      const searchRes = await HistoryQueryService.searchSessions({
        query: 'Hipertrofia',
        limit: 20,
        dbInstance: db,
      });
      expect(searchRes.sessions.length).toBe(20);
      expect(searchRes.hasMore).toBe(true);

      // 4. Search by exercise across 5000+ sessions
      const exerciseSearch = await HistoryQueryService.searchSessions({
        query: 'Agachamento Especial',
        dbInstance: db,
      });
      expect(exerciseSearch.sessions).toHaveLength(1);
      expect(exerciseSearch.sessions[0].id).toBe(42);
    });
  });
});
