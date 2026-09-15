import React from 'react';
import ExerciseScreen from '@/app/session/exercise';
import { db, sqlite } from '../fixtures/database';
import { sessions, routines, exercises, routineExercises, sets } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

interface TestInstance {
  type: unknown;
  props: Record<string, any>;
  children: (TestInstance | string)[];
  find: (predicate: (node: TestInstance) => boolean) => TestInstance | undefined;
  findAll: (predicate: (node: TestInstance) => boolean) => TestInstance[];
}

interface TestRendererInstance {
  root: TestInstance;
  update: (element: React.ReactElement) => void;
  toJSON: () => any;
  unmount: () => void;
}

interface TestRendererApi {
  create: (element: React.ReactElement) => TestRendererInstance;
  act: (callback: () => void | Promise<void>) => Promise<void>;
}

const TestRenderer = jest.requireActual<TestRendererApi>('react-test-renderer');
const { act } = TestRenderer;

// Synthetic in-memory database
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

// Mock react-native primitives as host strings
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  Modal: 'Modal',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Keyboard: {
    dismiss: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: {
    OS: 'android',
    select: (values: Record<string, unknown>) => values.android ?? values.default,
  },
  useColorScheme: () => 'dark',
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// Mock Button
jest.mock('@/components/Button', () => ({
  Button: 'Button',
}));

// Mock safe-area
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock haptics & keep awake
jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: jest.fn() }),
}));
jest.mock('@/hooks/use-keep-awake-setting', () => ({
  useSessionKeepAwake: jest.fn(),
}));
jest.mock('@/hooks/use-progression', () => ({
  useProgression: () => ({ activeProgram: null, progressionStatus: null }),
}));
jest.mock('@/services/NotificationService', () => ({
  scheduleRestNotification: jest.fn(),
  cancelRestNotification: jest.fn(),
}));

// Mock live queries
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
  sessionId: '10',
  routineId: '1',
  exerciseId: '1',
  routineExerciseId: '101',
  exerciseName: 'Supino Reto',
  target: '3x10',
  notes: '',
  restSeconds: '90',
  startTime: '1000000',
};

jest.mock('expo-router', () => ({
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
}));

// Mock AsyncStorage
let mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, val: string) => {
    mockStorage[key] = val;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockStorage = {};
    return Promise.resolve();
  }),
}));

// Mock UI children components
jest.mock('@/components/session/ExerciseHeader', () => ({
  ExerciseHeader: (props: any) => React.createElement('ExerciseHeader', props),
}));
jest.mock('@/components/session/SetList', () => ({
  SetList: (props: any) => React.createElement('SetList', props),
}));
jest.mock('@/components/RestTimer', () => ({
  RestTimer: () => null,
}));
jest.mock('@/components/session/WarmupToggle', () => ({
  WarmupToggle: (props: any) => React.createElement('WarmupToggle', props),
}));
jest.mock('@/components/session/ExerciseHistoryModal', () => ({
  ExerciseHistoryModal: () => null,
}));
jest.mock('@/components/session/RirExplainerModal', () => ({
  RirExplainerModal: () => null,
}));
jest.mock('@/components/SetEditor', () => ({
  SetEditor: () => null,
}));
jest.mock('@/components/Toast', () => ({
  Toast: () => null,
}));
jest.mock('@react-native-community/slider', () => 'Slider');

