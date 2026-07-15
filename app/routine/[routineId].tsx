import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import { db } from '../../src/db/client';
import { routineExercises, exercises, personalRecords, sets, sessions, routines } from '../../src/db/schema';
import { eq, desc, and, sql, isNull, max } from 'drizzle-orm';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Toast } from '../../components/Toast';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState, ErrorState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { estimateE1RM } from '../../services/AnalyticsService';
import { parseTargetSets } from '../../src/utils/exercise';
import { useI18n } from '../../src/i18n/index';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { safeParseParams, routinePreviewParamsSchema } from '@/src/validators/routes';
import { useToast } from '@/hooks/use-toast';
import { consumePendingToast } from '@/src/utils/flash-toast';
import Svg, { Polyline } from 'react-native-svg';

interface ExerciseWithStats {
  id: number;
  name: string;
  type: string;
  target: string | null;
  notes: string | null;
  restSeconds: number | null;
  orderIndex: number | null;
  lastWeight: number | null;
  lastReps: number | null;
  lastDate: number | null;
  estimated1RM: number | null;
  prWeight: number | null;
  prReps: number | null;
  sessionCount: number;
  weightHistory: { date: string; weight: number }[];
}

interface RoutineStats {
  totalSessions: number;
  lastSessionDate: number | null;
  avgDuration: number;
  avgVolume: number;
  bestSession: { date: number; volume: number } | null;
}

type ScreenState = 'loading' | 'invalid' | 'not-found' | 'error' | 'empty' | 'content';

