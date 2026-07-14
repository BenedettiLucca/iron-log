import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../src/db/client';
import { exercises, routineExercises } from '../../src/db/schema';
import { useRouter, useFocusEffect } from 'expo-router';
import { Toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { EmptyState, InlineEmptyState } from '../../components/EmptyState';
import { LoadingState, ErrorState } from '../../components/ScreenState';
import { SkeletonList } from '../../components/Skeleton';
import { logger } from '@/services/logger';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useRoutines } from '@/hooks/use-routines';
import { useSessions } from '@/hooks/use-sessions';
import { usePrograms } from '@/hooks/use-programs';
import { getLocaleForLanguage, useI18n } from '../../src/i18n/index';
import { resolveScreenState } from '../../src/utils/screen-state';
import { useToast } from '../../hooks/use-toast';
import { SectionHeader } from '@/components/SectionHeader';
import Svg, { Path, Polyline } from 'react-native-svg';
export default function HomeScreen() {
  const { t, language } = useI18n();
  const theme = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { allRoutines: routinesList, fetchRoutines, isLoading: routinesLoading } = useRoutines();
  const { lastSession, incompleteSession, fetchHomeData, isLoading: sessionsLoading } = useSessions();
  const {
    activeProgram,
    fetchActiveProgram,
    getCurrentWeek,
    getWeeksUntilDeload,
    getCurrentPhase,
    weeklyVolume,
    avgWeeklyVolume,
    avgSRPE,
    keyLifts,
    fetchDashboardData,
    isLoading: programsLoading
  } = usePrograms();
  const { toast, setToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isLoading = routinesLoading || sessionsLoading || programsLoading;

  const fetchData = useCallback(async () => {
    try {
      setHasError(false);
      await Promise.all([fetchRoutines(), fetchHomeData(), fetchActiveProgram()]);
    } catch (e) {
      logger.error('Failed to fetch home data', e);
      setHasError(true);
      setErrorMessage(t('states.errorBody'));
    }
  }, [fetchRoutines, fetchHomeData, fetchActiveProgram, t]);

  useEffect(() => {
    if (activeProgram) {
      fetchDashboardData().catch(e => {
        logger.error('Failed to fetch dashboard data', e);
        // We don't necessarily block the whole screen for dashboard data
      });
    }
  }, [activeProgram, fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const { status } = resolveScreenState({
    isLoading: isLoading && !refreshing && routinesList.length === 0,
    hasError,
    hasContent: true, // We always want to show the layout if not error/loading
    errorMessage
  });

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return (
      <ErrorState
        message={errorMessage}
        onRetry={fetchData}
      />
    );
  }

  const seedDatabase = async () => {
    try {
      const exResult = await db.insert(exercises).values([
        { name: 'Supino Reto (Barra)', defaultRestSeconds: 120 },
        { name: 'Agachamento Livre', defaultRestSeconds: 180 },
        { name: 'Levantamento Terra', defaultRestSeconds: 180 },
        { name: 'Puxada Alta', defaultRestSeconds: 90 },
        { name: 'Desenvolvimento Militar', defaultRestSeconds: 90 },
      ]).returning();

      const { routines } = await import('../../src/db/schema');
      const routineA = await db.insert(routines).values({
        name: 'Treino A (Push/Legs)',
        description: 'Foco em Empurrar e Pernas'
      }).returning();

      const routineB = await db.insert(routines).values({
        name: 'Treino B (Pull)',
        description: 'Foco em Puxar e Posterior'
      }).returning();

      await db.insert(routineExercises).values([
        { routineId: routineA[0].id, exerciseId: exResult[0].id, orderIndex: 1 },
        { routineId: routineA[0].id, exerciseId: exResult[1].id, orderIndex: 2 },
        { routineId: routineA[0].id, exerciseId: exResult[4].id, orderIndex: 3 },
        { routineId: routineB[0].id, exerciseId: exResult[2].id, orderIndex: 1 },
        { routineId: routineB[0].id, exerciseId: exResult[3].id, orderIndex: 2 },
      ]);

      fetchData();
      setToast({ visible: true, message: t('home.populateSuccess'), type: 'success' });
    } catch (e) {
      logger.error('Falha ao popular banco', e);
      setToast({ visible: true, message: t('home.populateError'), type: 'error' });
    }
  };

  const handleResumeSession = () => {
    if (!incompleteSession) return;

    router.push({
      pathname: '/session/exercise',
      params: {
        sessionId: incompleteSession.sessionId,
        routineId: incompleteSession.routineId?.toString(),
        exerciseId: incompleteSession.exerciseId,
        exerciseName: incompleteSession.exerciseName,
        target: incompleteSession.target,
        notes: incompleteSession.notes,
      }
    });
  };

  return (
    <View className="flex-1 bg-background px-4">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primaryText}
            colors={[theme.primaryText]}
          />
        }
      >
        {/* Incomplete Session Banner */}
        {incompleteSession && (
          <View className="mt-4">
            <SectionHeader label={t("home.activeWorkout")} className="mb-2" />
            <TouchableOpacity
              onPress={handleResumeSession}
              activeOpacity={0.8}
            >
              <Card className="bg-primary/10 border border-primary/20">
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 flex-row items-center gap-3">
                    <View className="w-11 h-11 rounded-xl bg-primary/15 justify-center items-center">
                      <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M6 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                        <Path d="M8 8H7v8h1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
                        <Path d="M20 5h-2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                        <Path d="M17 8h-1v8h1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
                        <Path d="M9 12h6" />
                      </Svg>
                    </View>
                    <View className="flex-1">
                      <Text className="text-text text-lg font-bold">{incompleteSession.routineName}</Text>
                      <Text className="text-subtext text-xs mt-0.5">
                        {incompleteSession.exerciseName} • {t("home.tapToContinue")}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-primary px-3 py-2 rounded-lg">
                    <Text className="text-onPrimary font-bold text-sm uppercase">{t("home.continue")}</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          </View>
        )}

        {/* Active Program / Dashboard */}
        {activeProgram && (() => {
          const currentWeek = getCurrentWeek();
          const weeksUntilDeload = getWeeksUntilDeload();
          const phase = getCurrentPhase();
          if (currentWeek === null) return null;

          const isDeloadWeek = phase === 'deload';
          const isNearDeload = weeksUntilDeload !== null && weeksUntilDeload <= 2 && !isDeloadWeek;

          return (
            <View className={incompleteSession ? 'mt-3' : 'mt-4'}>
              <SectionHeader label={t('programs.active')} className="mb-2" />
              <TouchableOpacity onPress={() => router.push(`/programs/detail?programId=${activeProgram.id}` as any)}>
                <Card className={isDeloadWeek ? 'bg-successSurface border border-successText/30' : isNearDeload ? 'bg-warningSurface border border-warningText/30' : 'bg-primary/5 border border-primary/20'}>
                  <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-1 mr-2">
                      <Text className="text-text font-bold text-lg mb-0.5">{activeProgram.name}</Text>
                      <Text className="text-subtext text-xs font-medium">
                        {t('programs.weekOf', { current: currentWeek, total: activeProgram.weeksDuration })}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className="bg-successSurface px-2.5 py-1 rounded-full">
                        <Text className="text-successText text-xs font-semibold capitalize">
                          {isDeloadWeek ? t('programs.phases.deload') : t(`programs.phases.${phase}`)}
                        </Text>
                      </View>
                      <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Polyline points="9 18 15 12 9 6" />
                      </Svg>
                    </View>
                  </View>

                  {/* Stats Row */}
                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1 bg-background border border-border/60 rounded-xl p-2.5 items-center">
                      <Text className="text-subtext text-2xs font-extrabold uppercase tracking-widest mb-0.5">{t('programs.dashboard.volume')}</Text>
                      <Text className="text-text text-base font-extrabold">{(weeklyVolume/1000).toFixed(1)}k kg</Text>
                      <Text className="text-subtext text-2xs mt-0.5">
                        {t('programs.dashboard.volumeAvg')}: {(avgWeeklyVolume/1000).toFixed(1)}k kg
                      </Text>
                    </View>
                    <View className="flex-1 bg-background border border-border/60 rounded-xl p-2.5 items-center justify-center">
                      <Text className="text-subtext text-2xs font-extrabold uppercase tracking-widest mb-0.5">{t('programs.dashboard.avgSRPE')}</Text>
                      <Text className="text-text text-base font-extrabold">{avgSRPE ?? '-'}</Text>
                    </View>
                  </View>

                  {/* Progress Row */}
                  <View className="mt-1">
                    <ProgressBar
                      current={weeklyVolume}
                      total={Math.max(weeklyVolume, avgWeeklyVolume, 1)}
                      showLabel={false}
                      isAccessible={false}
                    />
                  </View>

                  {isDeloadWeek ? (
                    <Text className="text-successText text-xs font-semibold mt-2">{t('programs.deloadNow')}</Text>
                  ) : isNearDeload && weeksUntilDeload !== null ? (
                    <Text className="text-warningText text-xs font-semibold mt-2">{t('programs.deloadIn', { weeks: weeksUntilDeload })}</Text>
                  ) : null}
                </Card>
              </TouchableOpacity>

              {/* Key Lifts Dashboard */}
              {keyLifts.length > 0 && (
                <View className="mt-3 px-1">
                  <SectionHeader label={t('programs.dashboard.keyLifts')} className="mb-2" />
                  <View className="flex-row flex-wrap gap-2">
                    {keyLifts.slice(0, 3).map((lift) => {
                      const getTrendColor = (trend: string) => {
                        if (trend === 'up') return 'text-successText';
                        if (trend === 'down') return 'text-dangerText';
                        return 'text-subtext';
                      };
                      return (
                        <View key={lift.exerciseId} className="bg-card border border-border rounded-xl p-3 flex-1 min-w-[30%]">
                          <Text className="text-xs font-bold text-subtext uppercase mb-1" numberOfLines={1}>{lift.name}</Text>
                          <View className="flex-row items-baseline justify-between">
                            <Text className="text-lg font-extrabold text-text">
                              {lift.currentWeight}
                              <Text className="text-xs text-subtext font-medium"> kg</Text>
                            </Text>
                            <Text className={`text-2xs font-semibold ${getTrendColor(lift.trend)}`}>
                              {t(`programs.trend${lift.trend.charAt(0).toUpperCase() + lift.trend.slice(1)}`)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        <View className={`mt-4 ${incompleteSession ? 'mb-4' : 'mb-8'}`}>
          <View className="flex-row justify-between items-center mb-2 px-1">
              <SectionHeader label={t("home.lastSession")} />
              <TouchableOpacity onPress={() => router.push('/history')}>
                  <Text className="text-secondaryText text-xs font-bold uppercase tracking-wider">{t("home.viewCalendar")}</Text>
              </TouchableOpacity>
          </View>

          {lastSession ? (
              <Card
                  pressable
                  onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: lastSession.id } })}
              >
                  <View className="flex-row justify-between items-center">
                      <View className="flex-1 mr-3">
                          <Text className="text-text font-black text-xl mb-1" numberOfLines={2}>{lastSession.routineName}</Text>
                          <Text className="text-subtext text-xs font-medium">
                              {new Date(lastSession.startTime).toLocaleDateString(getLocaleForLanguage(language))} • {lastSession.durationMinutes || 0} min • RPE {lastSession.sRpe}
                          </Text>
                      </View>
                      <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <Polyline points="9 18 15 12 9 6" />
                      </Svg>
                  </View>
              </Card>
          ) : (
              <InlineEmptyState
                  icon="💪"
                  title={t("home.noWorkouts")}
              />
          )}
        </View>

        <View className="flex-row justify-between items-end mb-3 px-1">
          <SectionHeader label={t("home.availableRoutines")} />
          <TouchableOpacity onPress={() => router.push('/routines')}>
            <Text className="text-primaryText font-bold text-xs uppercase tracking-wider">{t("home.manage")}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 12 }}>
          {routinesLoading && routinesList.length === 0 ? (
            <SkeletonList count={3} />
          ) : routinesList && routinesList.length > 0 ? (
            routinesList.map((routine) => (
              <Card
                key={routine.id}
                pressable
                onPress={() => router.push({
                  pathname: '/routine/[routineId]',
                  params: {
                      routineId: routine.id,
                      routineName: routine.name,
                  }
                })}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-4">
                    <Text className="text-text text-xl font-bold mb-1">{routine.name}</Text>
                    <Text className="text-subtext text-sm" numberOfLines={1}>{routine.description}</Text>
                  </View>
                  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <Polyline points="9 18 15 12 9 6" />
                  </Svg>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              icon="🏋️"
              title={t("home.noRoutines")}
              description={t("home.startRoutine")}
              actionLabel={t("home.generateExampleRoutines")}
              onAction={seedDatabase}
            />
          )}
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}
