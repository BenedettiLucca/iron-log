import { TodayWorkoutService } from '../../services/TodayWorkoutService';
import { safeParseParams, sessionParamsSchema } from '@/src/validators/routes';
import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../src/db/client';
import { exercises, routineExercises, sessions } from '../../src/db/schema';
import { useRouter, useFocusEffect } from 'expo-router';
import { Toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
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
import { resumeMicroSession } from '@/services/MicroSessionService';
import { MicroSessionModal } from '@/components/MicroSessionModal';
import {
  getOverdueWorkouts,
  getMainLaneDrift,
  rescheduleSession,
  type OverdueWorkoutItem,
  type MainLaneDriftInfo,
} from '@/src/utils/training-advisories';
import { DatePicker } from '@/components/DatePicker';
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
  const [todayWorkout, setTodayWorkout] = useState<import('../../services/TodayWorkoutService').TodayWorkout | null>(null);

  // Micro session & scheduled/drift state
  const [microModalVisible, setMicroModalVisible] = useState(false);
  const [activeMicroSession, setActiveMicroSession] = useState<typeof sessions.$inferSelect | null>(null);
  const [overdueWorkouts, setOverdueWorkouts] = useState<OverdueWorkoutItem[]>([]);
  const [driftInfo, setDriftInfo] = useState<MainLaneDriftInfo | null>(null);
  const [reschedulingSession, setReschedulingSession] = useState<OverdueWorkoutItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(new Date());

  const isLoading = routinesLoading || sessionsLoading || programsLoading;

  const fetchData = useCallback(async () => {
    try {
      setHasError(false);
      const [overdue, drift] = await Promise.all([
        getOverdueWorkouts(),
        getMainLaneDrift(),
      ]);
      setOverdueWorkouts(overdue);
      setDriftInfo(drift);
      setActiveMicroSession(resumeMicroSession());
      await Promise.all([fetchRoutines(), fetchHomeData(), fetchActiveProgram()]);
    } catch (e) {
      logger.error('Failed to fetch home data', e);
      setHasError(true);
      setErrorMessage(t('states.errorBody'));
    }
  }, [fetchRoutines, fetchHomeData, fetchActiveProgram, t]);

  useEffect(() => {
    TodayWorkoutService.getTodayWorkout().then(setTodayWorkout).catch(e => {
      logger.error('Failed to fetch today workout', e);
    });
  }, []);

  const handleStartTodayWorkout = useCallback(() => {
    if (!todayWorkout) return;
    const validated = safeParseParams(sessionParamsSchema, {
      routineId: String(todayWorkout.routineId),
      routineName: todayWorkout.routineName,
    }, 'HomeScreen');
    if (!validated) return;
    router.push({
      pathname: '/session/[routineId]',
      params: {
        routineId: String(todayWorkout.routineId),
        routineName: todayWorkout.routineName,
        _ts: Date.now().toString(),
      },
    });
  }, [todayWorkout, router]);

  const handleStartOverdueWorkout = useCallback((item: OverdueWorkoutItem) => {
    if (!item.routineId) return;
    router.push({
      pathname: '/session/[routineId]',
      params: {
        routineId: String(item.routineId),
        routineName: item.routineName,
        sessionId: String(item.sessionId),
        _ts: Date.now().toString(),
      },
    });
  }, [router]);

  const handleConfirmReschedule = useCallback(async (newDate: Date) => {
    if (!reschedulingSession) return;
    const newScheduledFor = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate()).getTime();
    try {
      rescheduleSession({ sessionId: reschedulingSession.sessionId, newScheduledFor });
      setToast({ visible: true, message: t('home.rescheduleSuccess'), type: 'success' });
      setReschedulingSession(null);
      const updated = await getOverdueWorkouts();
      setOverdueWorkouts(updated);
      const updatedDrift = await getMainLaneDrift();
      setDriftInfo(updatedDrift);
    } catch (e) {
      logger.error('Failed to reschedule session', e);
      setToast({ visible: true, message: t('states.errorBody'), type: 'error' });
    }
  }, [reschedulingSession, t, setToast]);

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

    if (incompleteSession.routineId) {
      router.push({
        pathname: '/session/[routineId]',
        params: {
          routineId: incompleteSession.routineId.toString(),
          routineName: incompleteSession.routineName || '',
          sessionId: (incompleteSession.sessionId ?? incompleteSession.id).toString(),
          startTime: (incompleteSession.startTime ?? Date.now()).toString(),
        },
      });
    }

    if (incompleteSession.exerciseId) {
      router.push({
        pathname: '/session/exercise',
        params: {
          sessionId: incompleteSession.sessionId ?? incompleteSession.id,
          routineId: incompleteSession.routineId?.toString(),
          exerciseId: incompleteSession.exerciseId,
          exerciseName: incompleteSession.exerciseName,
          target: incompleteSession.target,
          notes: incompleteSession.notes,
          routineExerciseId: incompleteSession.routineExerciseId,
          restSeconds: incompleteSession.restSeconds?.toString(),
          startTime: (incompleteSession.startTime ?? Date.now()).toString(),
        },
      });
    }
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
            <Card
              pressable
              onPress={handleResumeSession}
              className="bg-primary/10 border border-primary/20"
              accessibilityLabel={`${t("home.continue")}: ${incompleteSession.routineName}. ${incompleteSession.exerciseName}`}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-xl bg-primary/15 justify-center items-center">
                    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" accessible={false}>
                      <Path d="M6 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                      <Path d="M8 8H7v8h1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
                      <Path d="M20 5h-2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                      <Path d="M17 8h-1v8h1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
                      <Path d="M9 12h6" />
                    </Svg>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text text-lg font-bold" numberOfLines={2}>{incompleteSession.routineName}</Text>
                    <Text className="text-subtext text-xs mt-0.5">
                      {incompleteSession.exerciseName} • {t("home.tapToContinue")}
                    </Text>
                  </View>
                </View>
                <View className="bg-primary px-3 py-2 rounded-lg">
                  <Text className="text-onPrimary font-bold text-sm">{t("home.continue")}</Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Today's Workout Card */}
        {todayWorkout && (
          <View className="mt-4">
            <SectionHeader label={t("home.todayWorkout")} className="mb-2" />
            <Card
              pressable
              onPress={handleStartTodayWorkout}
              className="bg-primary/10 border border-primary/20"
              accessibilityLabel={`${t("home.todayWorkout")}: ${todayWorkout.routineName}. ${t("home.weekLabel", { week: todayWorkout.weekNumber })} • ${todayWorkout.dayName}`}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-xl bg-primary/15 justify-center items-center">
                    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" accessible={false}>
                      <Path d="M6 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                      <Path d="M8 8H7v8h1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
                      <Path d="M20 5h-2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                      <Path d="M17 8h-1v8h1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
                      <Path d="M9 12h6" />
                    </Svg>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text text-lg font-bold" numberOfLines={2}>{todayWorkout.routineName}</Text>
                    <Text className="text-subtext text-xs mt-0.5">
                      {t("home.weekLabel", { week: todayWorkout.weekNumber })} • {todayWorkout.dayName}
                    </Text>
                  </View>
                </View>
                <View className="bg-primary px-3 py-2 rounded-lg">
                  <Text className="text-onPrimary font-bold text-sm">{t("home.start")}</Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Overdue Workouts */}
        {overdueWorkouts.length > 0 && (
          <View className="mt-4">
            <SectionHeader label={t('home.overdueWorkouts')} className="mb-2" />
            {overdueWorkouts.map((item) => (
              <Card key={item.sessionId} className="mb-2 border-warningText/30 bg-warningSurface/20">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                      <Text className="text-text font-bold text-base" numberOfLines={2}>{item.routineName}</Text>
                      <View className="bg-dangerSurface px-2 py-0.5 rounded-md border border-dangerText/30">
                        <Text className="text-dangerText font-bold text-2xs uppercase">{t('home.overdueBadge')}</Text>
                      </View>
                    </View>
                    <Text className="text-subtext text-xs">
                      {t('home.scheduledFor', {
                        date: new Date(item.scheduledFor).toLocaleDateString(getLocaleForLanguage(language)),
                      })}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        setRescheduleDate(new Date(item.scheduledFor));
                        setReschedulingSession(item);
                      }}
                      className="bg-card border border-border px-3 py-1.5 rounded-lg min-h-[44px] items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel={`${t('home.reschedule')} ${item.routineName}`}
                    >
                      <Text className="text-subtext font-bold text-xs">{t('home.reschedule')}</Text>
                    </TouchableOpacity>
                    {item.routineId ? (
                      <TouchableOpacity
                        onPress={() => handleStartOverdueWorkout(item)}
                        className="bg-primary px-3 py-1.5 rounded-lg min-h-[44px] items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel={`${t('home.start')} ${item.routineName}`}
                      >
                        <Text className="text-onPrimary font-bold text-xs">{t('home.start')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Micro-workout Banner / Entry */}
        {activeMicroSession ? (
          <View className="mt-4">
            <SectionHeader label={t('microSession.activeSession')} className="mb-2" />
            <Card
              pressable
              onPress={() => setMicroModalVisible(true)}
              className="bg-primary/10 border border-primary/20"
              accessibilityLabel={`${t('microSession.activeSession')}: ${t('microSession.tapToContinue')}`}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-xl bg-primary/15 justify-center items-center">
                    <Text className="text-xl" accessible={false}>⚡</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text text-base font-bold">{t('microSession.title')}</Text>
                    <Text className="text-subtext text-xs mt-0.5">{t('microSession.tapToContinue')}</Text>
                  </View>
                </View>
                <View className="bg-primary px-3 py-2 rounded-lg">
                  <Text className="text-onPrimary font-bold text-sm">{t('home.continue')}</Text>
                </View>
              </View>
            </Card>
          </View>
        ) : (
          <View className="mt-4">
            <Card
              pressable
              onPress={() => setMicroModalVisible(true)}
              className="bg-card border border-border"
              accessibilityLabel={t('home.micro')}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-xl bg-primarySurface justify-center items-center">
                    <Text className="text-xl" accessible={false}>⚡</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text text-base font-bold">{t('home.micro')}</Text>
                    <Text className="text-subtext text-xs mt-0.5">{t('microSession.singleSetLimit')}</Text>
                  </View>
                </View>
                <View className="bg-primarySurface px-3 py-2 rounded-lg border border-primary/20">
                  <Text className="text-primaryText font-bold text-sm">{t('home.start')}</Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Main-Lane Drift Status Card */}
        {driftInfo && (
          <View className="mt-4">
            <SectionHeader label={t('home.driftCard')} className="mb-2" />
            <Card className="bg-card border border-border">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-text font-bold text-base">{t('home.driftCard')}</Text>
                <View
                  className={`px-2.5 py-1 rounded-full border ${
                    driftInfo.driftStatus.status === 'on_track'
                      ? 'bg-successSurface border-successText/40'
                      : driftInfo.driftStatus.status === 'drifting'
                      ? 'bg-warningSurface border-warningText/40'
                      : 'bg-card border-border'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      driftInfo.driftStatus.status === 'on_track'
                        ? 'text-successText'
                        : driftInfo.driftStatus.status === 'drifting'
                        ? 'text-warningText'
                        : 'text-subtext'
                    }`}
                  >
                    {driftInfo.driftStatus.status === 'on_track'
                      ? t('home.driftOnTrack')
                      : driftInfo.driftStatus.status === 'drifting'
                      ? t('home.driftDrifting')
                      : driftInfo.driftStatus.status === 'lapsed'
                      ? t('home.driftLapsed')
                      : t('home.driftOnTrack')}
                  </Text>
                </View>
              </View>
              <Text className="text-subtext text-xs">
                {driftInfo.driftStatus.daysSinceLastMain !== null && driftInfo.driftStatus.daysSinceLastMain !== undefined
                  ? t('home.daysSinceLastMain', { days: driftInfo.driftStatus.daysSinceLastMain })
                  : t('home.noMainHistory')}
              </Text>
              {driftInfo.guidance?.summary && driftInfo.driftStatus.status !== 'on_track' && driftInfo.driftStatus.status !== 'insufficient-data' && driftInfo.driftStatus.status !== 'insufficient_data' ? (
                <Text className="text-subtext text-xs leading-4 mt-2 bg-background/80 p-2.5 rounded-xl border border-border">
                  {driftInfo.guidance.summary}
                </Text>
              ) : null}
            </Card>
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

          const badgeBg = isDeloadWeek ? 'bg-successSurface' : isNearDeload ? 'bg-warningSurface' : 'bg-primarySurface';
          const badgeText = isDeloadWeek ? 'text-successText' : isNearDeload ? 'text-warningText' : 'text-primaryText';

          return (
            <View className={incompleteSession ? 'mt-3' : 'mt-4'}>
              <SectionHeader label={t('programs.active')} className="mb-2" />
              <Card
                pressable
                onPress={() => router.push(`/programs/detail?programId=${activeProgram.id}`)}
                className={isDeloadWeek ? 'bg-successSurface border border-successText/30' : isNearDeload ? 'bg-warningSurface border border-warningText/30' : 'bg-primary/5 border border-primary/20'}
                accessibilityLabel={`${t("programs.active")}: ${activeProgram.name}`}
              >
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-1 mr-2">
                    <Text className="text-text font-bold text-lg mb-0.5">{activeProgram.name}</Text>
                    <Text className="text-subtext text-xs font-medium">
                      {t('programs.weekOf', { current: currentWeek, total: activeProgram.weeksDuration })}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View className={`${badgeBg} px-2.5 py-1 rounded-full`}>
                      <Text className={`${badgeText} text-xs font-semibold capitalize`}>
                        {isDeloadWeek ? t('programs.phases.deload') : t(`programs.phases.${phase}`)}
                      </Text>
                    </View>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" accessible={false}>
                      <Polyline points="9 18 15 12 9 6" />
                    </Svg>
                  </View>
                </View>

                {/* Stats Row */}
                <View accessible className="flex-row items-center border-t border-b border-border/60 py-3 mb-3" accessibilityLabel={`${t('programs.dashboard.volume')}: ${(weeklyVolume/1000).toFixed(1)}k kg, ${t('programs.dashboard.volumeAvg')}: ${(avgWeeklyVolume/1000).toFixed(1)}k kg, ${t('programs.dashboard.avgSRPE')}: ${avgSRPE ?? '-'}`}>
                  <View className="flex-1 items-center">
                    <Text className="text-subtext text-2xs font-extrabold mb-0.5">{t('programs.dashboard.volume')}</Text>
                    <Text className="text-text text-base font-extrabold">{(weeklyVolume/1000).toFixed(1)}k kg</Text>
                    <Text className="text-subtext text-2xs mt-0.5">
                      {t('programs.dashboard.volumeAvg')}: {(avgWeeklyVolume/1000).toFixed(1)}k kg
                    </Text>
                  </View>
                  <View className="w-px h-8 bg-border/60" />
                  <View className="flex-1 items-center justify-center">
                    <Text className="text-subtext text-2xs font-extrabold mb-0.5">{t('programs.dashboard.avgSRPE')}</Text>
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

              {/* Key Lifts Dashboard */}
              {keyLifts.length > 0 && (
                <View className="mt-3 px-1">
                  <SectionHeader label={t('programs.dashboard.keyLifts')} className="mb-2" />
                  <View className="flex-row items-stretch py-3" role="list">
                    {keyLifts.slice(0, 3).map((lift, index) => {
                      const getTrendColor = (trend: string) => {
                        if (trend === 'up') return 'text-successText';
                        if (trend === 'down') return 'text-dangerText';
                        return 'text-subtext';
                      };
                      return (
                        <View
                          key={lift.exerciseId}
                          className={`flex-1 min-w-0 items-center px-2 ${
                            index > 0 ? 'border-l border-border/50' : ''
                          }`}
                          role="listitem"
                        >
                          <Text className="text-xs font-bold text-subtext mb-1 text-center" numberOfLines={2}>{lift.name}</Text>
                          <Text className="text-lg font-extrabold text-text text-center">
                            {lift.currentWeight}
                            <Text className="text-xs text-subtext font-medium"> kg</Text>
                          </Text>
                          <Text className={`text-2xs font-semibold mt-0.5 ${getTrendColor(lift.trend)}`}>
                            {t(`programs.trend${lift.trend.charAt(0).toUpperCase() + lift.trend.slice(1)}`)}
                          </Text>
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
              <TouchableOpacity
                onPress={() => router.push('/history')}
                className="min-h-[44px] px-2 -mr-2 items-center justify-center"
              >
                <Text className="text-secondaryText text-xs font-bold">{t("home.viewCalendar")}</Text>
              </TouchableOpacity>
          </View>

          {lastSession ? (
              <Card
                  pressable
                  onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: lastSession.id } })}
                  accessibilityLabel={`${lastSession.routineName}, ${lastSession.durationMinutes || 0} min, RPE ${lastSession.sRpe}`}
              >
                  <View className="flex-row justify-between items-center">
                      <View className="flex-1 mr-3">
                          <Text className="text-text font-black text-xl mb-1" numberOfLines={2}>{lastSession.routineName}</Text>
                          <Text className="text-subtext text-xs font-medium">
                              {new Date(lastSession.startTime).toLocaleDateString(getLocaleForLanguage(language))} • {lastSession.durationMinutes || 0} min • RPE {lastSession.sRpe}
                          </Text>
                      </View>
                      <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" accessible={false}>
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
          <TouchableOpacity
            onPress={() => router.push('/routines')}
            className="min-h-[44px] px-2 -mr-2 items-center justify-center"
          >
            <Text className="text-primaryText font-bold text-xs">{t("home.manage")}</Text>
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
                    <Text className="text-text text-xl font-bold mb-1" numberOfLines={2}>{routine.name}</Text>
                    <Text className="text-subtext text-sm" numberOfLines={1}>{routine.description}</Text>
                  </View>
                  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" accessible={false}>
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

      <MicroSessionModal
        visible={microModalVisible}
        onClose={() => {
          setMicroModalVisible(false);
          setActiveMicroSession(resumeMicroSession());
        }}
        onFinished={() => {
          setMicroModalVisible(false);
          setActiveMicroSession(null);
          setToast({ visible: true, message: t('microSession.successFinished'), type: 'success' });
          fetchData();
        }}
      />

      {reschedulingSession ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setReschedulingSession(null)}
        >
          <View className="flex-1 justify-center items-center bg-black/60 p-4">
            <View className="bg-card rounded-2xl p-4 w-full max-w-sm border border-border">
              <Text className="text-lg font-bold text-text mb-1">{t('home.reschedule')}</Text>
              <Text className="text-xs text-subtext mb-4">{reschedulingSession.routineName}</Text>
              <DatePicker
                label={t('home.pickNewDate')}
                value={rescheduleDate}
                onChange={(d) => setRescheduleDate(d)}
              />
              <View className="flex-row gap-2 mt-4">
                <Button
                  title={t('common.cancel')}
                  onPress={() => setReschedulingSession(null)}
                  variant="ghost"
                  size="md"
                  style={{ flex: 1 }}
                />
                <Button
                  title={t('common.save')}
                  onPress={() => handleConfirmReschedule(rescheduleDate)}
                  variant="primary"
                  size="md"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}