export default function RoutinePreviewScreen() {
  const { t } = useI18n();
  const theme = useThemeColors();
  const rawParams = useLocalSearchParams<{ routineId: string; routineName: string }>();
  const router = useRouter();
  const { toast, setToast } = useToast();
  const rawRoutineId = rawParams.routineId;
  const rawRoutineName = rawParams.routineName;

  const params = useMemo(
    () => safeParseParams(
      routinePreviewParamsSchema,
      { routineId: rawRoutineId, routineName: rawRoutineName },
      'RoutinePreview',
    ),
    [rawRoutineId, rawRoutineName],
  );

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [routineName, setRoutineName] = useState(rawRoutineName || '');
  const [exercisesData, setExercisesData] = useState<ExerciseWithStats[]>([]);
  const [stats, setStats] = useState<RoutineStats>({
    totalSessions: 0, lastSessionDate: null, avgDuration: 0, avgVolume: 0, bestSession: null,
  });
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!params) {
      setScreenState('invalid');
      return;
    }
    const rId = params.routineId;

    setScreenState('loading');
    try {
      // Verify routine exists
      const routineRow = await db.select({ id: routines.id, name: routines.name })
        .from(routines)
        .where(eq(routines.id, rId))
        .limit(1);

      if (routineRow.length === 0) {
        setScreenState('not-found');
        return;
      }

      setRoutineName(routineRow[0].name ?? rawRoutineName ?? '');

      // Load exercises for this routine
      const exData = await db.select({
        id: exercises.id,
        name: exercises.name,
        type: exercises.type,
        target: routineExercises.target,
        notes: routineExercises.notes,
        restSeconds: routineExercises.restSeconds,
        orderIndex: routineExercises.orderIndex,
      })
        .from(routineExercises)
        .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
        .where(eq(routineExercises.routineId, rId))
        .orderBy(routineExercises.orderIndex);

      // For each exercise, load stats
      const exercisesWithStats = await Promise.all(
        exData.map(async (ex) => {
          const lastSets = await db.select({
            weightKg: sets.weightKg,
            reps: sets.reps,
            createdAt: sets.createdAt,
          })
            .from(sets)
            .where(and(eq(sets.exerciseId, ex.id), isNull(sets.deletedAt), sql`NOT ${sets.isWarmup}`))
            .orderBy(desc(sets.createdAt))
            .limit(1);

          const lastSet = lastSets[0];

          const prWeightResult = await db.select({ value: personalRecords.value })
            .from(personalRecords)
            .where(and(eq(personalRecords.exerciseId, ex.id), eq(personalRecords.recordType, 'weight')))
            .limit(1);

          const prRepsResult = await db.select({ value: personalRecords.value })
            .from(personalRecords)
            .where(and(eq(personalRecords.exerciseId, ex.id), eq(personalRecords.recordType, 'reps')))
            .limit(1);

          const sessionCountResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${sets.sessionId})` })
            .from(sets)
            .where(and(eq(sets.exerciseId, ex.id), isNull(sets.deletedAt), sql`NOT ${sets.isWarmup}`));

          const weightHistory = await db.select({
            startTime: sessions.startTime,
            weightKg: max(sets.weightKg),
          })
            .from(sets)
            .innerJoin(sessions, eq(sets.sessionId, sessions.id))
            .where(and(eq(sets.exerciseId, ex.id), isNull(sets.deletedAt), sql`NOT ${sets.isWarmup}`))
            .groupBy(sessions.startTime)
            .orderBy(desc(sessions.startTime))
            .limit(10);

          const e1rm = lastSet && lastSet.weightKg > 0 && lastSet.reps > 0
            ? estimateE1RM(lastSet.weightKg, lastSet.reps)
            : null;

          return {
            ...ex,
            lastWeight: lastSet?.weightKg ?? null,
            lastReps: lastSet?.reps ?? null,
            lastDate: lastSet?.createdAt ?? null,
            estimated1RM: e1rm,
            prWeight: prWeightResult[0]?.value ?? null,
            prReps: prRepsResult[0]?.value ?? null,
            sessionCount: sessionCountResult[0]?.count ?? 0,
            weightHistory: weightHistory
              .filter(w => w.weightKg !== null)
              .map(w => ({
                date: new Date(w.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                weight: w.weightKg!,
              }))
              .reverse(),
          };
        })
      );

      setExercisesData(exercisesWithStats);

      // Load routine stats
      const sessionStats = await db.select({
        id: sessions.id,
        startTime: sessions.startTime,
        durationMinutes: sessions.durationMinutes,
      })
        .from(sessions)
        .where(and(eq(sessions.routineId, rId), isNull(sessions.deletedAt)))
        .orderBy(desc(sessions.startTime));

      const totalSessions = sessionStats.length;
      const lastSessionDate = sessionStats.length > 0 ? sessionStats[0].startTime : null;
      const avgDuration = totalSessions > 0
        ? Math.round(sessionStats.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / totalSessions)
        : 0;

      setStats({ totalSessions, lastSessionDate, avgDuration, avgVolume: 0, bestSession: null });
      setScreenState(exData.length === 0 ? 'empty' : 'content');
    } catch (e) {
      logger.error('Failed to load routine preview', e);
      setScreenState('error');
    }
  }, [params, rawRoutineName]);

  useFocusEffect(
    useCallback(() => {
      const pendingToast = consumePendingToast();
      if (pendingToast) {
        setToast({ visible: true, ...pendingToast });
      } else {
        setToast({ visible: false, message: '', type: 'success' });
      }
      setScreenState('loading');
      setExpandedExercise(null);
      loadData();
    }, [loadData, setToast])
  );

  const handleStartWorkout = () => {
    if (!params) return;
    router.push({
      pathname: '/session/[routineId]',
      params: {
        routineId: String(params.routineId),
        routineName: routineName || '',
        _ts: Date.now().toString(),
      },
    });
  };

  const handleEdit = () => {
    if (!params) return;
    router.push({
      pathname: '/routines/editor',
      params: { id: String(params.routineId) },
    });
  };

  const formatDate = (epoch: number | null) => {
    if (!epoch) return '—';
    return new Date(epoch).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatRest = (seconds: number | null) => {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  if (screenState === 'invalid') {
    return (
      <ErrorState
        title={t('routineDetail.invalidRoute')}
        message={t('states.errorBody')}
      />
    );
  }

  if (screenState === 'loading') {
    return <LoadingState />;
  }

  if (screenState === 'not-found') {
    return (
      <ErrorState
        icon="🔍"
        title={t('routineDetail.notFound')}
      />
    );
  }

  if (screenState === 'error') {
    return (
      <ErrorState
        message={t('routineDetail.queryError')}
        onRetry={loadData}
      />
    );
  }

  const totalExercises = exercisesData.length;

  const estimatedDuration = Math.round(
    exercisesData.reduce((total, ex) => {
      const numSets = parseTargetSets(ex.target) || 3;
      const restSeconds = ex.restSeconds || 90;
      const setDuration = 30;
      const setupTime = 60;
      return total + (numSets * setDuration) + ((numSets - 1) * restSeconds) + setupTime;
    }, 0) / 60
  );

  return (
    <View className="flex-1 bg-background">
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Stack.Screen options={{ title: routineName || t('routineDetail.title') }} />

      {/* Summary Card */}
      <Card>
        <SectionHeader label="Resumo da Rotina" className="mb-2" />
        <Text className="text-text text-xl font-extrabold mb-1">{routineName || t('routineDetail.title')}</Text>
        <View className="flex-row items-center gap-4 mt-2 flex-wrap">
          <View className="bg-primarySurface rounded-full px-3 py-1">
            <Text className="text-primaryText text-xs font-bold uppercase">{totalExercises} {t('routineDetail.exercises')}</Text>
          </View>
          <View className="bg-successSurface rounded-full px-3 py-1">
            <Text className="text-successText text-xs font-bold uppercase">{stats.totalSessions} {t('routineDetail.workouts')}</Text>
          </View>
          {estimatedDuration > 0 && (
            <View className="bg-secondarySurface rounded-full px-3 py-1">
              <Text className="text-secondaryText text-xs font-bold uppercase">~{estimatedDuration} {t('routineDetail.min')}</Text>
            </View>
          )}
        </View>
      </Card>

      {/* Last Session */}
      {stats.lastSessionDate && (
        <Card>
          <SectionHeader label={t('routineDetail.lastWorkout')} className="mb-2" />
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-text text-lg font-bold">{formatDate(stats.lastSessionDate)}</Text>
              {stats.avgDuration > 0 && (
                <Text className="text-subtext text-xs">{t('routineDetail.avgDuration', { duration: stats.avgDuration })}</Text>
              )}
            </View>
          </View>
        </Card>
      )}

      {/* PRs Section */}
      {exercisesData.some(e => e.prWeight !== null) && (
        <View>
          <SectionHeader label="Recordes Pessoais" className="mb-3" />
          <View className="flex-row flex-wrap gap-2.5">
            {exercisesData.filter(e => e.prWeight !== null).slice(0, 4).map(ex => (
              <StatTile
                key={ex.id}
                value={`${ex.prWeight}kg`}
                label={ex.name}
                accentColor="warning"
                className="w-[calc(50%-5px)]"
                delta={ex.lastDate ? formatDate(ex.lastDate) : undefined}
              />
            ))}
          </View>
        </View>
      )}

      {/* Exercise List */}
      <View>
        <SectionHeader label={t('routineDetail.exercises')} className="mb-3" />

        {screenState === 'empty' ? (
          <EmptyState
            icon="📋"
            title={t('routines.noExercises')}
            description={t('routines.addExercisesHint')}
          />
        ) : (
          <View className="gap-3">
            {exercisesData.map((ex, index) => (
              <TouchableOpacity
                key={ex.id}
                onPress={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}
                activeOpacity={0.7}
              >
                <Card className={expandedExercise === ex.id ? 'border-primary/40' : ''}>
                  {/* Header Row */}
                  <View className="flex-row items-start">
                    <View className="w-8 h-8 rounded-full bg-primarySurface justify-center items-center mr-3 mt-0.5">
                      <Text className="text-primaryText font-bold text-sm">{index + 1}</Text>
                    </View>

                    <View className="flex-1 mr-2">
                      <Text className="text-text font-bold text-base" numberOfLines={2}>{ex.name}</Text>
                      <View className="flex-row items-center gap-2 mt-0.5 flex-wrap">
                        {ex.target && (
                          <Text className="text-primaryText text-xs bg-primarySurface px-2 py-0.5 rounded border border-primaryText/10 font-bold uppercase">
                            {ex.target}
                          </Text>
                        )}
                        {ex.restSeconds ? (
                          <Text className="text-subtext text-xs">⏱ {formatRest(ex.restSeconds)}</Text>
                        ) : null}
                        {ex.type === 'duration' && (
                          <Text className="text-secondaryText text-xs">⏱ {t('exercise.duration')}</Text>
                        )}
                      </View>
                    </View>

                    {/* Last Performance */}
                    {ex.lastWeight !== null ? (
                      <View className="items-end min-w-[50px] mr-2">
                        <Text className="text-text font-bold text-sm">{ex.lastWeight}kg</Text>
                        <Text className="text-subtext text-xs">{ex.lastReps} reps</Text>
                      </View>
                    ) : (
                      <View className="bg-subtext/10 px-2 py-1 rounded-full min-w-[50px] items-center mr-2">
                        <Text className="text-subtext/70 text-xs font-bold">{t('routineDetail.new')}</Text>
                      </View>
                    )}

                    {/* Chevron SVG */}
                    <View className="justify-center h-8">
                      <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: expandedExercise === ex.id ? '90deg' : '0deg' }] }}>
                        <Polyline points="9 18 15 12 9 6" />
                      </Svg>
                    </View>
                  </View>

                  {/* PR & Stats Badges */}
                  {ex.sessionCount > 0 && (
                    <View className="flex-row gap-2 mt-2 flex-wrap">
                      {ex.prWeight !== null && (
                        <View className="bg-accentSurface px-2 py-0.5 rounded-full border border-accentText/20">
                          <Text className="text-accentText text-xs font-bold">🏆 PR: {ex.prWeight}kg</Text>
                        </View>
                      )}
                      {ex.estimated1RM !== null && (
                        <View className="bg-primarySurface px-2 py-0.5 rounded-full border border-primaryText/20">
                          <Text className="text-primaryText text-xs font-bold">💪 1RM: {ex.estimated1RM}kg</Text>
                        </View>
                      )}
                      <View className="bg-secondarySurface px-2 py-0.5 rounded-full border border-secondaryText/20">
                        <Text className="text-secondaryText text-xs font-bold">{t('routineDetail.timesTrainedCount', { count: ex.sessionCount })}</Text>
                      </View>
                    </View>
                  )}

                  {/* Notes */}
                  {ex.notes && (
                    <Text className="text-subtext text-xs mt-2 italic">📝 {ex.notes}</Text>
                  )}

                  {/* Expanded: Weight Evolution Chart */}
                  {expandedExercise === ex.id && ex.weightHistory.length > 1 && (
                    <View className="mt-3 pt-3 border-t border-border">
                      <SectionHeader label={t('routineDetail.weightEvolution')} className="mb-2" />
                      <View className="flex-row items-end gap-1" style={{ height: 60 }}>
                        {(() => {
                          const maxW = Math.max(...ex.weightHistory.map(w => w.weight));
                          const minW = Math.min(...ex.weightHistory.map(w => w.weight));
                          const range = maxW - minW || 1;
                          return ex.weightHistory.map((point, i) => {
                            const height = ((point.weight - minW) / range) * 40 + 20;
                            const isLast = i === ex.weightHistory.length - 1;
                            return (
                              <View key={i} className="flex-1 items-center gap-0.5">
                                <Text className="text-subtext text-2xs">{point.weight}</Text>
                                <View
                                  className={`w-full rounded-sm ${isLast ? 'bg-primary' : 'bg-primary/30'}`}
                                  style={{ height }}
                                />
                                <Text className="text-subtext text-2xs" numberOfLines={1}>{point.date}</Text>
                              </View>
                            );
                          });
                        })()}
                      </View>
                    </View>
                  )}

                  {/* Expanded: History Table */}
                  {expandedExercise === ex.id && ex.weightHistory.length > 0 && (
                    <View className="mt-2 pt-2 border-t border-border">
                      <SectionHeader label={t('routineDetail.recentHistory')} className="mb-1" />
                      {ex.weightHistory.slice(-5).reverse().map((h, i) => (
                        <View key={i} className="flex-row justify-between py-0.5">
                          <Text className="text-subtext text-xs">{h.date}</Text>
                          <Text className="text-text text-xs font-bold">{h.weight}kg</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View className="h-24" />
    </ScrollView>

    {/* Floating Bottom Actions */}
    <View className="absolute bottom-0 left-0 right-0 bg-card/95 border-t border-border px-4 py-3 gap-2" style={{ paddingBottom: 24 }}>
      <View className="flex-row gap-3">
        <Button
          title={t('common.edit')}
          onPress={handleEdit}
          variant="secondary"
          size="lg"
          className="flex-1"
        />
        <Button
          title={t('routineDetail.startWorkout')}
          onPress={handleStartWorkout}
          variant="primary"
          size="lg"
          className="flex-[2]"
          disabled={!params || screenState !== 'content'}
        />
      </View>
    </View>
    <Toast
      visible={toast.visible}
      message={toast.message}
      type={toast.type}
      onHide={() => setToast((current) => ({ ...current, visible: false }))}
    />
    </View>
  );
}
