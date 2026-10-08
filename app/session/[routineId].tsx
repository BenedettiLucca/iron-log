import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useNavigation, useFocusEffect } from 'expo-router';
import { db } from '../../src/db/client';
import { sessions, routineExercises, exercises, sets, routines, bodyMetrics } from '../../src/db/schema';
import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { Stopwatch } from '../../components/Stopwatch';
import { Button } from '../../components/Button';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { ProgressBar } from '../../components/ProgressBar';
import { Dialog } from '../../components/Dialog';
import { Toast } from '../../components/Toast';
import { LoadingState, ErrorState } from '../../components/ScreenState';
import Animated, { FadeInLeft } from 'react-native-reanimated';
import { parseTargetSets, countCompletedRoutineExercises } from '../../src/utils/exercise';
import { logger } from '@/services/logger';
import { safeParseParams, sessionParamsSchema } from '@/src/validators/routes';
import { weightInputSchema } from '@/src/validators/forms';
import { parseLocalizedDecimal } from '../../src/utils/localized-decimal';
import { createNavigationGate, resolveCanonicalSessionRoutineName } from '../../src/utils/session-start';
import { useI18n } from '../../src/i18n/index';
import { buildWorkoutA11y } from '../../src/utils/workout-a11y';
import { resolveScreenState } from '../../src/utils/screen-state';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Colors } from '../../constants/colors';
import { useThemeColors } from '@/hooks/use-theme-colors';
import Svg, { Line, Polyline } from 'react-native-svg';
import { SessionOccurrenceService } from '@/services/SessionOccurrenceService';
import { FreestyleSessionService } from '@/services/FreestyleSessionService';
import { ExercisePickerModal } from '@/components/session/ExercisePickerModal';

type RoutineExerciseRow = {
  routineExerciseId: number | null;
  sessionExerciseId?: number;
  exerciseId: number;
  name: string;
  order: number | null;
  target: string | null;
  notes: string | null;
  restSeconds: number | null;
  supersetGroupId?: string | null;
};

