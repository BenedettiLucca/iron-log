import React from 'react';
import ExerciseScreen from '@/app/session/exercise';

interface TestInstance {
  type: unknown;
  props: Record<string, unknown>;
  find: (predicate: (node: TestInstance) => boolean) => TestInstance;
  findAll: (predicate: (node: TestInstance) => boolean) => TestInstance[];
}

interface TestRendererInstance {
  root: TestInstance;
  update: (element: React.ReactElement) => void;
}

interface TestRendererApi {
  create: (element: React.ReactElement) => TestRendererInstance;
  act: (callback: () => void | Promise<void>) => void | Promise<void>;
}

const TestRenderer = jest.requireActual<TestRendererApi>('react-test-renderer');
const { act } = TestRenderer;

const mockReplace = jest.fn();
const mockSetToast = jest.fn();
const mockSaveSessionContext = jest.fn();
const mockLoadSessionContext = jest.fn();
const mockClearSessionContext = jest.fn();
const mockSetIsDirty = jest.fn();
const mockToggleActiveSet = jest.fn();
const mockRestoreDraft = jest.fn();
const mockSetWeight = jest.fn();
const mockHandleSaveSet = jest.fn();
const mockHandleUndo = jest.fn();
const mockHandleRestoreDeletedSet = jest.fn();
const mockHandleDeleteSet = jest.fn();
const mockHandleEditSet = jest.fn();
const mockHandleSaveEditedSet = jest.fn();
interface BeforeRemoveEvent {
  preventDefault: jest.Mock;
  data: { action: { type: string } };
}
let mockBeforeRemove: ((event: BeforeRemoveEvent) => void) | undefined;
const mockNavigation = {
  addListener: jest.fn((event: string, listener: (event: BeforeRemoveEvent) => void) => {
    if (event === 'beforeRemove') mockBeforeRemove = listener;
    return jest.fn();
  }),
  dispatch: jest.fn(),
};
let mockIsDirty = false;
let mockExerciseType = 'strength';
let mockActiveSetTime = 0;
let mockIsActiveSetRunning = false;
let mockExposeExistingSetActions = false;
let mockNextExercise: {
  id: number;
  name: string;
  target?: string;
  notes?: string;
  restSeconds: number | null;
  type: string;
} | null;

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Keyboard: {
    dismiss: jest.fn(),
  },
  Platform: {
    OS: 'android',
    select: (values: Record<string, unknown>) => values.android ?? values.default,
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useNavigation: () => mockNavigation,
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/src/validators/routes', () => ({
  exerciseParamsSchema: {},
  safeParseParams: () => ({
    sessionId: 42,
    routineId: 3,
    exerciseId: 7,
    exerciseName: 'Agachamento',
    target: '3x8',
    notes: '',
    restSeconds: 90,
    startTime: 123_456,
  }),
}));

jest.mock('@react-native-community/slider', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: jest.fn() }),
}));

jest.mock('@/hooks/use-session-persistence', () => ({
  useSessionPersistence: () => ({
    saveSessionContext: mockSaveSessionContext,
    loadSessionContext: mockLoadSessionContext,
    clearSessionContext: mockClearSessionContext,
  }),
}));

jest.mock('@/hooks', () => ({
  useProgression: () => ({ activeProgram: null, progressionStatus: null }),
  useExerciseSets: () => ({
    isDirty: mockIsDirty,
    setIsDirty: mockSetIsDirty,
    exerciseType: mockExerciseType,
    currentName: 'Agachamento',
    weight: '',
    setWeight: mockSetWeight,
    reps: '',
    setReps: jest.fn(),
    duration: '',
    rir: 2,
    setRir: jest.fn(),
    sessionSets: [],
    hasLoadedSessionSets: true,
    nextExercise: mockNextExercise,
    allExercises: [{ id: 7 }],
    isWarmupMode: false,
    setIsWarmupMode: jest.fn(),
    historyVisible: false,
    setHistoryVisible: jest.fn(),
    historyData: [],
    setTimerSeconds: jest.fn(),
    setTimerStatus: jest.fn(),
    addTime: jest.fn(),
    activeSetStart: null,
    activeSetTime: mockActiveSetTime,
    isActiveSetRunning: mockIsActiveSetRunning,
    toggleActiveSet: mockToggleActiveSet,
    lastSavedSet: mockExposeExistingSetActions ? { id: 1 } : null,
    handleUndo: mockHandleUndo,
    lastDeletedSet: mockExposeExistingSetActions ? { id: 2 } : null,
    handleRestoreDeletedSet: mockHandleRestoreDeletedSet,
    isSaving: false,
    toast: { visible: false, message: '', type: 'success' },
    setToast: mockSetToast,
    editingSet: mockExposeExistingSetActions ? { id: 1, setNumber: 1, weightKg: 80 } : null,
    setEditingSet: jest.fn(),
    showSetEditor: mockExposeExistingSetActions,
    setShowSetEditor: jest.fn(),
    completedExercisesCount: 0,
    handleSaveSet: mockHandleSaveSet,
    handleDeleteSet: mockHandleDeleteSet,
    handleEditSet: mockHandleEditSet,
    handleSaveEditedSet: mockHandleSaveEditedSet,
    restoreDraft: mockRestoreDraft,
    t: (key: string) => key,
    language: 'en',
  }),
}));

