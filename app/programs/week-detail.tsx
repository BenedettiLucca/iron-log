import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePrograms } from '@/hooks/use-programs';
import { getLocaleForLanguage, useI18n } from '@/src/i18n';
import { Card } from '@/components/Card';
import { LoadingState, ErrorState } from '@/components/ScreenState';
import { logger } from '@/services/logger';
import type { Session, WeekCompletionStatus } from '@/src/types';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { db } from '@/src/db/client';
import { routineExercises, exercises } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { weekDetailParamsSchema, safeParseParams } from '@/src/validators/routes';

export default function WeekDetailScreen() {
  const { t, language } = useI18n();
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ programId: string; weekNumber: string }>();

  // Memoize parsing by primitive raw param values to avoid effect loops
  const rawProgramId = rawParams.programId;
  const rawWeekNumber = rawParams.weekNumber;
  const parsedParams = useMemo(
    () => safeParseParams(
      weekDetailParamsSchema,
      { programId: rawProgramId, weekNumber: rawWeekNumber },
      'WeekDetailScreen',
    ),
    [rawProgramId, rawWeekNumber],
  );

  const programId = parsedParams?.programId;
  const initialWeekNumber = parsedParams?.weekNumber;

  const {
    activeProgram,
    fetchProgramDetails,
    weeks,
    weekCompletionMap,
    fetchDashboardData,
    getSessionsForWeek,
    isLoading,
    detailError,
    getCurrentWeek,
  } = usePrograms();

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weekExercises, setWeekExercises] = useState<
    { id: number; name: string; target: string | null; notes: string | null; restSeconds: number | null }[]
  >([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [exercisesError, setExercisesError] = useState<string | null>(null);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [isExercisesLoading, setIsExercisesLoading] = useState(false);
  const sessionsRequestRef = useRef(0);
  const exercisesRequestRef = useRef(0);

  const loadProgram = useCallback(async () => {
    if (programId === undefined) return;
    await fetchProgramDetails(programId);
  }, [programId, fetchProgramDetails]);

  useEffect(() => { loadProgram(); }, [loadProgram]);

  useEffect(() => {
    if (activeProgram) fetchDashboardData();
  }, [activeProgram, fetchDashboardData]);

  // Sync selectedWeek once weeks are loaded; does NOT silently fall back
  useEffect(() => {
    if (weeks.length === 0 || initialWeekNumber === undefined) return;
    if (selectedWeek !== null && weeks.some((w) => w.weekNumber === selectedWeek)) return;

    sessionsRequestRef.current += 1;
    exercisesRequestRef.current += 1;
    setSessions([]);
    setWeekExercises([]);
    setSessionsError(null);
    setExercisesError(null);
    setIsSessionsLoading(true);
    setIsExercisesLoading(true);
    setSelectedWeek(initialWeekNumber);
  }, [weeks, initialWeekNumber, selectedWeek]);

  const loadSessions = useCallback(async () => {
    const requestId = ++sessionsRequestRef.current;
    if (!activeProgram || selectedWeek === null || !weeks.some((w) => w.weekNumber === selectedWeek)) return;
    try {
      setIsSessionsLoading(true);
      setSessionsError(null);
      setSessions([]);
      const data = await getSessionsForWeek(selectedWeek);
      if (sessionsRequestRef.current === requestId) setSessions(data);
    } catch (e) {
      logger.error('Failed to load sessions for week', e);
      if (sessionsRequestRef.current === requestId) setSessionsError(t('states.errorBody'));
    } finally {
      if (sessionsRequestRef.current === requestId) setIsSessionsLoading(false);
    }
  }, [activeProgram, selectedWeek, weeks, getSessionsForWeek, t]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadWeekExercises = useCallback(async () => {
    const requestId = ++exercisesRequestRef.current;
    if (selectedWeek === null) return;
    const weekData = weeks.find((w) => w.weekNumber === selectedWeek);
    if (!weekData?.routineId) {
      setExercisesError(null);
      setWeekExercises([]);
      setIsExercisesLoading(false);
      return;
    }
    try {
      setIsExercisesLoading(true);
      setExercisesError(null);
      setWeekExercises([]);
      const data = await db
        .select({
          id: exercises.id,
          name: exercises.name,
          target: routineExercises.target,
          notes: routineExercises.notes,
          restSeconds: routineExercises.restSeconds,
        })
        .from(routineExercises)
        .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
        .where(eq(routineExercises.routineId, weekData.routineId))
        .orderBy(routineExercises.orderIndex);
      if (exercisesRequestRef.current === requestId) setWeekExercises(data);
    } catch (e) {
      logger.error('Failed to load week exercises', e);
      if (exercisesRequestRef.current === requestId) setExercisesError(t('states.errorBody'));
    } finally {
      if (exercisesRequestRef.current === requestId) setIsExercisesLoading(false);
    }
  }, [selectedWeek, weeks, t]);

  useEffect(() => { loadWeekExercises(); }, [loadWeekExercises]);

  const getStatusEmoji = (status: WeekCompletionStatus | 'current') => {
    switch (status) {
      case 'done': return '✅';
      case 'missed': return '❌';
      case 'deload': return '💚';
      case 'current': return '●';
      default: return '';
    }
  };

  const selectWeek = (weekNumber: number) => {
    sessionsRequestRef.current += 1;
    exercisesRequestRef.current += 1;
    setSessions([]);
    setWeekExercises([]);
    setSessionsError(null);
    setExercisesError(null);
    setIsSessionsLoading(true);
    setIsExercisesLoading(true);
    setSelectedWeek(weekNumber);
  };

  const renderBackScreen = (icon: string, message: string) => (
    <View className="flex-1 bg-background justify-center items-center p-8">
      <Text className="text-5xl mb-6">{icon}</Text>
      <Text className="text-text text-xl font-bold text-center mb-3">{message}</Text>
      <TouchableOpacity onPress={() => router.back()} className="bg-card border border-border px-6 py-3 rounded-xl mt-4">
        <Text className="text-text font-bold">{t('common.back')}</Text>
      </TouchableOpacity>
    </View>
  );

  // ── State resolution ──────────────────────────────────────────────────────

  // Invalid route — rendered after all hook declarations
  if (!parsedParams) return <ErrorState message={t('programs.invalidRoute')} />;

  if (isLoading && weeks.length === 0 && !detailError) return <LoadingState />;

  if (detailError) {
    return <ErrorState message={detailError} onRetry={loadProgram} />;
  }

  if (!isLoading && !activeProgram) {
    return renderBackScreen('🔍', t('programs.notFound'));
  }

  if (!isLoading && activeProgram && weeks.length === 0) {
    return renderBackScreen('📅', t('programs.noWeeks'));
  }

  const selectedWeekData = selectedWeek !== null ? weeks.find((w) => w.weekNumber === selectedWeek) : undefined;

  if (!isLoading && selectedWeek !== null && !selectedWeekData && weeks.length > 0) {
    return renderBackScreen('📋', t('programs.weekNotFound'));
  }

  if (selectedWeek === null) return <LoadingState />;

  // ── Content ───────────────────────────────────────────────────────────────

  const isCurrent = selectedWeek === getCurrentWeek();
  const status = selectedWeek !== null ? (weekCompletionMap.get(selectedWeek) || 'future') : 'future';
  const resolvedStatus = status !== 'future' ? status : isCurrent ? 'current' : 'future';

  let badgeBg = 'bg-card border border-border';
  let badgeText = 'text-subtext';
  if (resolvedStatus === 'current') {
    badgeBg = 'bg-primarySurface';
    badgeText = 'text-primaryText';
  } else if (resolvedStatus === 'done') {
    badgeBg = 'bg-successSurface';
    badgeText = 'text-successText';
  } else if (resolvedStatus === 'missed') {
    badgeBg = 'bg-dangerSurface';
    badgeText = 'text-dangerText';
  } else if (resolvedStatus === 'deload') {
    badgeBg = 'bg-accentSurface';
    badgeText = 'text-accentText';
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2">
        {selectedWeekData && (
          <>
            <Text className="text-text font-black text-2xl">
              {t('programs.weekNumber', { num: selectedWeek })} — {t(`programs.phases.${selectedWeekData.phase}`)}
            </Text>
            <View className={`rounded-full px-2.5 py-0.5 mt-2 self-start ${badgeBg}`}>
              <Text className={`text-2xs font-extrabold uppercase tracking-wider ${badgeText}`}>
                {t(`programs.dashboard.weekStatus.${resolvedStatus}`)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Week Grid */}
      <View className="px-4 mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 8 }}>
          {weeks.map((w) => {
            const wStatus = weekCompletionMap.get(w.weekNumber) || 'future';
            const isSelected = selectedWeek === w.weekNumber;
            const resolvedWStatus = wStatus !== 'future' ? wStatus : (getCurrentWeek() === w.weekNumber ? 'current' : 'future');
            let bgClass = 'bg-card border border-border/50';
            let textClass = 'text-subtext';
            if (isSelected) {
              bgClass = 'bg-primary border-2 border-primary';
              textClass = 'text-onPrimary';
            } else if (resolvedWStatus === 'current') {
              bgClass = 'bg-primarySurface border border-primary/20'; textClass = 'text-primaryText';
            } else if (resolvedWStatus === 'done') {
              bgClass = 'bg-successSurface border border-success/20'; textClass = 'text-successText';
            } else if (resolvedWStatus === 'missed') {
              bgClass = 'bg-dangerSurface border border-danger/20'; textClass = 'text-dangerText';
            } else if (resolvedWStatus === 'deload') {
              bgClass = 'bg-accentSurface border border-accent/20'; textClass = 'text-accentText';
            }
            return (
              <TouchableOpacity
                key={w.id}
                onPress={() => selectWeek(w.weekNumber)}
                className={`w-12 h-12 rounded-xl justify-center items-center ${bgClass}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${t('programs.weekNumber', { num: w.weekNumber })} - ${t(`programs.dashboard.weekStatus.${resolvedWStatus}`)}`}
              >
                <Text className={`text-xs font-bold ${textClass}`}>{w.weekNumber}</Text>
                {!isSelected && <Text className={`text-2xs mt-0.5 ${textClass}`}>{getStatusEmoji(resolvedWStatus)}</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {selectedWeekData && (
          <View className="mb-4">
            <SectionHeader label={t('programs.weeklyTargets')} className="mb-3" />
            <View className="flex-row gap-2.5">
              <StatTile
                value={selectedWeekData.rirTarget !== null ? `RIR ${selectedWeekData.rirTarget}` : 'N/A'}
                label={t('programs.targetRir')}
                accentColor="primary"
                className="flex-1"
              />
              <StatTile
                value={selectedWeekData.intensityMod !== null ? `${Math.round(selectedWeekData.intensityMod * 100)}%` : '100%'}
                label={t('programs.intensity')}
                accentColor="secondary"
                className="flex-1"
              />
              <StatTile
                value={t(`programs.phases.${selectedWeekData.phase}`)}
                label={t('programs.blockPhase')}
                accentColor="warning"
                className="flex-1"
              />
            </View>
          </View>
        )}

        {/* Exercise List */}
        <View className="mb-4">
          <SectionHeader label={t('programs.plannedExercises')} className="mb-3" />
          {isExercisesLoading ? (
            <LoadingState />
          ) : exercisesError ? (
            <ErrorState message={exercisesError} onRetry={loadWeekExercises} />
          ) : weekExercises.length > 0 ? (
            <View className="border-t border-border/50">
              {weekExercises.map((ex, idx) => (
                <View key={`${ex.id}-${idx}`} className="py-3 border-b border-border/50">
                  <View className="flex-1">
                    <Text className="text-text font-bold text-base">{ex.name}</Text>
                    <View className="flex-row gap-3 mt-1">
                      {ex.target && (
                        <Text className="text-subtext text-xs">
                          {t('programs.targetLabel')}: {ex.target}
                        </Text>
                      )}
                      {ex.restSeconds && (
                        <Text className="text-subtext text-xs">
                          {t('programs.restLabel')}: {ex.restSeconds}s
                        </Text>
                      )}
                    </View>
                    {ex.notes && (
                      <Text className="text-subtext text-xs italic mt-0.5">
                        {t('programs.notesLabel')}: {ex.notes}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="border-y border-dashed border-border py-4">
              <Text className="text-subtext text-sm text-center">
                {t('programs.noPlannedExercises')}
              </Text>
            </View>
          )}
        </View>

        <SectionHeader label={t('programs.dashboard.sessions')} className="mb-3" />

        {isSessionsLoading ? (
          <LoadingState />
        ) : sessionsError ? (
          <ErrorState message={sessionsError} onRetry={loadSessions} />
        ) : sessions.length > 0 ? (
          sessions.map((session) => (
            <View key={session.id} className="mb-3">
              <Card
                pressable
                onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: session.id } })}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-text font-bold text-lg">{session.routineName}</Text>
                    <Text className="text-subtext text-xs mt-0.5">
                      {new Date(session.startTime).toLocaleDateString(getLocaleForLanguage(language))} • {session.durationMinutes} min
                    </Text>
                  </View>
                  {session.sRpe && (
                    <View className="bg-primarySurface px-2 py-1 rounded">
                      <Text className="text-primaryText font-bold text-xs">sRPE {session.sRpe}</Text>
                    </View>
                  )}
                </View>
              </Card>
            </View>
          ))
        ) : (
          <View className="my-2">
            <Card>
              <Text className="text-subtext text-sm text-center py-4">
                {t('programs.dashboard.noSessions')}
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