export default function SessionScreen() {
  const { t } = useI18n();
  const a11y = buildWorkoutA11y({
    endSession: t('a11y.endSession'),
    undoLastSetLabel: t('exercise.undoLastSet'),
    undoLastSetHint: t('a11y.undoLastSetHint'),
    durationStart: t('a11y.durationStart'),
    durationStop: t('a11y.durationStop'),
    running: t('a11y.running'),
    history: t('a11y.openHistory'),
  });
  const rawParams = useLocalSearchParams();
  const validated = safeParseParams(sessionParamsSchema, rawParams, 'SessionScreen');
  const routineId = validated?.routineId ?? '';
  const routineName = validated?.routineName ?? '';
  const rawSessionId = Array.isArray(rawParams.sessionId) ? rawParams.sessionId[0] : rawParams.sessionId;
  const initialSessionId = rawSessionId !== undefined && rawSessionId !== null && rawSessionId !== '' && !Number.isNaN(Number(rawSessionId))
    ? Number(rawSessionId)
    : null;
  const rawStartTime = Array.isArray(rawParams.startTime) ? rawParams.startTime[0] : rawParams.startTime;
  const initialStartTime = rawStartTime !== undefined && rawStartTime !== null && rawStartTime !== '' && !Number.isNaN(Number(rawStartTime))
    ? Number(rawStartTime)
    : null;
  const router = useRouter();
  const navigation = useNavigation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [routineExs, setRoutineExs] = useState<RoutineExerciseRow[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ type: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exitToast, setExitToast] = useState({ visible: false, message: '' });
  const [sessionToast, setSessionToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [exerciseToRemove, setExerciseToRemove] = useState<RoutineExerciseRow | null>(null);
  const [sessionRoutineName, setSessionRoutineName] = useState(routineName);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showBodyWeightDialog, setShowBodyWeightDialog] = useState(false);
  const [bodyWeightInput, setBodyWeightInput] = useState('');
  const [bodyWeightError, setBodyWeightError] = useState('');
  const lastBackPressTime = useRef<number>(0);
  const exerciseNavigationGateRef = useRef(createNavigationGate());
  const isInitializingRef = useRef(false);

  const rIdStr = Array.isArray(routineId) ? routineId[0] : routineId;
  const isFreestyle = rIdStr === 'freestyle' || !Number.isInteger(Number(rIdStr));

  const loadExercises = useCallback(async (sid?: number | null) => {
    const currentSessionId = sid ?? sessionId;
    if (!currentSessionId) return;
    try {
      const queue = await SessionOccurrenceService.getPendingQueue(currentSessionId);
      if (queue.length === 0) {
        setRoutineExs([]);
        return;
      }

      const exIds = Array.from(new Set(queue.map((q) => q.exerciseId)));
      const reIds = queue
        .map((q) => q.routineExerciseId)
        .filter((id): id is number => id !== null);

      const exRows = await db
        .select({
          exerciseId: exercises.id,
          name: exercises.name,
          defaultRestSeconds: exercises.defaultRestSeconds,
        })
        .from(exercises)
        .where(inArray(exercises.id, exIds));

      const reRows = reIds.length > 0
        ? await db
            .select({
              routineExerciseId: routineExercises.id,
              target: routineExercises.target,
              notes: routineExercises.notes,
              restSeconds: routineExercises.restSeconds,
            })
            .from(routineExercises)
            .where(inArray(routineExercises.id, reIds))
        : [];

      const exMap = new Map(exRows.map((e) => [e.exerciseId, e]));
      const reMap = new Map(reRows.map((r) => [r.routineExerciseId, r]));

      const mapped: RoutineExerciseRow[] = queue.map((q) => {
        const ex = exMap.get(q.exerciseId);
        const re = q.routineExerciseId ? reMap.get(q.routineExerciseId) : null;
        return {
          routineExerciseId: q.routineExerciseId ?? q.sessionExerciseId ?? q.id ?? 0,
          sessionExerciseId: q.sessionExerciseId ?? q.id,
          exerciseId: q.exerciseId,
          name: ex?.name ?? '',
          order: q.position,
          target: re?.target ?? null,
          notes: re?.notes ?? null,
          restSeconds: re?.restSeconds ?? ex?.defaultRestSeconds ?? null,
          supersetGroupId: q.supersetGroupId ?? null,
        };
      });

      setRoutineExs(mapped);
    } catch (e) {
      logger.error('Erro ao carregar exercícios da sessão', e);
    }
  }, [sessionId]);

  // Force refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      exerciseNavigationGateRef.current.reset();
      setRefreshKey(prev => prev + 1);
      if (sessionId) {
        loadExercises(sessionId);
      }
      return () => {};
    }, [sessionId, loadExercises])
  );

  // Smart exit protection with toast + double-press
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (e.data.action.type !== 'GO_BACK' && e.data.action.type !== 'POP') {
        return;
      }

      e.preventDefault();

      const now = Date.now();
      const timeSinceLastPress = now - lastBackPressTime.current;

      if (timeSinceLastPress < 2000) {
        // Second press within 2 seconds - show confirmation dialog
        setPendingNavigation(e.data.action);
        setShowExitDialog(true);
        setExitToast({ visible: false, message: '' });
      } else {
        // First press - show toast
        lastBackPressTime.current = now;
        setExitToast({ visible: true, message: t('session.pressAgain') });

        // Hide toast after 2 seconds
        setTimeout(() => {
          setExitToast({ visible: false, message: '' });
        }, 2000);
      }
    });

    return unsubscribe;
  }, [navigation, t]);

  const initSession = useCallback(async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    try {
      setIsLoading(true);
      setHasError(false);

      if (initialSessionId) {
        const existingSessions = await db.select()
          .from(sessions)
          .where(and(eq(sessions.id, initialSessionId), isNull(sessions.deletedAt)))
          .limit(1);

        if (existingSessions.length === 0 || existingSessions[0].endTime !== null) {
          throw new Error(`Session ${initialSessionId} not found or already finished`);
        }

        const existing = existingSessions[0];
        setSessionId(existing.id);
        setStartTime(existing.startTime);
        setSessionRoutineName(existing.routineName || (routineName as string) || (isFreestyle ? t('session.freestyle') : ''));
        if (existing.bodyWeight !== null && existing.bodyWeight !== undefined) {
          setBodyWeightInput(existing.bodyWeight.toString());
        }
        await loadExercises(existing.id);
        return;
      }

      const now = initialStartTime ?? Date.now();
      setStartTime(now);

      if (isFreestyle) {
        const name = (routineName as string) || t('session.freestyle');
        setSessionRoutineName(name);

        const freestyleResult = await FreestyleSessionService.startFreestyle({
          startTime: now,
          routineName: name,
        });

        setSessionId(freestyleResult.id);
        await loadExercises(freestyleResult.id);

        const lastMetrics = await db.select({ weight: bodyMetrics.weight, date: bodyMetrics.date })
          .from(bodyMetrics)
          .where(eq(bodyMetrics.type, 'daily'))
          .orderBy(desc(bodyMetrics.date))
          .limit(1);

        const lastWeight = lastMetrics.length > 0 && lastMetrics[0].weight
          ? lastMetrics[0].weight.toString()
          : '';

        setBodyWeightInput(lastWeight);
        setShowBodyWeightDialog(true);
        return;
      }

      const routeRoutineName = routineName as string;
      const fetchedRoutine = await db.select({ name: routines.name })
        .from(routines)
        .where(eq(routines.id, Number(rIdStr)))
        .limit(1);
      const resolvedRoutineName = resolveCanonicalSessionRoutineName(fetchedRoutine?.[0]?.name ?? null, routeRoutineName);

      if (!resolvedRoutineName) {
        throw new Error(`Cannot start session without routineName for routine ${rIdStr}`);
      }

      setSessionRoutineName(resolvedRoutineName);
      const result = await db.insert(sessions).values({
        routineId: Number(rIdStr),
        routineName: resolvedRoutineName,
        startTime: now,
        bodyWeight: null,
        sRpe: 0,
      }).returning();

      setSessionId(result[0].id);
      await loadExercises(result[0].id);

      // Fetch last known weight and show body weight dialog
      const lastMetrics = await db.select({ weight: bodyMetrics.weight, date: bodyMetrics.date })
        .from(bodyMetrics)
        .where(eq(bodyMetrics.type, 'daily'))
        .orderBy(desc(bodyMetrics.date))
        .limit(1);

      const lastWeight = lastMetrics.length > 0 && lastMetrics[0].weight
        ? lastMetrics[0].weight.toString()
        : '';

      setBodyWeightInput(lastWeight);
      setShowBodyWeightDialog(true);
    } catch (e) {
      logger.error('Erro ao iniciar sessão', e);
      setHasError(true);
      setErrorMessage(t('states.errorBody'));
    } finally {
      setIsLoading(false);
      isInitializingRef.current = false;
    }
  }, [rIdStr, isFreestyle, loadExercises, routineName, initialSessionId, initialStartTime, t]);

  const handleAddExercise = useCallback(async (selectedExerciseId: number) => {
    if (!sessionId) return;
    try {
      if (!isFreestyle) {
        await SessionOccurrenceService.dissolveIfSingle(sessionId);
      }
      await FreestyleSessionService.addExerciseWithPrefill(sessionId, selectedExerciseId);
      await loadExercises(sessionId);
      setSessionToast({ visible: true, message: t('session.exerciseAdded'), type: 'success' });
    } catch (e) {
      logger.error('Failed to add exercise to session', e);
    } finally {
      setShowAddModal(false);
    }
  }, [sessionId, isFreestyle, loadExercises, t]);

  const handleConfirmRemove = useCallback(async () => {
    if (!exerciseToRemove || !sessionId) return;
    try {
      await SessionOccurrenceService.removeSessionExercise({
        sessionId,
        routineExerciseId: exerciseToRemove.routineExerciseId,
        sessionExerciseId: exerciseToRemove.sessionExerciseId,
        exerciseId: exerciseToRemove.exerciseId,
      });
      await loadExercises(sessionId);
      setSessionToast({ visible: true, message: t('session.exerciseRemoved'), type: 'success' });
    } catch (e) {
      logger.error('Failed to remove exercise from session', e);
    } finally {
      setExerciseToRemove(null);
    }
  }, [exerciseToRemove, sessionId, loadExercises, t]);

  useEffect(() => {
    if (rIdStr && !sessionId && !hasError) {
        initSession();
    }
  }, [rIdStr, sessionId, hasError, initSession]);

  const dismissBodyWeightDialog = useCallback(async (save = false) => {
    setShowBodyWeightDialog(false);
    setBodyWeightError('');
    if (!save || !sessionId) return;
    const decimalResult = parseLocalizedDecimal(bodyWeightInput, { allowNegative: false });
    if (decimalResult.status === 'valid') {
      const parsedWeight = weightInputSchema.safeParse({ weight: decimalResult.value });
      if (parsedWeight.success) {
        const weight = parsedWeight.data.weight;
        await db.update(sessions)
          .set({ bodyWeight: weight })
          .where(eq(sessions.id, sessionId));
        await db.insert(bodyMetrics).values({
          date: Date.now(),
          type: 'daily',
          weight,
        });
      }
    }
  }, [bodyWeightInput, sessionId]);

  const finishSession = () => {
    if (!sessionId) return;
    setShowFinishDialog(true);
  };

  const confirmFinish = () => {
    setShowFinishDialog(false);
    router.replace({
      pathname: '/session/finish',
      params: { sessionId, startTime }
    });
  };

  const { status } = resolveScreenState({
    isLoading: isLoading && !sessionId,
    hasError,
    hasContent: !!sessionId,
    errorMessage
  });

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return (
      <View className="flex-1 bg-background p-4 justify-center">
        <ErrorState message={errorMessage} onRetry={initSession} />
        <Button
          title={t('common.back')}
          onPress={() => router.back()}
          variant="ghost"
          className="mt-4"
        />
      </View>
    );
  }

  // At this point status is 'content' (hasContent: !!sessionId) or 'empty' (which shouldn't happen here)
  if (!sessionId) return null;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{
        headerTitle: () => <Stopwatch startTime={startTime} className="text-onPrimary" />,
        headerLeft: () => (
          <Button
            title=""
            onPress={() => {
              setShowExitDialog(true);
            }}
            variant="ghost"
            icon={
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={Colors.onPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <Line x1="18" y1="6" x2="6" y2="18" />
                <Line x1="6" y1="6" x2="18" y2="18" />
              </Svg>
            }
            accessibilityLabel={t('common.exit')}
          />
        ),
        headerRight: () => (
          <Button
            title={t('session.end')}
            onPress={finishSession}
            variant="primary"
            size="sm"
            style={{ borderRadius: 8 }}
            accessibilityLabel={a11y.endSession.accessibilityLabel}
          />
        ),
        }} />

      <View className="p-4 bg-card border-b border-border shadow-sm mb-2 z-10">
        <SectionHeader label={t('session.activeWorkout')} className="mb-1 pl-0" />
        <Text className="text-text text-xl font-extrabold mb-3 tracking-tight" numberOfLines={2}>{sessionRoutineName}</Text>

        <SessionProgress key={`progress-${sessionId}-${refreshKey}`} sessionId={sessionId} routineExs={routineExs} />
      </View>

      <FlatList
        key={`list-${refreshKey}`}
        data={routineExs}
        keyExtractor={(item) => String(item.routineExerciseId)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListFooterComponent={
          routineExs.length > 0 ? (
            <View className="pt-2 pb-6">
              <Button
                title={`+ ${t('session.addExercise')}`}
                onPress={() => setShowAddModal(true)}
                variant="secondary"
                size="md"
                accessibilityLabel={t('session.addExercise')}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center py-12 px-8">
            <Text className="text-5xl mb-4">📋</Text>
            <Text className="text-text text-lg font-bold text-center mb-2">
              {isFreestyle ? t('session.noExercisesInSession') : t('routines.noExercises')}
            </Text>
            <Text className="text-subtext text-sm text-center mb-6">
              {isFreestyle ? t('session.addExercisesToStart') : t('routines.addExercisesHint')}
            </Text>
            <View className="gap-3 w-full max-w-xs">
              <Button
                title={`+ ${t('session.addExercise')}`}
                onPress={() => setShowAddModal(true)}
                variant="primary"
                size="md"
                accessibilityLabel={t('session.addExercise')}
              />
              <Button
                title={t('common.back')}
                onPress={() => router.back()}
                variant="ghost"
                size="md"
              />
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <ExerciseCard
            exercise={item}
            sessionId={sessionId}
            isSingleOccurrence={routineExs.filter((candidate) => candidate.exerciseId === item.exerciseId).length === 1}
            index={index}
            onRemove={() => setExerciseToRemove(item)}
            onPress={() => exerciseNavigationGateRef.current.run(() => {
              router.push({
                pathname: '/session/exercise',
                params: {
                  sessionId,
                  routineId: isFreestyle ? 'freestyle' : rIdStr,
                  exerciseId: item.exerciseId,
                  routineExerciseId: item.routineExerciseId ?? undefined,
                  sessionExerciseId: item.sessionExerciseId,
                  exerciseName: item.name,
                  target: item.target ?? '',
                  notes: item.notes ?? '',
                  restSeconds: item.restSeconds?.toString(),
                  startTime: startTime.toString(),
                },
              });
            })}
          />
        )}
      />

      <Dialog
        visible={showExitDialog}
        title={t('session.exitTitle')}
        message={t("session.exitConfirm")}
        confirmText={t("common.exit")}
        cancelText={t("common.stay")}
        type="destructive"
        onConfirm={async () => {
          setShowExitDialog(false);
          // If session has no sets, soft-delete to avoid ghost sessions
          if (sessionId) {
            try {
              const setCount = await db.select({ count: count() })
                .from(sets)
                .where(and(eq(sets.sessionId, sessionId), isNull(sets.deletedAt)));
              if (setCount[0]?.count === 0) {
                await db.update(sessions)
                  .set({ deletedAt: Date.now() })
                  .where(eq(sessions.id, sessionId));
              }
            } catch (e) {
              logger.error('Failed to cleanup empty session', e);
            }
          }
          if (pendingNavigation) {
            navigation.dispatch(pendingNavigation);
          } else {
            router.replace('/(tabs)');
          }
        }}
        onCancel={() => {
          setShowExitDialog(false);
          setPendingNavigation(null);
        }}
      />

      <Dialog
        visible={showFinishDialog}
        title={t('session.finishTitle')}
        message={t("session.finishConfirm")}
        confirmText={t("finish.finishButton")}
        cancelText={t("finish.continueWorkout")}
        type="destructive"
        onConfirm={confirmFinish}
        onCancel={() => setShowFinishDialog(false)}
      />

      <Dialog
        visible={exerciseToRemove !== null}
        title={t('exercise.removeExerciseTitle')}
        message={t('session.removeExerciseConfirm')}
        confirmText={t('common.remove')}
        cancelText={t('common.cancel')}
        type="destructive"
        onConfirm={handleConfirmRemove}
        onCancel={() => setExerciseToRemove(null)}
      />

      {showAddModal && (
        <ExercisePickerModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSelectExercise={handleAddExercise}
          title={t('session.addExercise')}
        />
      )}

      <Toast
        visible={exitToast.visible}
        message={exitToast.message}
        type="info"
        onHide={() => setExitToast({ visible: false, message: '' })}
      />

      <Toast
        visible={sessionToast.visible}
        message={sessionToast.message}
        type={sessionToast.type}
        onHide={() => setSessionToast({ visible: false, message: '' })}
      />

      <Modal
        visible={showBodyWeightDialog}
        transparent
        animationType="fade"
        statusBarTranslucent
        accessibilityViewIsModal
        onRequestClose={() => dismissBodyWeightDialog(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 justify-center items-center bg-black/40"
          onPress={() => dismissBodyWeightDialog(false)}
          accessible={false}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl mx-4"
            onPress={(e) => e.stopPropagation()}
            accessible={false}
          >
            <Text className="text-text text-xl font-bold mb-2">{t('session.bodyWeightTitle')}</Text>
            <Text className="text-subtext text-base mb-5 leading-6">{t('session.bodyWeightMessage')}</Text>
            <View className="flex-row items-center gap-3 mb-4">
              <TextInput
                className="flex-1 bg-background text-text text-2xl font-bold py-3 px-4 rounded-xl border border-border text-center"
                keyboardType="decimal-pad"
                placeholder="75.5"
                placeholderTextColor={Colors.darkSubtext}
                value={bodyWeightInput}
                onChangeText={(val) => {
                  setBodyWeightInput(val);
                  setBodyWeightError('');
                }}
                textAlign="center"
                accessibilityLabel={t('session.bodyWeightTitle')}
              />
              <Text className="text-subtext text-sm font-medium">kg</Text>
            </View>
            {bodyWeightError ? (
              <Text className="text-dangerText text-sm mb-3 text-center">{bodyWeightError}</Text>
            ) : null}
            <Button
              title={t('session.bodyWeightSave')}
              variant="primary"
              onPress={() => {
                const decimalResult = parseLocalizedDecimal(bodyWeightInput, { allowNegative: false });
                if (decimalResult.status !== 'valid') {
                  setBodyWeightError(t('session.bodyWeightInvalid'));
                  return;
                }
                const parsed = weightInputSchema.safeParse({ weight: decimalResult.value });
                if (!parsed.success) {
                  setBodyWeightError(t('session.bodyWeightInvalid'));
                  return;
                }
                dismissBodyWeightDialog(true);
              }}
              fullWidth
            />
            <Button
              title={t('session.bodyWeightSkip')}
              variant="ghost"
              onPress={() => dismissBodyWeightDialog(false)}
              fullWidth
              className="mt-2"
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

interface ExerciseCardProps {
  exercise: RoutineExerciseRow;
  sessionId: number;
  isSingleOccurrence: boolean;
  onPress: () => void;
  onRemove: () => void;
  index: number;
}

function ExerciseCard({ exercise, sessionId, isSingleOccurrence, onPress, onRemove, index }: ExerciseCardProps) {
  const { t } = useI18n();
  const theme = useThemeColors();
  const a11y = buildWorkoutA11y({
    endSession: t('a11y.endSession'),
    undoLastSetLabel: t('exercise.undoLastSet'),
    undoLastSetHint: t('a11y.undoLastSetHint'),
    durationStart: t('a11y.durationStart'),
    durationStop: t('a11y.durationStop'),
    running: t('a11y.running'),
    history: t('a11y.openHistory'),
  });
  const { data: setsData } = useLiveQuery(
    db.select({ count: count() })
      .from(sets)
      .where(and(
        eq(sets.sessionId, sessionId),
        exercise.routineExerciseId != null
          ? isSingleOccurrence
            ? or(
              eq(sets.routineExerciseId, exercise.routineExerciseId),
              and(isNull(sets.routineExerciseId), eq(sets.exerciseId, exercise.exerciseId)),
            )
            : eq(sets.routineExerciseId, exercise.routineExerciseId)
          : eq(sets.exerciseId, exercise.exerciseId),
        isNull(sets.deletedAt),
        eq(sets.isWarmup, false)
      ))
  );

  const doneSets = setsData?.[0]?.count || 0;
  const targetSets = parseTargetSets(exercise.target);

  // Exercise is "active" if any sets are done
  const isActive = doneSets > 0;

  // Exercise is "complete" only if target sets are met (or if no target, any sets count as complete)
  const isComplete = targetSets !== null ? doneSets >= targetSets : doneSets > 0;

  const progressLabel = t('session.setsProgress', { done: doneSets, target: targetSets || '?' });
  const statusLabel = isComplete ? t('session.completed') : isActive ? t('session.inProgress') : t('session.tapToStart');

  return (
    <Animated.View entering={FadeInLeft.delay(index * 100).springify()}>
      <Card
        pressable={true}
        onPress={onPress}
        variant={isActive ? 'default' : 'bordered'}
        className={`transition-all ${
          exercise.supersetGroupId ? 'border-l-4 border-l-secondary' : ''
        } ${
          isActive
            ? 'border-primary shadow-md'
            : 'border-border shadow-sm'
        }`}
        contentPadding={true}
        accessibilityLabel={
          a11y.exerciseCard({
            name: exercise.name,
            progress: progressLabel,
            status: statusLabel,
            isActive: isActive,
            isComplete: isComplete
          }).accessibilityLabel
        }
        accessibilityRole="button"
      >
        <View className="flex-row justify-between items-center w-full">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="flex-1 text-base font-bold text-text" numberOfLines={2}>
                {exercise.name}
              </Text>
              {exercise.supersetGroupId && (
                <View className="bg-secondarySurface px-2 py-0.5 rounded-full border border-secondary/20 flex-shrink-0">
                  <Text className="text-secondaryText text-xs font-bold uppercase tracking-wide" numberOfLines={1}>
                    {t('session.superset')}
                  </Text>
                </View>
              )}
              {isActive && (
                <View className="bg-successSurface px-2 py-0.5 rounded-full border border-success/20 flex-shrink-0">
                  <Text className="text-successText text-xs font-bold uppercase tracking-wide" numberOfLines={1}>
                    {t('session.setsProgress', { done: doneSets, target: targetSets || '?' })}
                  </Text>
                </View>
              )}
            </View>

            {(exercise.target || exercise.notes) && (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {exercise.target && (
                  <Text className="bg-primarySurface text-primaryText rounded-full px-2 py-0.5 text-xs font-bold">
                    {exercise.target}
                  </Text>
                )}
                {exercise.notes && (
                  <Text className="text-subtext text-xs italic" numberOfLines={1}>
                    📝 {exercise.notes}
                  </Text>
                )}
              </View>
            )}

            <View className="flex-row justify-between items-center mt-3">
              <Text className={`text-xs uppercase font-bold tracking-wider ${isActive ? 'text-text' : 'text-subtext/60'}`}>
                {isComplete ? t('session.completed') : isActive ? t('session.inProgress') : t('session.tapToStart')}
              </Text>

              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  onRemove();
                }}
                className="min-h-[44px] min-w-[44px] px-2 py-1 items-center justify-center rounded-lg"
                accessibilityRole="button"
                accessibilityLabel={`${t('session.removeExercise')}: ${exercise.name}`}
              >
                <Text className="text-dangerText text-xs font-semibold">{t('common.remove')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="ml-4">
            {isComplete ? (
              <View className="w-6 h-6 bg-successSurface rounded-full items-center justify-center">
                <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.successText} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <Polyline points="20 6 9 17 4 12" />
                </Svg>
              </View>
            ) : (
              <View className="w-6 h-6 border border-border rounded-full" />
            )}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

function SessionProgress({ sessionId, routineExs }: { sessionId: number; routineExs: RoutineExerciseRow[] }) {
  const { t } = useI18n();
  // Fetch all sets for the session - selecting all columns for better live query support
  const { data: allSets } = useLiveQuery(
    db.select()
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), isNull(sets.deletedAt)))
      .orderBy(sets.id)
  );

  const completedCount = countCompletedRoutineExercises(
    routineExs,
    allSets || []
  );

  const totalCount = routineExs.length;

  if (totalCount === 0) return null;

  const progressLabel = t(
    totalCount === 1
      ? 'session.exercisesCompletedProgressSingular'
      : 'session.exercisesCompletedProgressPlural',
    { current: completedCount, total: totalCount }
  );

  return (
    <View className="mt-4">
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <SectionHeader label={progressLabel} className="mb-2 pl-0" />
      </View>
      <ProgressBar
        current={completedCount}
        total={totalCount}
        variant="header"
        showLabel={false}
        label={progressLabel}
      />
    </View>
  );
}