jest.mock('@/components/Button', () => ({
  Button: (props: Record<string, unknown>) =>
    React.createElement('MockButton', props),
}));

jest.mock('@/components/Toast', () => ({ Toast: () => null }));
jest.mock('@/components/SetEditor', () => ({
  SetEditor: (props: Record<string, unknown>) => props.visible
    ? React.createElement('MockButton', {
      title: 'test.saveEditedSet',
      onPress: () => (props.onSave as (...args: number[]) => unknown)(100, 8, 0, 2),
    })
    : null,
}));
jest.mock('@/components/session/ExerciseHeader', () => ({ ExerciseHeader: () => null }));
jest.mock('@/components/session/SetList', () => ({
  SetList: (props: Record<string, unknown>) => React.createElement(
    'View',
    null,
    React.createElement('MockButton', {
      title: 'test.editSet',
      onPress: () => (props.handleEditSet as (id: number) => unknown)(1),
    }),
    React.createElement('MockButton', {
      title: 'test.deleteSet',
      onPress: () => (props.handleDeleteSet as (id: number) => unknown)(1),
    }),
  ),
}));
jest.mock('@/components/RestTimer', () => ({ RestTimer: () => null }));
jest.mock('@/components/session/WarmupToggle', () => ({ WarmupToggle: () => null }));
jest.mock('@/components/session/ExerciseHistoryModal', () => ({ ExerciseHistoryModal: () => null }));
jest.mock('@/components/session/RirExplainerModal', () => ({ RirExplainerModal: () => null }));

const nextExercise = {
  id: 8,
  name: 'Supino',
  target: '3x8',
  notes: '',
  restSeconds: 90,
  type: 'strength',
};

async function renderScreen() {
  let renderer: TestRendererInstance;
  await act(async () => {
    renderer = TestRenderer.create(<ExerciseScreen />);
    await Promise.resolve();
  });
  return renderer!;
}

function findButton(root: TestInstance, title: string) {
  return root.find((node) => node.type === 'MockButton' && node.props.title === title);
}