describe('T06: Session Draft Recovery without Phantom Sets (Contract C3)', () => {
  let activeRenderer: TestRendererInstance | null = null;

  afterEach(async () => {
    if (activeRenderer) {
      await act(async () => {
        try {
          activeRenderer!.unmount();
        } catch {}
      });
      activeRenderer = null;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = {};

    sqlite.exec(`
      DELETE FROM personal_records;
      DELETE FROM sets;
      DELETE FROM routine_exercises;
      DELETE FROM routines;
      DELETE FROM sessions;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
    `);

    // Seed database
    db.insert(routines).values({ id: 1, name: 'Treino A' }).run();
    db.insert(exercises).values({ id: 1, name: 'Supino Reto', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(exercises).values({ id: 2, name: 'Remada Curvada', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(sessions).values({ id: 10, routineName: 'Treino A', startTime: 1000000 }).run();
    db.insert(routineExercises).values({
      id: 101,
      routineId: 1,
      exerciseId: 1,
      orderIndex: 0,
      target: '3x10',
      restSeconds: 90,
    }).run();
    db.insert(routineExercises).values({
      id: 102,
      routineId: 1,
      exerciseId: 2,
      orderIndex: 1,
      target: '3x10',
      restSeconds: 90,
    }).run();

    mockParams = {
      sessionId: '10',
      routineId: '1',
      exerciseId: '1',
      routineExerciseId: '101',
      exerciseName: 'Supino Reto',
      target: '3x10',
      notes: '',
      restSeconds: '90',
      startTime: '1000000',
    };
  });

  it('Scenario 1: Crash after insert before clear reconciles committed set without creating phantom set', async () => {
    // 1. A set was already inserted into SQLite with stable operationId
    const committedOpId = 'op-committed-crash-123';
    db.insert(sets).values({
      sessionId: 10,
      exerciseId: 1,
      routineExerciseId: 101,
      exerciseName: 'Supino Reto',
      setNumber: 1,
      weightKg: 80,
      reps: 10,
      operationId: committedOpId,
      createdAt: 1000010,
    }).run();

    const initialSetsCount = db.select().from(sets).where(eq(sets.sessionId, 10)).all().length;
    expect(initialSetsCount).toBe(1);

    // 2. Process crashed before AsyncStorage draft could be cleared
    // The draft in AsyncStorage still has isDirty: true and the same operationId
    mockStorage['incomplete_session'] = JSON.stringify({
      sessionId: 10,
      exerciseId: 1,
      routineExerciseId: 101,
      exerciseName: 'Supino Reto',
      routineId: 1,
      startTime: 1000000,
      exerciseType: 'strength',
      weight: '80',
      reps: '10',
      duration: '',
      rir: 2,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 0,
      isActiveSetRunning: false,
      activeSetStartedAt: null,
      operationId: committedOpId,
    });

    // 3. User reopens app, screen mounts
    let renderer: TestRendererInstance;
    await act(async () => {
      renderer = TestRenderer.create(<ExerciseScreen />);
      activeRenderer = renderer;
    });

    // Allow async loadSessionContext and DB check to finish
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Verify: Stale draft in storage was cleared/reconciled
    const storedContext = JSON.parse(mockStorage['incomplete_session'] ?? '{}');
    expect(storedContext.isDirty).toBe(false);

    // Verify: Decision dialog is closed because the set was already committed
    const modal = renderer!.root.findAll(n => n.props?.testID === 'recovery-decision-dialog');
    expect(modal.length).toBeGreaterThanOrEqual(1);
    expect(modal[0].props.visible).toBe(false);

    // 4. User touches "Próximo exercício"
    const nextBtn = renderer!.root.findAll(n =>
      n.type === 'Button' &&
      typeof n.props?.title === 'string' &&
      (n.props?.title.includes('nextExercise') || n.props?.title.includes('Próximo'))
    )[0];
    expect(nextBtn).toBeDefined();

    await act(async () => {
      await nextBtn.props.onPress();
    });

    // 5. Verification: Router navigated, and NO extra set was created in SQLite!
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/session/exercise',
        params: expect.objectContaining({
          exerciseId: 2,
          routineExerciseId: 102,
        }),
      }),
    );

    const setsAfterAdvance = db.select().from(sets).where(eq(sets.sessionId, 10)).all();
    expect(setsAfterAdvance.length).toBe(1);
  });

  it('Scenario 2: Repeated recovery and double-tap Next does not increase sets', async () => {
    // Committed set in DB
    db.insert(sets).values({
      sessionId: 10,
      exerciseId: 1,
      routineExerciseId: 101,
      exerciseName: 'Supino Reto',
      setNumber: 1,
      weightKg: 80,
      reps: 10,
      operationId: 'op-stable-repeat',
      createdAt: 1000010,
    }).run();

    mockStorage['incomplete_session'] = JSON.stringify({
      sessionId: 10,
      exerciseId: 1,
      routineExerciseId: 101,
      exerciseName: 'Supino Reto',
      routineId: 1,
      startTime: 1000000,
      exerciseType: 'strength',
      weight: '80',
      reps: '10',
      duration: '',
      rir: 2,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 0,
      isActiveSetRunning: false,
      activeSetStartedAt: null,
      operationId: 'op-stable-repeat',
    });

    let renderer: TestRendererInstance;
    await act(async () => {
      renderer = TestRenderer.create(<ExerciseScreen />);
      activeRenderer = renderer;
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    const nextBtn = renderer!.root.findAll(n =>
      n.type === 'Button' &&
      typeof n.props?.title === 'string' &&
      (n.props?.title.includes('nextExercise') || n.props?.title.includes('Próximo'))
    )[0];
    expect(nextBtn).toBeDefined();

    // Double tap Next
    await act(async () => {
      await Promise.all([
        nextBtn.props.onPress(),
        nextBtn.props.onPress(),
      ]);
    });

    const finalSets = db.select().from(sets).where(eq(sets.sessionId, 10)).all();
    expect(finalSets.length).toBe(1);
  });

  it('Scenario 3A: Real uncommitted draft prompts decision; Continue stays on screen without saving', async () => {
    // Draft exists in AsyncStorage with uncommitted operationId (not in DB)
    const uncommittedOpId = 'op-real-uncommitted-777';
    mockStorage['incomplete_session'] = JSON.stringify({
      sessionId: 10,
      exerciseId: 1,
      routineExerciseId: 101,
      exerciseName: 'Supino Reto',
      routineId: 1,
      startTime: 1000000,
      exerciseType: 'strength',
      weight: '90',
      reps: '8',
      duration: '',
      rir: 1,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 0,
      isActiveSetRunning: false,
      activeSetStartedAt: null,
      operationId: uncommittedOpId,
    });

    let renderer: TestRendererInstance;
    await act(async () => {
      renderer = TestRenderer.create(<ExerciseScreen />);
      activeRenderer = renderer;
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Verify: Draft was restored into screen and banner is shown
    const banner = renderer!.root.findAll(n => n.props?.testID === 'recovered-draft-banner');
    expect(banner.length).toBeGreaterThanOrEqual(1);

    // User taps "Próximo exercício"
    const nextBtn = renderer!.root.findAll(n =>
      n.type === 'Button' &&
      typeof n.props?.title === 'string' &&
      (n.props?.title.includes('nextExercise') || n.props?.title.includes('Próximo'))
    )[0];
    expect(nextBtn).toBeDefined();

    await act(async () => {
      await nextBtn.props.onPress();
    });

    // Verification: It did NOT silently save and did NOT navigate!
    expect(mockReplace).not.toHaveBeenCalled();
    const setsCount = db.select().from(sets).where(eq(sets.sessionId, 10)).all().length;
    expect(setsCount).toBe(0);

    // Decision dialog is open
    const modal = renderer!.root.findAll(n => n.props?.testID === 'recovery-decision-dialog');
    expect(modal.length).toBeGreaterThanOrEqual(1);
    expect(modal[0].props.visible).toBe(true);

    // User taps "Continuar"
    const continueBtnWrapper = renderer!.root.findAll(n => n.props?.testID === 'recovery-btn-continue')[0];
    const continueBtn = continueBtnWrapper?.findAll(n => n.type === 'Button')[0];
    expect(continueBtn).toBeDefined();

    await act(async () => {
      await continueBtn!.props.onPress();
    });

    // Verification: Dialog closed, still on screen, 0 sets in DB
    const modalAfter = renderer!.root.findAll(n => n.props?.testID === 'recovery-decision-dialog');
    expect(modalAfter.length).toBeGreaterThanOrEqual(1);
    expect(modalAfter[0].props.visible).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(db.select().from(sets).where(eq(sets.sessionId, 10)).all().length).toBe(0);
  });

  it('Scenario 3B: Real uncommitted draft prompts decision; Discard clears draft and advances with 0 sets', async () => {
    const uncommittedOpId = 'op-to-discard-999';
    mockStorage['incomplete_session'] = JSON.stringify({
      sessionId: 10,
      exerciseId: 1,
      routineExerciseId: 101,
      exerciseName: 'Supino Reto',
      routineId: 1,
      startTime: 1000000,
      exerciseType: 'strength',
      weight: '90',
      reps: '8',
      duration: '',
      rir: 1,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 0,
      isActiveSetRunning: false,
      activeSetStartedAt: null,
      operationId: uncommittedOpId,
    });

    let renderer: TestRendererInstance;
    await act(async () => {
      renderer = TestRenderer.create(<ExerciseScreen />);
      activeRenderer = renderer;
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Tap Next
    const nextBtn = renderer!.root.findAll(n =>
      n.type === 'Button' &&
      typeof n.props?.title === 'string' &&
      (n.props?.title.includes('nextExercise') || n.props?.title.includes('Próximo'))
    )[0];
    expect(nextBtn).toBeDefined();

    await act(async () => {
      await nextBtn.props.onPress();
    });

    // Tap Discard in dialog
    const discardBtnWrapper = renderer!.root.findAll(n => n.props?.testID === 'recovery-btn-discard')[0];
    const discardBtn = discardBtnWrapper?.findAll(n => n.type === 'Button')[0];
    expect(discardBtn).toBeDefined();

    await act(async () => {
      await discardBtn!.props.onPress();
    });

    // Verification: Navigated to next exercise, 0 sets in DB, draft cleared
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/session/exercise',
        params: expect.objectContaining({
          exerciseId: 2,
          routineExerciseId: 102,
        }),
      }),
    );
    expect(db.select().from(sets).where(eq(sets.sessionId, 10)).all().length).toBe(0);
  });

  it('Scenario 3C: Real uncommitted draft prompts decision; Save persists set and advances', async () => {
    const uncommittedOpId = 'op-to-save-444';
    mockStorage['incomplete_session'] = JSON.stringify({
      sessionId: 10,
      exerciseId: 1,
      routineExerciseId: 101,
      exerciseName: 'Supino Reto',
      routineId: 1,
      startTime: 1000000,
      exerciseType: 'strength',
      weight: '95',
      reps: '6',
      duration: '',
      rir: 0,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 0,
      isActiveSetRunning: false,
      activeSetStartedAt: null,
      operationId: uncommittedOpId,
    });

    let renderer: TestRendererInstance;
    await act(async () => {
      renderer = TestRenderer.create(<ExerciseScreen />);
      activeRenderer = renderer;
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Tap Next
    const nextBtn = renderer!.root.findAll(n =>
      n.type === 'Button' &&
      typeof n.props?.title === 'string' &&
      (n.props?.title.includes('nextExercise') || n.props?.title.includes('Próximo'))
    )[0];
    expect(nextBtn).toBeDefined();

    await act(async () => {
      await nextBtn.props.onPress();
    });

    // Tap Save in dialog
    const saveBtnWrapper = renderer!.root.findAll(n => n.props?.testID === 'recovery-btn-save')[0];
    const saveBtn = saveBtnWrapper?.findAll(n => n.type === 'Button')[0];
    expect(saveBtn).toBeDefined();

    await act(async () => {
      await saveBtn!.props.onPress();
    });

    // Verification: Exactly 1 set persisted with operationId, navigated
    const committedSets = db.select().from(sets).where(eq(sets.sessionId, 10)).all();
    expect(committedSets.length).toBe(1);
    expect(committedSets[0].operationId).toBe(uncommittedOpId);
    expect(committedSets[0].weightKg).toBe(95);
    expect(committedSets[0].reps).toBe(6);

    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/session/exercise',
        params: expect.objectContaining({
          exerciseId: 2,
          routineExerciseId: 102,
        }),
      }),
    );
  });

  it('Scenario 4: Ambiguous legacy draft without token requires explicit decision and does not silently save', async () => {
    // Legacy draft with isDirty: true, but NO operationId
    mockStorage['incomplete_session'] = JSON.stringify({
      sessionId: 10,
      exerciseId: 1,
      routineExerciseId: 101,
      exerciseName: 'Supino Reto',
      routineId: 1,
      startTime: 1000000,
      exerciseType: 'strength',
      weight: '80',
      reps: '10',
      duration: '',
      rir: 2,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 0,
      isActiveSetRunning: false,
      activeSetStartedAt: null,
      // No operationId
    });

    let renderer: TestRendererInstance;
    await act(async () => {
      renderer = TestRenderer.create(<ExerciseScreen />);
      activeRenderer = renderer;
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Tap Next
    const nextBtn = renderer!.root.findAll(n =>
      n.type === 'Button' &&
      typeof n.props?.title === 'string' &&
      (n.props?.title.includes('nextExercise') || n.props?.title.includes('Próximo'))
    )[0];
    expect(nextBtn).toBeDefined();

    await act(async () => {
      await nextBtn.props.onPress();
    });

    // Decision dialog must open, reason is ambiguous_legacy
    const modal = renderer!.root.findAll(n => n.props?.testID === 'recovery-decision-dialog');
    expect(modal.length).toBeGreaterThanOrEqual(1);

    // User can discard safely
    const discardBtnWrapper = renderer!.root.findAll(n => n.props?.testID === 'recovery-btn-discard')[0];
    const discardBtn = discardBtnWrapper?.findAll(n => n.type === 'Button')[0];
    expect(discardBtn).toBeDefined();

    await act(async () => {
      await discardBtn!.props.onPress();
    });

    expect(mockReplace).toHaveBeenCalled();
    expect(db.select().from(sets).where(eq(sets.sessionId, 10)).all().length).toBe(0);
  });

  it('Scenario 5: Intentional autosave in normal active session (not recovered) is preserved', async () => {
    // Normal fresh screen (no incomplete_session in storage)
    let renderer: TestRendererInstance;
    await act(async () => {
      renderer = TestRenderer.create(<ExerciseScreen />);
      activeRenderer = renderer;
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // User actively types reps and weight in session
    const textInputs = renderer!.root.findAll(n => n.type === 'TextInput');
    const weightInput = textInputs.find(n =>
      n.props?.accessibilityLabel?.includes('exercise.weight') ||
      n.props?.accessibilityLabel?.includes('Carga')
    );
    const repsInput = textInputs.find(n =>
      n.props?.accessibilityLabel?.includes('exercise.reps') ||
      n.props?.accessibilityLabel?.includes('Repetições')
    );
    expect(weightInput).toBeDefined();
    expect(repsInput).toBeDefined();

    await act(async () => {
      weightInput!.props.onChangeText('100');
      repsInput!.props.onChangeText('5');
    });

    // User taps Next Exercise
    const nextBtn = renderer!.root.findAll(n =>
      n.type === 'Button' &&
      typeof n.props?.title === 'string' &&
      (n.props?.title.includes('nextExercise') || n.props?.title.includes('Próximo'))
    )[0];
    expect(nextBtn).toBeDefined();

    await act(async () => {
      await nextBtn.props.onPress();
    });

    // Intentional autosave should have executed without showing recovery modal
    const savedSets = db.select().from(sets).where(eq(sets.sessionId, 10)).all();
    expect(savedSets.length).toBe(1);
    expect(savedSets[0].weightKg).toBe(100);
    expect(savedSets[0].reps).toBe(5);
    expect(savedSets[0].operationId).toBeTruthy();

    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/session/exercise',
      }),
    );
  });
});
