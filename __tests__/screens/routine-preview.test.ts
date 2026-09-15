import React from 'react';
import { sqlite } from '../fixtures/database';
import {
  formatDate,
  formatRest,
  calcEstimatedDuration,
  computeWeightHistory,
  computeBarHeights,
  countExercisesWithPRs,
  dedupeExercisesForPRs,
} from '@/src/utils/routine-preview-format';
import { estimateE1RM } from '@/services/AnalyticsService';
import { RoutinePreview } from '@/components/RoutinePreview';
import RoutinePreviewScreen from '@/app/routine/[routineId]';

interface TestInstance {
  type: unknown;
  props: Record<string, any>;
  children: (TestInstance | string)[];
  find: (predicate: (node: TestInstance) => boolean) => TestInstance;
  findAll: (predicate: (node: TestInstance) => boolean) => TestInstance[];
}

interface TestRendererInstance {
  root: TestInstance;
  update: (element: React.ReactElement) => void;
}

interface TestRendererApi {
  create: (element: React.ReactElement) => TestRendererInstance;
  act: (callback: () => void | Promise<void>) => Promise<void>;
}

const TestRenderer = jest.requireActual<TestRendererApi>('react-test-renderer');
const { act } = TestRenderer;

// Synthetic in-memory database mock
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

// Mock react-native host primitives
jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    View: (props: any) => ReactModule.createElement('View', props, props.children),
    Text: (props: any) => ReactModule.createElement('Text', props, props.children),
    TextInput: (props: any) => ReactModule.createElement('TextInput', props),
    TouchableOpacity: (props: any) => ReactModule.createElement('TouchableOpacity', props, props.children),
    Pressable: (props: any) => ReactModule.createElement('Pressable', props, props.children),
    Modal: (props: any) => (props.visible ? ReactModule.createElement('Modal', props, props.children) : null),
    ScrollView: (props: any) => ReactModule.createElement('ScrollView', props, props.children),
    KeyboardAvoidingView: (props: any) => ReactModule.createElement('KeyboardAvoidingView', props, props.children),
    Platform: {
      OS: 'android',
      select: (values: Record<string, unknown>) => values.android ?? values.default,
    },
  };
});

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, any> = {
  routineId: '1',
  routineName: 'Treino A',
};

jest.mock('expo-router', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
    }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback]);
    },
    Stack: {
      Screen: () => null,
    },
  };
});

// Mock i18n
jest.mock('@/src/i18n/index', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
    language: 'pt',
  }),
  getLocaleForLanguage: () => 'pt-BR',
}));

// Mock UI components as test inspectable elements
jest.mock('@/components/Button', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    Button: (props: any) => ReactModule.createElement('Button', props, props.title),
  };
});

jest.mock('@/components/Card', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    Card: (props: any) => ReactModule.createElement('Card', props, props.children),
  };
});

jest.mock('@/components/StatTile', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    StatTile: (props: any) => ReactModule.createElement('StatTile', props, props.children),
  };
});

jest.mock('@/components/SectionHeader', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    SectionHeader: (props: any) => ReactModule.createElement('SectionHeader', props, props.label),
  };
});

jest.mock('@/components/Toast', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    Toast: (props: any) => ReactModule.createElement('Toast', props),
  };
});

jest.mock('@/components/EmptyState', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    EmptyState: (props: any) => ReactModule.createElement('EmptyState', props, props.title),
  };
});

jest.mock('@/components/ScreenState', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    LoadingState: (props: any) => ReactModule.createElement('LoadingState', props),
    ErrorState: (props: any) => ReactModule.createElement('ErrorState', props),
  };
});

// Mock theme colors
jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    primaryText: '#3b82f6',
    border: '#e5e7eb',
  }),
}));

// Mock safe-area
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock SVG
jest.mock('react-native-svg', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: (props: any) => ReactModule.createElement('Svg', props, props.children),
    Polyline: (props: any) => ReactModule.createElement('Polyline', props),
  };
});

// Mock logger
jest.mock('@/services/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Helper to extract all text content from a test instance
function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(' ');
  if (node.children) return extractText(node.children);
  return '';
}

