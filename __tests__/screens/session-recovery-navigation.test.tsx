import React from 'react';
interface TestInstance {
  type: unknown;
  props: Record<string, any>;
  children: Array<TestInstance | string>;
  find: (predicate: (node: TestInstance) => boolean) => TestInstance | undefined;
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
import SessionScreen from '@/app/session/[routineId]';
import { db, sqlite } from '../fixtures/database';
import { sessions, routines, exercises, routineExercises, sets, bodyMetrics } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

// Synthetic in-memory database
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

// Mock react-native host primitives for node test environment
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  Modal: 'Modal',
  FlatList: ({ data, renderItem, ListEmptyComponent }: any) => {
    const ReactModule = jest.requireActual<typeof import('react')>('react');
    if (!data || data.length === 0) {
      return ListEmptyComponent
        ? typeof ListEmptyComponent === 'function'
          ? ReactModule.createElement(ListEmptyComponent)
          : ListEmptyComponent
        : null;
    }
    return ReactModule.createElement(
      'FlatList',
      null,
      data.map((item: any, index: number) =>
        ReactModule.createElement(
          'View',
          { key: item.routineExerciseId ?? index },
          renderItem({ item, index })
        )
      )
    );
  },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Keyboard: {
    dismiss: jest.fn(),
  },
  Platform: {
    OS: 'android',
    select: (values: Record<string, unknown>) => values.android ?? values.default,
  },
}));

// Mock live queries to run synchronously against in-memory db
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: (query: any) => {
    try {
      const data = query.all ? query.all() : [];
      return { data, error: null, updatedAt: 1 };
    } catch {
      return { data: [], error: null, updatedAt: 1 };
    }
  },
}));

// Mock navigation & router
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
    useNavigation: () => ({
      addListener: jest.fn(() => jest.fn()),
      dispatch: jest.fn(),
    }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback]);
    },
    Stack: {
      Screen: (props: any) => {
        const left = props?.options?.headerLeft ? props.options.headerLeft() : null;
        const right = props?.options?.headerRight ? props.options.headerRight() : null;
        return ReactModule.createElement(ReactModule.Fragment, null, left, right);
      },
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
  }),
  getNestedValue: (_obj: any, key: string) => key,
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock UI components as test elements
jest.mock('@/components/Button', () => ({
  Button: (props: any) => React.createElement('Button', props),
}));

jest.mock('@/components/Card', () => ({
  Card: (props: any) => React.createElement('Card', props, props.children),
}));

jest.mock('@/components/Stopwatch', () => ({ Stopwatch: () => null }));
jest.mock('@/components/ProgressBar', () => ({ ProgressBar: () => null }));
jest.mock('@/components/Dialog', () => ({
  Dialog: (props: any) => React.createElement('Dialog', props),
}));
jest.mock('@/components/Toast', () => ({ Toast: () => null }));
jest.mock('@/components/SectionHeader', () => ({ SectionHeader: () => null }));
jest.mock('@/components/ScreenState', () => ({
  LoadingState: () => React.createElement('LoadingState', null),
  ErrorState: () => React.createElement('ErrorState', null),
}));

// Mock theme colors
jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    primaryText: '#3b82f6',
    darkBackground: '#111827',
    lightBackground: '#ffffff',
    text: '#111827',
    subtext: '#6b7280',
    border: '#e5e7eb',
    successText: '#10b981',
  }),
}));

// Mock logger
jest.mock('@/services/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock SVG
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: () => null,
  Line: () => null,
  Polyline: () => null,
  Path: () => null,
}));

// Mock Reanimated
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: (props: any) => React.createElement('AnimatedView', props, props.children),
  },
  FadeInLeft: {
    delay: () => ({
      springify: () => ({}),
    }),
  },
}));