function findTouchableByLabel(root: TestInstance, label: string) {
  return root.find(
    (node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === label,
  );
}

async function press(button: TestInstance) {
  const onPress = button.props.onPress as () => void;
  await act(async () => {
    onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function pressExistingSetActions(root: TestInstance) {
  await press(findTouchableByLabel(root, 'exercise.undoLastSet'));
  await press(findTouchableByLabel(root, 'exercise.undoDeletedSet'));
  await press(findButton(root, 'test.editSet'));
  await press(findButton(root, 'test.deleteSet'));
  await press(findButton(root, 'test.saveEditedSet'));
}

function expectExistingSetActionsBlocked() {
  expect(mockHandleUndo).not.toHaveBeenCalled();
  expect(mockHandleRestoreDeletedSet).not.toHaveBeenCalled();
  expect(mockHandleEditSet).not.toHaveBeenCalled();
  expect(mockHandleDeleteSet).not.toHaveBeenCalled();
  expect(mockHandleSaveEditedSet).not.toHaveBeenCalled();
}

function makeBackEvent(type = 'GO_BACK'): BeforeRemoveEvent {
  return {
    preventDefault: jest.fn(),
    data: { action: { type } },
  };
}

async function triggerBeforeRemove(event: BeforeRemoveEvent) {
  if (!mockBeforeRemove) {
    throw new Error(`beforeRemove listener missing; addListener calls: ${mockNavigation.addListener.mock.calls.length}`);
  }
  await act(async () => {
    mockBeforeRemove?.(event);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function updateScreen(screen: TestRendererInstance) {
  await act(async () => {
    screen.update(<ExerciseScreen />);
    await Promise.resolve();
  });
}

describe('ExerciseScreen persistence-gated navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBeforeRemove = undefined;
    mockIsDirty = false;
    mockExerciseType = 'strength';
    mockActiveSetTime = 0;
    mockIsActiveSetRunning = false;
    mockExposeExistingSetActions = false;
    mockNextExercise = nextExercise;
    mockLoadSessionContext.mockResolvedValue(null);
    mockHandleSaveSet.mockResolvedValue(true);
    mockHandleUndo.mockResolvedValue(undefined);
    mockHandleRestoreDeletedSet.mockResolvedValue(undefined);
    mockHandleDeleteSet.mockResolvedValue(undefined);
    mockHandleEditSet.mockResolvedValue(undefined);
    mockHandleSaveEditedSet.mockResolvedValue(true);
    mockSaveSessionContext.mockResolvedValue(undefined);
    mockClearSessionContext.mockResolvedValue(undefined);
  });

  it('allows a user Save Set operation and releases the mutation lock afterward', async () => {
    const screen = await renderScreen();

    await press(findButton(screen.root, 'exercise.saveBtn'));
    expect(mockHandleSaveSet).toHaveBeenCalledTimes(1);
    expect(mockSaveSessionContext).toHaveBeenCalledTimes(1);

    const weightInput = screen.root.findAll((node) => node.type === 'TextInput')[0];
    const onChangeText = weightInput.props.onChangeText as (value: string) => void;
    act(() => onChangeText('100'));
    expect(mockSetWeight).toHaveBeenCalledWith('100');
  });

  it('allows Next to own pending-set finalization without blocking itself', async () => {
    mockIsDirty = true;
    const screen = await renderScreen();

    await press(findButton(screen.root, 'exercise.nextExerciseLabel'));

    expect(mockHandleSaveSet).toHaveBeenCalledTimes(1);
    expect(mockSaveSessionContext).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/session/exercise',
    }));
  });

  it('stays on the current exercise after persistence failure and navigates on retry', async () => {
    mockSaveSessionContext.mockRejectedValueOnce(new Error('storage unavailable'));
    const screen = await renderScreen();
    const next = findButton(screen.root, 'exercise.nextExerciseLabel');

    await press(next);
    expect(mockSetToast).toHaveBeenCalledWith({
      visible: true,
      message: 'common.operationError',
      type: 'error',
    });
    expect(mockReplace).not.toHaveBeenCalled();

    await press(next);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/session/exercise',
    }));
  });

  it('stays on the current exercise when finish cleanup fails and navigates on retry', async () => {
    mockNextExercise = null;
    mockClearSessionContext.mockRejectedValueOnce(new Error('storage unavailable'));
    const screen = await renderScreen();
    const finish = findButton(screen.root, 'exercise.finishWorkoutLabel');

    await press(finish);
    expect(mockSetToast).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    await press(finish);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/session/finish',
      params: { sessionId: 42, startTime: '123456' },
    });
  });

  it('allows only one navigation persistence operation while a double tap is pending', async () => {
    let releaseSave: (() => void) | undefined;
    mockSaveSessionContext.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseSave = resolve;
    }));
    const screen = await renderScreen();
    const next = findButton(screen.root, 'exercise.nextExerciseLabel');
    const onPress = next.props.onPress as () => void;

    act(() => {
      onPress();
      onPress();
    });
    expect(mockSaveSessionContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseSave?.();
      await Promise.resolve();
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('blocks Back while Next persistence is in flight', async () => {
    let releaseSave: (() => void) | undefined;
    mockSaveSessionContext.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseSave = resolve;
    }));
    const screen = await renderScreen();
    const next = findButton(screen.root, 'exercise.nextExerciseLabel');
    const onPress = next.props.onPress as () => void;

    act(() => {
      void onPress();
    });
    const back = makeBackEvent();
    await triggerBeforeRemove(back);

    expect(back.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();

    await act(async () => {
      releaseSave?.();
      await Promise.resolve();
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('blocks Next while Back persistence is in flight', async () => {
    mockIsDirty = true;
    let releaseBackSave: (() => void) | undefined;
    mockSaveSessionContext.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseBackSave = resolve;
    }));
    const screen = await renderScreen();
    const back = makeBackEvent();

    await triggerBeforeRemove(back);
    mockIsDirty = false;
    await updateScreen(screen);
    const next = findButton(screen.root, 'exercise.nextExerciseLabel');
    await press(next);

    expect(back.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockSaveSessionContext).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => {
      releaseBackSave?.();
      await Promise.resolve();
    });
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(back.data.action);
  });

  it('allows existing-set mutations while the operation state is idle', async () => {
    mockExposeExistingSetActions = true;
    const screen = await renderScreen();

    await pressExistingSetActions(screen.root);

    expect(mockHandleUndo).toHaveBeenCalledTimes(1);
    expect(mockHandleRestoreDeletedSet).toHaveBeenCalledTimes(1);
    expect(mockHandleEditSet).toHaveBeenCalledWith(1);
    expect(mockHandleDeleteSet).toHaveBeenCalledWith(1);
    expect(mockHandleSaveEditedSet).toHaveBeenCalledWith(100, 8, 0, 2);
  });

  it('blocks Back and Next while an existing-set mutation owns the operation', async () => {
    mockExposeExistingSetActions = true;
    let releaseMutation: (() => void) | undefined;
    mockHandleDeleteSet.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseMutation = resolve;
    }));
    const screen = await renderScreen();
    const onDelete = findButton(screen.root, 'test.deleteSet').props.onPress as () => void;

    act(() => {
      void onDelete();
    });
    const back = makeBackEvent();
    await triggerBeforeRemove(back);
    await press(findButton(screen.root, 'exercise.nextExerciseLabel'));

    expect(back.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockSaveSessionContext).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => {
      releaseMutation?.();
      await Promise.resolve();
    });
  });

  it('blocks existing-set mutations while Back persistence is in flight', async () => {
    mockExposeExistingSetActions = true;
    mockIsDirty = true;
    let releaseBackSave: (() => void) | undefined;
    mockSaveSessionContext.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseBackSave = resolve;
    }));
    const screen = await renderScreen();

    await triggerBeforeRemove(makeBackEvent());
    await pressExistingSetActions(screen.root);
    expectExistingSetActionsBlocked();

    await act(async () => {
      releaseBackSave?.();
      await Promise.resolve();
    });
  });

  it('blocks existing-set mutations while Next persistence is in flight', async () => {
    mockExposeExistingSetActions = true;
    let releaseNextSave: (() => void) | undefined;
    mockSaveSessionContext.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseNextSave = resolve;
    }));
    const screen = await renderScreen();
    const onNext = findButton(screen.root, 'exercise.nextExerciseLabel').props.onPress as () => void;

    act(() => {
      void onNext();
    });
    await pressExistingSetActions(screen.root);
    expectExistingSetActionsBlocked();

    await act(async () => {
      releaseNextSave?.();
      await Promise.resolve();
    });
  });

  it('blocks field edits and Save Set while Back persistence is in flight', async () => {
    mockIsDirty = true;
    let releaseBackSave: (() => void) | undefined;
    mockSaveSessionContext.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseBackSave = resolve;
    }));
    const screen = await renderScreen();
    const back = makeBackEvent();

    await triggerBeforeRemove(back);
    const weightInput = screen.root.findAll((node) => node.type === 'TextInput')[0];
    const onChangeText = weightInput.props.onChangeText as (value: string) => void;
    act(() => onChangeText('100'));
    await press(findButton(screen.root, 'exercise.saveBtn'));

    expect(mockSetWeight).not.toHaveBeenCalled();
    expect(mockHandleSaveSet).not.toHaveBeenCalled();
    expect(mockSaveSessionContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseBackSave?.();
      await Promise.resolve();
    });
  });

  it('blocks field edits and Save Set while Next persistence is in flight', async () => {
    let releaseNextSave: (() => void) | undefined;
    mockSaveSessionContext.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseNextSave = resolve;
    }));
    const screen = await renderScreen();
    const next = findButton(screen.root, 'exercise.nextExerciseLabel');
    const onNext = next.props.onPress as () => void;

    act(() => {
      void onNext();
    });
    const weightInput = screen.root.findAll((node) => node.type === 'TextInput')[0];
    const onChangeText = weightInput.props.onChangeText as (value: string) => void;
    act(() => onChangeText('100'));
    await press(findButton(screen.root, 'exercise.saveBtn'));

    expect(mockSetWeight).not.toHaveBeenCalled();
    expect(mockHandleSaveSet).not.toHaveBeenCalled();
    expect(mockSaveSessionContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseNextSave?.();
      await Promise.resolve();
    });
  });

  it('blocks non-Back removal actions while Next persistence is in flight', async () => {
    let releaseNextSave: (() => void) | undefined;
    mockSaveSessionContext.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseNextSave = resolve;
    }));
    const screen = await renderScreen();
    const next = findButton(screen.root, 'exercise.nextExerciseLabel');
    const onNext = next.props.onPress as () => void;

    act(() => {
      void onNext();
    });
    const reset = makeBackEvent('RESET');
    await triggerBeforeRemove(reset);

    expect(reset.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();

    await act(async () => {
      releaseNextSave?.();
      await Promise.resolve();
    });
  });

  it('persists and replays RESET after an earlier Back persistence failure', async () => {
    mockIsDirty = true;
    mockSaveSessionContext
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);
    const screen = await renderScreen();

    const back = makeBackEvent();
    await triggerBeforeRemove(back);
    expect(back.preventDefault).toHaveBeenCalledTimes(1);

    mockIsDirty = false;
    await updateScreen(screen);
    const reset = makeBackEvent('RESET');
    await triggerBeforeRemove(reset);

    expect(reset.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockSaveSessionContext).toHaveBeenCalledTimes(2);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(reset.data.action);
  });

  it('keeps Back fail-closed after persistence rejects even if state becomes clean', async () => {
    mockIsDirty = true;
    mockSaveSessionContext.mockRejectedValueOnce(new Error('storage unavailable'));
    const screen = await renderScreen();
    const firstBack = makeBackEvent();

    await triggerBeforeRemove(firstBack);
    expect(firstBack.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();

    mockIsDirty = false;
    await updateScreen(screen);
    const retryBack = makeBackEvent();
    await triggerBeforeRemove(retryBack);

    expect(retryBack.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockSaveSessionContext).toHaveBeenCalledTimes(2);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(retryBack.data.action);
  });

  it('resets navigation bypass when Back dispatch throws and allows a safe retry', async () => {
    mockIsDirty = true;
    mockNavigation.dispatch.mockImplementationOnce(() => {
      throw new Error('dispatch failed');
    });
    await renderScreen();
    const firstBack = makeBackEvent();

    await triggerBeforeRemove(firstBack);
    expect(firstBack.preventDefault).toHaveBeenCalledTimes(1);

    const retryBack = makeBackEvent();
    await triggerBeforeRemove(retryBack);

    expect(retryBack.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockSaveSessionContext).toHaveBeenCalledTimes(2);
    expect(mockNavigation.dispatch).toHaveBeenCalledTimes(2);
  });

  it('marks a duration draft dirty before starting its timer', async () => {
    mockExerciseType = 'duration';
    const screen = await renderScreen();
    const durationControl = screen.root.find((node) =>
      node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'a11y.durationStart'
    );

    await press(durationControl);

    expect(mockSetIsDirty).toHaveBeenCalledWith(true);
    expect(mockToggleActiveSet).toHaveBeenCalledTimes(1);
  });

  it('hydrates a matching running draft with elapsed time and its start timestamp', async () => {
    mockLoadSessionContext.mockResolvedValue({
      sessionId: 42,
      routineId: 3,
      exerciseId: 7,
      exerciseName: 'Agachamento',
      target: '3x8',
      notes: '',
      restSeconds: 90,
      startTime: 123_456,
      currentName: 'Agachamento',
      exerciseType: 'duration',
      weight: '5',
      reps: '',
      duration: '',
      rir: 2,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 5,
      isActiveSetRunning: true,
      activeSetStartedAt: 123_000,
    });

    await renderScreen();

    expect(mockRestoreDraft).toHaveBeenCalledWith(expect.objectContaining({
      activeSetTime: 5,
      isActiveSetRunning: true,
      activeSetStartedAt: 123_000,
    }));
  });
});
