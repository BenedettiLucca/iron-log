import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { db } from '../../src/db/client';
import { routineExercises, exercises, personalRecords, sets, sessions } from '../../src/db/schema';
import { eq, desc, and, sql, isNull, max } from 'drizzle-orm';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { logger } from '@/services/logger';
import { Colors } from '@/constants/colors';
import { estimateE1RM } from '../../services/AnalyticsService';
import { parseTargetSets } from '../../src/utils/exercise';
import { useI18n } from '../../src/i18n/index';

interface ExerciseWithStats {
  id: number;
  name: string;
  type: string;
  target: string | null;
  notes: string | null;
  restSeconds: number | null;
  orderIndex: number;
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

export default function RoutinePreviewScreen() {
  const { t } = useI18n();
  const { routineId, routineName } = useLocalSearchParams<{ routineId: string; routineName: string }>();
  const router = useRouter();
  const [exercisesData, setExercisesData] = useState<ExerciseWithStats[]>([]);
  const [stats, setStats] = useState<RoutineStats>({
    totalSessions: 0, lastSessionDate: null, avgDuration: 0, avgVolume: 0, bestSession: null,
  });
  const [loading, setLoading] = useState(true);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!routineId) return;
    const rId = Number(routineId);

    try {
      // 1. Load exercises for this routine
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

      // 2. For each exercise, load stats
      const exercisesWithStats: ExerciseWithStats[] = await Promise.all(
        exData.map(async (ex) => {
          // Last performed set
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

          // PRs
          const prWeightResult = await db.select({ value: personalRecords.value })
            .from(personalRecords)
            .where(and(eq(personalRecords.exerciseId, ex.id), eq(personalRecords.recordType, 'weight')))
            .limit(1);

          const prRepsResult = await db.select({ value: personalRecords.value })
            .from(personalRecords)
            .where(and(eq(personalRecords.exerciseId, ex.id), eq(personalRecords.recordType, 'reps')))
            .limit(1);

          // Session count (how many times this exercise was performed)
          const sessionCountResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${sets.sessionId})` })
            .from(sets)
            .where(and(eq(sets.exerciseId, ex.id), isNull(sets.deletedAt), sql`NOT ${sets.isWarmup}`));

          // Weight history (last 10 sessions)
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

      // 3. Load routine stats
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

    } catch (e) {
      logger.error('Failed to load routine preview', e);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleStartWorkout = () => {
    router.push({
      pathname: '/session/[routineId]',
      params: {
        routineId,
        routineName: routineName || '',
        _ts: Date.now().toString(),
      },
    });
  };

  const handleEdit = () => {
    router.push({
      pathname: '/routines/editor',
      params: { id: routineId },
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

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const totalExercises = exercisesData.length;

  // Estimate workout duration including rest periods between sets
  const estimatedDuration = Math.round(
    exercisesData.reduce((total, ex) => {
      const sets = parseTargetSets(ex.target) || 3;
      const restSeconds = ex.restSeconds || 90;
      const setDuration = 30; // ~30s per set
      const setupTime = 60; // ~1min setup between exercises
      // Time for this exercise: all sets + rest between sets + setup
      return total + (sets * setDuration) + ((sets - 1) * restSeconds) + setupTime;
    }, 0) / 60
  );

  const exercisesWithPRs = exercisesData.filter(e => e.prWeight !== null).length;

  return (
    <View className="flex-1 bg-background">
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Stack.Screen options={{ title: routineName || 'Rotina' }} />

      {/* Quick Stats Row */}
      <View className="flex-row gap-3">
        <View className="flex-1 gap-3">
          <Card className="items-center py-3">
            <Text className="text-primary text-2xl font-black">{totalExercises}</Text>
            <Text className="text-subtext text-xs font-bold uppercase mt-0.5">{t('routineDetail.exercises')}</Text>
          </Card>
          <Card className="items-center py-3">
            <Text className="text-primary text-2xl font-black">~{estimatedDuration}</Text>
            <Text className="text-subtext text-xs font-bold uppercase mt-0.5">{t('routineDetail.min')}</Text>
          </Card>
        </View>
        <View className="flex-1 gap-3">
          <Card className="items-center py-3">
            <Text className="text-primary text-2xl font-black">{stats.totalSessions}</Text>
            <Text className="text-subtext text-xs font-bold uppercase mt-0.5">{t('routineDetail.workouts')}</Text>
          </Card>
          <Card className="items-center py-3">
            <Text className="text-primary text-2xl font-black">{exercisesWithPRs}</Text>
            <Text className="text-subtext text-xs font-bold uppercase mt-0.5">{t('routineDetail.prs')}</Text>
          </Card>
        </View>
      </View>

      {/* Last Session */}
      {stats.lastSessionDate && (
        <Card>
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-2">{t('routineDetail.lastWorkout')}</Text>
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-text text-lg font-bold">{formatDate(stats.lastSessionDate)}</Text>
              {stats.avgDuration > 0 && (
                <Text className="text-subtext text-xs">Duração média: {stats.avgDuration} min</Text>
              )}
            </View>
          </View>
        </Card>
      )}

      {/* Exercise List */}
      <View>
        <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">{t('routineDetail.exercises')}</Text>

        {exercisesData.length === 0 ? (
          <EmptyState
            icon="📋"
            title={t("routines.noExercises")}
            description={t("routines.addExercisesHint")}
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
                    <View className="w-8 h-8 rounded-full bg-primary/10 justify-center items-center mr-3 mt-0.5">
                      <Text className="text-primary font-bold text-sm">{index + 1}</Text>
                    </View>

                    <View className="flex-1 mr-2">
                      <Text className="text-text font-bold text-base" numberOfLines={2}>{ex.name}</Text>
                      <View className="flex-row items-center gap-2 mt-0.5 flex-wrap">
                        {ex.target && (
                          <Text className="text-primary text-xs bg-primary/5 px-2 py-0.5 rounded border border-primary/10 font-bold uppercase">
                            {ex.target}
                          </Text>
                        )}
                        {ex.restSeconds ? (
                          <Text className="text-subtext text-xs">⏱ {formatRest(ex.restSeconds)}</Text>
                        ) : null}
                        {ex.type === 'duration' && (
                          <Text className="text-secondary text-xs">⏱ Duração</Text>
                        )}
                      </View>
                    </View>

                    {/* Last Performance */}
                    {ex.lastWeight !== null ? (
                      <View className="items-end min-w-[50px]">
                        <Text className="text-text font-bold text-sm">{ex.lastWeight}kg</Text>
                        <Text className="text-subtext text-xs">{ex.lastReps} reps</Text>
                      </View>
                    ) : (
                      <View className="bg-subtext/10 px-2 py-1 rounded-full min-w-[50px] items-center">
                        <Text className="text-subtext/70 text-xs font-bold">{t('routineDetail.new')}</Text>
                      </View>
                    )}
                  </View>

                  {/* PR & Stats Badges */}
                  {ex.sessionCount > 0 && (
                    <View className="flex-row gap-2 mt-2 flex-wrap">
                      {ex.prWeight !== null && (
                        <View className="bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <Text className="text-amber-600 text-xs font-bold">🏆 PR: {ex.prWeight}kg</Text>
                        </View>
                      )}
                      {ex.estimated1RM !== null && (
                        <View className="bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                          <Text className="text-purple-500 text-xs font-bold">💪 1RM: {ex.estimated1RM}kg</Text>
                        </View>
                      )}
                      <View className="bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                        <Text className="text-blue-500 text-xs font-bold">{ex.sessionCount}x treinado</Text>
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
                      <Text className="text-subtext text-xs font-bold uppercase tracking-wider mb-2">{t('routineDetail.weightEvolution')}</Text>
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
                      <Text className="text-subtext text-xs font-bold uppercase tracking-wider mb-1">{t('routineDetail.recentHistory')}</Text>
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
          title={t("routines.edit")}
          onPress={handleEdit}
          variant="secondary"
          size="lg"
          className="flex-1"
        />
        <Button
          title={t("routineDetail.startWorkout")}
          onPress={handleStartWorkout}
          variant="primary"
          size="lg"
          className="flex-[2]"
        />
      </View>
    </View>
    </View>
  );
}