describe('Routine Preview — production linked tests', () => {

  // =========================================================================
  // Section 1: Pure formatting and calculation helpers (from src/utils/routine-preview-format.ts)
  // =========================================================================
  describe('Production Helpers (src/utils/routine-preview-format.ts)', () => {

    describe('formatDate', () => {
      it('returns "—" for null or undefined', () => {
        expect(formatDate(null)).toBe('—');
        expect(formatDate(undefined)).toBe('—');
      });

      it('formats a known epoch to pt-BR date', () => {
        const epoch = new Date(2025, 3, 26).getTime();
        const result = formatDate(epoch);
        expect(result).toMatch(/26\/04\/25/);
      });

      it('treats epoch 0 as falsy and returns dash', () => {
        expect(formatDate(0)).toBe('—');
      });

      it('pads single-digit day/month', () => {
        const epoch = new Date(2025, 0, 5).getTime();
        const result = formatDate(epoch);
        expect(result).toMatch(/05\/01\/25/);
      });

      it('respects provided locale parameter', () => {
        const epoch = new Date(2025, 3, 26).getTime();
        const result = formatDate(epoch, 'en-US');
        expect(result).toMatch(/04\/26\/25/);
      });
    });

    describe('formatRest', () => {
      it('returns empty string for null, undefined, 0, or negative', () => {
        expect(formatRest(null)).toBe('');
        expect(formatRest(undefined)).toBe('');
        expect(formatRest(0)).toBe('');
        expect(formatRest(-30)).toBe('');
      });

      it('formats seconds under 60 as "Xs"', () => {
        expect(formatRest(30)).toBe('30s');
        expect(formatRest(45)).toBe('45s');
        expect(formatRest(59)).toBe('59s');
      });

      it('formats exactly 60 seconds as "1m"', () => {
        expect(formatRest(60)).toBe('1m');
      });

      it('formats 90 seconds as "1m"', () => {
        expect(formatRest(90)).toBe('1m');
      });

      it('formats 120 seconds as "2m"', () => {
        expect(formatRest(120)).toBe('2m');
      });

      it('formats 180 seconds as "3m"', () => {
        expect(formatRest(180)).toBe('3m');
      });

      it('truncates remainder seconds', () => {
        expect(formatRest(150)).toBe('2m');
      });
    });

    describe('calcEstimatedDuration', () => {
      it('returns 0 minutes for 0 exercises', () => {
        expect(calcEstimatedDuration(0)).toBe(0);
        expect(calcEstimatedDuration(-1)).toBe(0);
      });

      it('returns minimum 15 minutes for 1 to 5 exercises', () => {
        expect(calcEstimatedDuration(1)).toBe(15);
        expect(calcEstimatedDuration(4)).toBe(15);
        expect(calcEstimatedDuration(5)).toBe(15);
      });

      it('calculates 18 minutes for 6 exercises', () => {
        expect(calcEstimatedDuration(6)).toBe(18);
      });

      it('calculates 30 minutes for 10 exercises', () => {
        expect(calcEstimatedDuration(10)).toBe(30);
      });

      it('calculates 36 minutes for 12 exercises', () => {
        expect(calcEstimatedDuration(12)).toBe(36);
      });
    });

    describe('computeWeightHistory', () => {
      it('returns empty array for empty input', () => {
        expect(computeWeightHistory([])).toEqual([]);
      });

      it('filters out null weightKg entries', () => {
        const input = [
          { startTime: 1714000000000, weightKg: 80 },
          { startTime: 1714086400000, weightKg: null },
          { startTime: 1714172800000, weightKg: 85 },
        ];
        const result = computeWeightHistory(input);
        expect(result).toHaveLength(2);
        expect(result[0].weight).toBe(85);
        expect(result[1].weight).toBe(80);
      });

      it('reverses the order (oldest first)', () => {
        const input = [
          { startTime: 1714172800000, weightKg: 90 },
          { startTime: 1714086400000, weightKg: 80 },
          { startTime: 1714000000000, weightKg: 70 },
        ];
        const result = computeWeightHistory(input);
        expect(result[0].weight).toBe(70);
        expect(result[2].weight).toBe(90);
      });

      it('formats dates as DD/MM pt-BR', () => {
        const input = [
          { startTime: new Date(2025, 3, 26).getTime(), weightKg: 100 },
        ];
        const result = computeWeightHistory(input);
        expect(result[0].date).toMatch(/26\/04/);
      });

      it('handles single entry', () => {
        const input = [
          { startTime: 1714000000000, weightKg: 75 },
        ];
        const result = computeWeightHistory(input);
        expect(result).toHaveLength(1);
        expect(result[0].weight).toBe(75);
      });

      it('returns empty when all weights are null', () => {
        const input = [
          { startTime: 1714000000000, weightKg: null },
          { startTime: 1714086400000, weightKg: null },
        ];
        expect(computeWeightHistory(input)).toEqual([]);
      });
    });

    describe('computeBarHeights', () => {
      it('returns empty array for empty history', () => {
        expect(computeBarHeights([])).toEqual([]);
      });

      it('returns minBarHeight for single data point', () => {
        const history = [{ date: '26/04', weight: 100 }];
        const result = computeBarHeights(history);
        expect(result).toEqual([20]);
      });

      it('returns uniform heights for uniform weights', () => {
        const history = [
          { date: '26/04', weight: 80 },
          { date: '27/04', weight: 80 },
          { date: '28/04', weight: 80 },
        ];
        const result = computeBarHeights(history);
        expect(result).toEqual([20, 20, 20]);
      });

      it('computes proportional heights for varying weights', () => {
        const history = [
          { date: '26/04', weight: 60 },
          { date: '27/04', weight: 80 },
          { date: '28/04', weight: 100 },
        ];
        const result = computeBarHeights(history);
        expect(result[0]).toBeCloseTo(20, 1);
        expect(result[1]).toBeCloseTo(40, 1);
        expect(result[2]).toBeCloseTo(60, 1);
      });

      it('all heights are within bounds', () => {
        const history = Array.from({ length: 20 }, (_, i) => ({
          date: `day${i}`,
          weight: 50 + Math.random() * 50,
        }));
        const result = computeBarHeights(history);
        result.forEach(h => {
          expect(h).toBeGreaterThanOrEqual(20);
          expect(h).toBeLessThanOrEqual(60);
        });
      });

      it('uses custom min/max bar heights', () => {
        const history = [
          { date: '01/01', weight: 50 },
          { date: '02/01', weight: 100 },
        ];
        const result = computeBarHeights(history, 10, 50);
        expect(result[0]).toBeCloseTo(10, 1);
        expect(result[1]).toBeCloseTo(50, 1);
      });
    });

    describe('countExercisesWithPRs and dedupeExercisesForPRs', () => {
      it('returns 0 for empty list', () => {
        expect(countExercisesWithPRs([])).toBe(0);
        expect(dedupeExercisesForPRs([])).toEqual([]);
      });

      it('returns 0 when no exercises have PRs', () => {
        const exercises = [
          { id: 1, prWeight: null },
          { id: 2, prWeight: null },
          { id: 3, prWeight: null },
        ];
        expect(countExercisesWithPRs(exercises)).toBe(0);
        expect(dedupeExercisesForPRs(exercises)).toEqual([]);
      });

      it('counts only exercises with non-null prWeight', () => {
        const exercises = [
          { id: 1, prWeight: 100 },
          { id: 2, prWeight: null },
          { id: 3, prWeight: 80.5 },
          { id: 4, prWeight: null },
          { id: 5, prWeight: 120 },
        ];
        expect(countExercisesWithPRs(exercises)).toBe(3);
      });

      it('counts exercise with prWeight=0 as having a PR', () => {
        const exercises = [
          { id: 1, prWeight: 0 },
          { id: 2, prWeight: null },
        ];
        expect(countExercisesWithPRs(exercises)).toBe(1);
      });

      it('dedupes repeated exercises in A/B/A routines', () => {
        // Exercise 1 appears twice (A/B/A), Exercise 2 appears once
        const exercises = [
          { id: 1, prWeight: 100, name: 'Supino Reto' },
          { id: 2, prWeight: 60, name: 'Desenvolvimento' },
          { id: 1, prWeight: 100, name: 'Supino Reto' },
        ];
        const deduped = dedupeExercisesForPRs(exercises);
        expect(deduped).toHaveLength(2);
        expect(deduped.map(e => e.id)).toEqual([1, 2]);
      });
    });
  });

  // =========================================================================
  // Section 2: Real estimateE1RM (from services/AnalyticsService.ts)
  // =========================================================================
  describe('estimateE1RM (services/AnalyticsService.ts)', () => {
    it('returns weight as-is for 1 rep', () => {
      expect(estimateE1RM(100, 1)).toBe(100);
    });

    it('calculates for 5 reps correctly', () => {
      expect(estimateE1RM(100, 5)).toBe(116.7);
    });

    it('calculates for 10 reps', () => {
      expect(estimateE1RM(80, 10)).toBe(106.7);
    });

    it('returns 0 for zero weight', () => {
      expect(estimateE1RM(0, 10)).toBe(0);
    });

    it('returns 0 for zero reps', () => {
      expect(estimateE1RM(100, 0)).toBe(0);
    });

    it('returns 0 for negative values', () => {
      expect(estimateE1RM(-50, 5)).toBe(0);
      expect(estimateE1RM(100, -3)).toBe(0);
    });

    it('returns 0 for reps > 12 (issue #91A cap honesty)', () => {
      expect(estimateE1RM(80, 13)).toBe(0);
      expect(estimateE1RM(80, 20)).toBe(0);
    });

    it('handles fractional weight', () => {
      expect(estimateE1RM(22.5, 8)).toBe(28.5);
    });
  });

  // =========================================================================
  // Section 3: Component rendering tests for components/RoutinePreview.tsx
  // =========================================================================
  describe('RoutinePreview component (components/RoutinePreview.tsx)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      sqlite.exec(`
        PRAGMA foreign_keys = OFF;
        DELETE FROM personal_records;
        DELETE FROM sets;
        DELETE FROM routine_exercises;
        DELETE FROM sessions;
        DELETE FROM routines;
        DELETE FROM exercises;
        DELETE FROM sqlite_sequence;
        PRAGMA foreign_keys = ON;
      `);

      // Seed A/B/A routine
      sqlite.exec(`
        INSERT INTO exercises (id, name, type, default_rest_seconds) VALUES (1, 'Supino Reto', 'strength', 90);
        INSERT INTO exercises (id, name, type, default_rest_seconds) VALUES (2, 'Desenvolvimento', 'strength', 60);
        INSERT INTO routines (id, name, description) VALUES (1, 'Treino A', 'Push day');
        INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target, rest_seconds, notes)
          VALUES (101, 1, 1, 1, '3x10', 90, 'Aquecer ombros');
        INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target, rest_seconds, notes)
          VALUES (102, 1, 2, 2, '3x10', 60, NULL);
        INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target, rest_seconds, notes)
          VALUES (103, 1, 1, 3, '3x10', 90, 'Drop set na última');
      `);
    });

    it('renders all occurrences in an A/B/A routine with sequence badges and occurrence identity', async () => {
      const mockClose = jest.fn();
      const mockStart = jest.fn();

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(
          React.createElement(RoutinePreview, {
            visible: true,
            routineId: 1,
            onClose: mockClose,
            onStart: mockStart,
            routineName: 'Treino A',
          })
        );
        // Flush async loadExercises
        await Promise.resolve();
        await Promise.resolve();
      });

      // Cards should be rendered for each occurrence
      const cards = renderer!.root.findAll((node) => node.type === 'Card');
      // Total cards: quick stats (2) + exercise cards (3)
      expect(cards.length).toBeGreaterThanOrEqual(5);

      // Verify sequence badges 1, 2, 3 and names are rendered
      const allText = extractText(renderer!.root);
      expect(allText).toContain('Supino Reto');
      expect(allText).toContain('Desenvolvimento');
      expect(allText).toContain('3x10');
      expect(allText).toMatch(/⏱️\s+1m/); // 60s
      expect(allText).toContain('Aquecer ombros');
      expect(allText).toContain('Drop set na última');

      // Verify estimated duration card shows ~15 min
      expect(allText).toMatch(/~\s*15/);

      // Verify start and close buttons
      const buttons = renderer!.root.findAll((node) => node.type === 'Button');
      const startBtn = buttons.find((b) => b.props.title === 'routines.startWorkout');
      const closeBtn = buttons.find((b) => b.props.title === 'common.close');

      expect(startBtn).toBeDefined();
      expect(closeBtn).toBeDefined();

      startBtn!.props.onPress();
      expect(mockStart).toHaveBeenCalledTimes(1);

      closeBtn!.props.onPress();
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('renders empty state when routine has no exercises', async () => {
      sqlite.exec('DELETE FROM sets; DELETE FROM routine_exercises;');
      const mockClose = jest.fn();

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(
          React.createElement(RoutinePreview, {
            visible: true,
            routineId: 1,
            onClose: mockClose,
            onStart: jest.fn(),
            routineName: 'Treino Vazio',
          })
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      const allText = extractText(renderer!.root);
      expect(allText).toContain('routines.noExercises');

      const addBtn = renderer!.root.findAll((node) => node.type === 'Button')
        .find((b) => b.props.title === 'routines.addExercisesFirst');
      expect(addBtn).toBeDefined();

      addBtn!.props.onPress();
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Section 4: Screen rendering tests for app/routine/[routineId].tsx
  // =========================================================================
  describe('RoutinePreviewScreen (app/routine/[routineId].tsx)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockParams = {
        routineId: '1',
        routineName: 'Treino A',
      };

      sqlite.exec(`
        PRAGMA foreign_keys = OFF;
        DELETE FROM personal_records;
        DELETE FROM sets;
        DELETE FROM routine_exercises;
        DELETE FROM sessions;
        DELETE FROM routines;
        DELETE FROM exercises;
        DELETE FROM sqlite_sequence;
        PRAGMA foreign_keys = ON;
      `);

      // Seed A/B/A routine with sessions and PR
      sqlite.exec(`
        INSERT INTO exercises (id, name, type, default_rest_seconds) VALUES (1, 'Supino Reto', 'strength', 90);
        INSERT INTO exercises (id, name, type, default_rest_seconds) VALUES (2, 'Desenvolvimento', 'strength', 60);
        INSERT INTO routines (id, name, description) VALUES (1, 'Treino A', 'Push day');
        INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target, rest_seconds, notes)
          VALUES (101, 1, 1, 1, '3x10', 90, 'Aquecer bem');
        INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target, rest_seconds, notes)
          VALUES (102, 1, 2, 2, '3x10', 60, NULL);
        INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target, rest_seconds, notes)
          VALUES (103, 1, 1, 3, '3x10', 90, 'Pesado');

        INSERT INTO personal_records (id, exercise_id, record_type, value, date)
          VALUES (1, 1, 'weight', 100.0, 1714000000000);

        INSERT INTO sessions (id, routine_id, routine_name, start_time, end_time, duration_minutes)
          VALUES (1, 1, 'Treino A', 1714000000000, 1714002700000, 45);

        INSERT INTO sets (id, session_id, exercise_id, routine_exercise_id, set_number, weight_kg, reps, is_warmup, created_at)
          VALUES (1, 1, 1, 101, 1, 80.0, 10, 0, 1714001000000);
        INSERT INTO sets (id, session_id, exercise_id, routine_exercise_id, set_number, weight_kg, reps, is_warmup, created_at)
          VALUES (2, 1, 2, 102, 1, 50.0, 8, 0, 1714002000000);
      `);
    });

    it('renders routine summary and exercises with A/B/A occurrence cards', async () => {
      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(RoutinePreviewScreen));
        await Promise.resolve();
        await Promise.resolve();
      });

      const allText = extractText(renderer!.root);

      // Verify header and summary card
      expect(allText).toContain('routineDetail.exerciseCount:{"count":3}');
      expect(allText).toContain('routineDetail.workoutCountSingle:{"count":1}');

      // Verify PR section dedupes repeated exercises (only 1 PR tile for Supino Reto)
      const statTiles = renderer!.root.findAll((node) => node.type === 'StatTile');
      const supinoPrTiles = statTiles.filter((st) => st.props.label === 'Supino Reto');
      expect(supinoPrTiles).toHaveLength(1);
      expect(supinoPrTiles[0].props.value).toBe('100kg');

      // Verify exercise cards
      const exerciseCards = renderer!.root.findAll(
        (node) => node.type === 'Card' && node.props.pressable === true
      );
      expect(exerciseCards).toHaveLength(3);

      // Exercise 1 at occurrence 101 has e1RM badge (80kg x 10 reps = 106.7kg)
      expect(allText).toContain('routineDetail.estimatedOneRepMax:{"weight":"106.7kg"}');
    });

    it('manages A/B/A independent expansion state without cross-occurrence bleeding', async () => {
      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(RoutinePreviewScreen));
        await Promise.resolve();
        await Promise.resolve();
      });

      const getOccurrenceCards = () =>
        renderer!.root.findAll((node) => node.type === 'Card' && node.props.pressable === true);

      // Card 0 is occurrence 101 (Supino Reto), Card 2 is occurrence 103 (Supino Reto)
      const initialCards = getOccurrenceCards();
      expect(initialCards[0].props.className).not.toContain('border-primary/40');
      expect(initialCards[2].props.className).not.toContain('border-primary/40');

      // Press first occurrence (101)
      await act(async () => {
        initialCards[0].props.onPress();
        await Promise.resolve();
      });

      const cardsAfterFirstPress = getOccurrenceCards();
      // Occurrence 101 is now expanded
      expect(cardsAfterFirstPress[0].props.className).toContain('border-primary/40');
      // Occurrence 103 remains COLLAPSED
      expect(cardsAfterFirstPress[2].props.className).not.toContain('border-primary/40');

      // Press first occurrence (101) again to collapse
      await act(async () => {
        cardsAfterFirstPress[0].props.onPress();
        await Promise.resolve();
      });

      const cardsAfterCollapse = getOccurrenceCards();
      expect(cardsAfterCollapse[0].props.className).not.toContain('border-primary/40');
      expect(cardsAfterCollapse[2].props.className).not.toContain('border-primary/40');

      // Press second occurrence (103)
      await act(async () => {
        cardsAfterCollapse[2].props.onPress();
        await Promise.resolve();
      });

      const cardsAfterSecondPress = getOccurrenceCards();
      // Occurrence 103 is now expanded
      expect(cardsAfterSecondPress[2].props.className).toContain('border-primary/40');
      // Occurrence 101 remains COLLAPSED
      expect(cardsAfterSecondPress[0].props.className).not.toContain('border-primary/40');
    });

    it('navigates to session screen on start workout press', async () => {
      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(RoutinePreviewScreen));
        await Promise.resolve();
        await Promise.resolve();
      });

      const buttons = renderer!.root.findAll((node) => node.type === 'Button');
      const startBtn = buttons.find((b) => b.props.title === 'routineDetail.startWorkout');
      expect(startBtn).toBeDefined();
      expect(startBtn!.props.disabled).toBe(false);

      startBtn!.props.onPress();
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/session/[routineId]',
          params: expect.objectContaining({
            routineId: '1',
            routineName: 'Treino A',
          }),
        })
      );
    });

    it('navigates to routine editor on edit button press', async () => {
      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(RoutinePreviewScreen));
        await Promise.resolve();
        await Promise.resolve();
      });

      const buttons = renderer!.root.findAll((node) => node.type === 'Button');
      const editBtn = buttons.find((b) => b.props.title === 'common.edit');
      expect(editBtn).toBeDefined();

      editBtn!.props.onPress();
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/routines/editor',
        params: { id: '1' },
      });
    });

    it('renders error state for invalid route params', async () => {
      mockParams = { routineId: 'invalid-id' };

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(RoutinePreviewScreen));
        await Promise.resolve();
      });

      const errorState = renderer!.root.findAll((node) => node.type === 'ErrorState');
      expect(errorState.length).toBeGreaterThanOrEqual(1);
      expect(errorState[0].props.title).toBe('routineDetail.invalidRoute');
    });

    it('renders not found state when routine does not exist', async () => {
      mockParams = { routineId: '999', routineName: 'Missing' };

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(RoutinePreviewScreen));
        await Promise.resolve();
        await Promise.resolve();
      });

      const errorState = renderer!.root.findAll((node) => node.type === 'ErrorState');
      expect(errorState.length).toBeGreaterThanOrEqual(1);
      expect(errorState[0].props.title).toBe('routineDetail.notFound');
    });

    it('renders empty state when routine has no exercises', async () => {
      sqlite.exec('DELETE FROM sets; DELETE FROM routine_exercises;');

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(RoutinePreviewScreen));
        await Promise.resolve();
        await Promise.resolve();
      });

      const emptyState = renderer!.root.findAll((node) => node.type === 'EmptyState');
      expect(emptyState.length).toBeGreaterThanOrEqual(1);
      expect(emptyState[0].props.title).toBe('routines.noExercises');
    });
  });
});