describe('T04 — Session recovery navigation and parent reconstruction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM sessions; DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM exercises; DELETE FROM body_metrics; DELETE FROM sqlite_sequence;'
    );

    // Seed test routine and exercises (A/B/A pattern)
    sqlite.exec(`
      INSERT INTO exercises (id, name, default_rest_seconds) VALUES (1, 'Supino Reto', 90);
      INSERT INTO exercises (id, name, default_rest_seconds) VALUES (2, 'Desenvolvimento', 90);
      INSERT INTO routines (id, name, description) VALUES (1, 'Treino A', 'Push');
      INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target) VALUES (101, 1, 1, 1, '3x10');
      INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target) VALUES (102, 1, 2, 2, '3x10');
      INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, target) VALUES (103, 1, 1, 3, '3x10');
    `);

    mockParams = {
      routineId: '1',
      routineName: 'Treino A',
    };
  });

  describe('SessionScreen parent reconstruction (app/session/[routineId].tsx)', () => {
    it('does NOT insert a new session when reconstructing parent with an existing sessionId', async () => {
      // Create existing session
      const existingStartTime = 1700000000000;
      const [inserted] = await db.insert(sessions).values({
        routineId: 1,
        routineName: 'Treino A',
        startTime: existingStartTime,
        bodyWeight: 75.0,
        sRpe: 0,
      }).returning();

      // Parametrize route with existing sessionId
      mockParams = {
        routineId: '1',
        routineName: 'Treino A',
        sessionId: inserted.id.toString(),
        startTime: existingStartTime.toString(),
      };

      const initialCount = db.select().from(sessions).all().length;
      expect(initialCount).toBe(1);

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(<SessionScreen />);
        await Promise.resolve();
        await Promise.resolve();
      });

      const allSessions = db.select().from(sessions).all();
      // Invariant: zero new session inserts on recovery
      expect(allSessions.length).toBe(1);
      expect(allSessions[0].id).toBe(inserted.id);
      expect(allSessions[0].startTime).toBe(existingStartTime);

      // Body weight dialog should NOT be shown on recovery
      const modals = renderer!.root.findAll((node) => node.type === 'Modal');
      expect(modals.length).toBe(1);
      expect(modals[0].props.visible).toBe(false);
    });

    it('creates exactly one session when started normally without sessionId', async () => {
      mockParams = {
        routineId: '1',
        routineName: 'Treino A',
      };

      const initialCount = db.select().from(sessions).all().length;
      expect(initialCount).toBe(0);

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(<SessionScreen />);
        await Promise.resolve();
        await Promise.resolve();
      });

      const allSessions = db.select().from(sessions).all();
      // Exactly one session created
      expect(allSessions.length).toBe(1);
      expect(allSessions[0].routineId).toBe(1);
      expect(allSessions[0].routineName).toBe('Treino A');

      // Body weight dialog is shown on initial start
      const modals = renderer!.root.findAll((node) => node.type === 'Modal');
      expect(modals.length).toBe(1);
      expect(modals[0].props.visible).toBe(true);
    });

    it('parses initial body weight 72,5 into 72.5 using C2 localized decimal parser', async () => {
      mockParams = {
        routineId: '1',
        routineName: 'Treino A',
      };

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(<SessionScreen />);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Find the TextInput for body weight inside Modal
      const textInputs = renderer!.root.findAll((node) => node.type === 'TextInput');
      expect(textInputs.length).toBeGreaterThan(0);
      const weightInput = textInputs[0];
      expect(weightInput.props.keyboardType).toBe('decimal-pad');

      // Enter "72,5" (comma separator)
      await act(async () => {
        weightInput.props.onChangeText('72,5');
        await Promise.resolve();
      });

      // Find Save button
      const buttons = renderer!.root.findAll(
        (node) => node.type === 'Button' && node.props.title === 'session.bodyWeightSave'
      );
      expect(buttons.length).toBe(1);

      await act(async () => {
        buttons[0].props.onPress();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Check DB: weight must be 72.5, NOT 72
      const allSessions = db.select().from(sessions).all();
      expect(allSessions.length).toBe(1);
      expect(allSessions[0].bodyWeight).toBe(72.5);

      const metrics = db.select().from(bodyMetrics).all();
      expect(metrics.length).toBe(1);
      expect(metrics[0].weight).toBe(72.5);
    });

    it('rejects invalid body weight input (e.g. 72..5) without saving', async () => {
      mockParams = {
        routineId: '1',
        routineName: 'Treino A',
      };

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(<SessionScreen />);
        await Promise.resolve();
        await Promise.resolve();
      });

      const weightInput = renderer!.root.findAll((node) => node.type === 'TextInput')[0];
      await act(async () => {
        weightInput.props.onChangeText('72..5');
        await Promise.resolve();
      });

      const saveButton = renderer!.root.findAll(
        (node) => node.type === 'Button' && node.props.title === 'session.bodyWeightSave'
      )[0];

      await act(async () => {
        saveButton.props.onPress();
        await Promise.resolve();
      });

      // Error message should be rendered
      const texts = renderer!.root.findAll((node) => node.type === 'Text');
      const errorText = texts.find((node) =>
        node.children.includes('session.bodyWeightInvalid')
      );
      expect(errorText).toBeDefined();

      // No body metrics saved
      const metrics = db.select().from(bodyMetrics).all();
      expect(metrics.length).toBe(0);
    });

    it('preserves A/B/A occurrence sets independently during session', async () => {
      const existingStartTime = 1700000000000;
      const [inserted] = await db.insert(sessions).values({
        routineId: 1,
        routineName: 'Treino A',
        startTime: existingStartTime,
        sRpe: 0,
      }).returning();

      // Occurrence 1 (101): Supino Reto set 1
      await db.insert(sets).values({
        sessionId: inserted.id,
        exerciseId: 1,
        routineExerciseId: 101,
        setNumber: 1,
        weightKg: 80,
        reps: 10,
        isWarmup: false,
      });

      // Occurrence 2 (103): Supino Reto set 1
      await db.insert(sets).values({
        sessionId: inserted.id,
        exerciseId: 1,
        routineExerciseId: 103,
        setNumber: 1,
        weightKg: 90,
        reps: 8,
        isWarmup: false,
      });

      mockParams = {
        routineId: '1',
        routineName: 'Treino A',
        sessionId: inserted.id.toString(),
        startTime: existingStartTime.toString(),
      };

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(<SessionScreen />);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Session sets count remains 2 (zero new sets inserted)
      const allSets = db.select().from(sets).all();
      expect(allSets.length).toBe(2);

      // Verify that cards for both occurrences exist
      const cards = renderer!.root.findAll((node) => node.type === 'Card');
      expect(cards.length).toBe(3); // 101, 102, 103
    });

    it('navigates to /session/exercise with routineExerciseId when an exercise card is pressed', async () => {
      const existingStartTime = 1700000000000;
      const [inserted] = await db.insert(sessions).values({
        routineId: 1,
        routineName: 'Treino A',
        startTime: existingStartTime,
        sRpe: 0,
      }).returning();

      mockParams = {
        routineId: '1',
        routineName: 'Treino A',
        sessionId: inserted.id.toString(),
        startTime: existingStartTime.toString(),
      };

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(<SessionScreen />);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Find first exercise card (Supino Reto, occurrence 101)
      const cards = renderer!.root.findAll((node) => node.type === 'Card');
      expect(cards.length).toBeGreaterThan(0);

      await act(async () => {
        cards[0].props.onPress();
        await Promise.resolve();
      });

      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/session/exercise',
        params: expect.objectContaining({
          sessionId: inserted.id,
          routineId: '1',
          exerciseId: 1,
          routineExerciseId: 101,
          exerciseName: 'Supino Reto',
          startTime: existingStartTime.toString(),
        }),
      });
    });

    it('navigates to /session/finish on finish confirmation', async () => {
      const existingStartTime = 1700000000000;
      const [inserted] = await db.insert(sessions).values({
        routineId: 1,
        routineName: 'Treino A',
        startTime: existingStartTime,
        sRpe: 0,
      }).returning();

      mockParams = {
        routineId: '1',
        routineName: 'Treino A',
        sessionId: inserted.id.toString(),
        startTime: existingStartTime.toString(),
      };

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(<SessionScreen />);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Find end session button in header
      const endButton = renderer!.root.findAll(
        (node) => node.type === 'Button' && node.props.title === 'session.end'
      )[0];
      expect(endButton).toBeDefined();

      await act(async () => {
        endButton.props.onPress();
        await Promise.resolve();
      });

      // Find finish dialog and confirm
      const dialogs = renderer!.root.findAll((node) => node.type === 'Dialog');
      const finishDialog = dialogs.find((d) => d.props.title === 'session.finishTitle');
      expect(finishDialog).toBeDefined();
      expect(finishDialog!.props.visible).toBe(true);

      await act(async () => {
        finishDialog!.props.onConfirm();
        await Promise.resolve();
      });

      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/finish',
        params: {
          sessionId: inserted.id,
          startTime: existingStartTime,
        },
      });
    });

    it('soft-deletes empty session on exit and replaces to (tabs)', async () => {
      const existingStartTime = 1700000000000;
      const [inserted] = await db.insert(sessions).values({
        routineId: 1,
        routineName: 'Treino A',
        startTime: existingStartTime,
        sRpe: 0,
      }).returning();

      mockParams = {
        routineId: '1',
        routineName: 'Treino A',
        sessionId: inserted.id.toString(),
        startTime: existingStartTime.toString(),
      };

      let renderer: TestRendererInstance;
      await act(async () => {
        renderer = TestRenderer.create(<SessionScreen />);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Trigger exit dialog
      const exitButton = renderer!.root.findAll(
        (node) => node.type === 'Button' && node.props.accessibilityLabel === 'common.exit'
      )[0];
      expect(exitButton).toBeDefined();

      await act(async () => {
        exitButton.props.onPress();
        await Promise.resolve();
      });

      const dialogs = renderer!.root.findAll((node) => node.type === 'Dialog');
      const exitDialog = dialogs.find((d) => d.props.title === 'session.exitTitle');
      expect(exitDialog).toBeDefined();
      expect(exitDialog!.props.visible).toBe(true);

      await act(async () => {
        await exitDialog!.props.onConfirm();
        await Promise.resolve();
      });

      // Empty session (0 sets) should be soft-deleted
      const s = db.select().from(sessions).where(eq(sessions.id, inserted.id)).all();
      expect(s[0].deletedAt).not.toBeNull();
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  describe('Stack reconstruction contract for recovery dialog and home banner', () => {
    const root = path.resolve(__dirname, '../..');
    const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

    it('layout recovery pushes /session/[routineId] with sessionId before /session/exercise', () => {
      const layout = read('app/_layout.tsx');

      // Must reconstruct parent route
      expect(layout).toContain("pathname: '/session/[routineId]'");
      expect(layout).toContain('sessionId: recoverySession.sessionId.toString()');
      expect(layout).toContain('startTime: (recoverySession.startTime ?? Date.now()).toString()');

      // Then push exercise with occurrence identity
      expect(layout).toContain("pathname: '/session/exercise'");
      expect(layout).toContain('routineExerciseId: recoverySession.routineExerciseId');
    });

    it('home banner recovery pushes /session/[routineId] with sessionId before /session/exercise', () => {
      const home = read('app/(tabs)/index.tsx');

      // Must reconstruct parent route
      expect(home).toContain("pathname: '/session/[routineId]'");
      expect(home).toContain('sessionId: (incompleteSession.sessionId ?? incompleteSession.id).toString()');
      expect(home).toContain('startTime: (incompleteSession.startTime ?? Date.now()).toString()');

      // Then push exercise with occurrence identity, restSeconds, and startTime
      expect(home).toContain("pathname: '/session/exercise'");
      expect(home).toContain('routineExerciseId: incompleteSession.routineExerciseId');
      expect(home).toContain('restSeconds: incompleteSession.restSeconds?.toString()');
      expect(home).toContain('startTime: (incompleteSession.startTime ?? Date.now()).toString()');
    });
  });
});
