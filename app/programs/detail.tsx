import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { Toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { ErrorState } from '../../components/ScreenState';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { usePrograms } from '@/hooks/use-programs';
import { getLocaleForLanguage, useI18n } from '../../src/i18n/index';
import { getPhaseLabel, getGoalBadge } from '../../src/utils/programs';
import { getDetailScreenView, resolveFetchState } from '@/src/utils/program-detail-state';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import Svg, { Polyline } from 'react-native-svg';

import { useToast } from '../../hooks/use-toast';
import { useConfirmDialog } from '../../hooks/use-confirm-dialog';
export default function ProgramDetailScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { t, language } = useI18n();
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const programIdNum = Number(programId);

  const {
    activeProgram,
    weeks,
    targets,
    isLoading,
    detailError,
    fetchProgramDetails,
    deleteProgram,
    getCurrentWeek,
    getWeeksUntilDeload,
    getCurrentPhase,
    weekCompletionMap,
    fetchDashboardData
  } = usePrograms();

  const { toast, setToast } = useToast();
  const { dialog, setDialog } = useConfirmDialog();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Number.isInteger(programIdNum) && programIdNum > 0) {
        void fetchProgramDetails(programIdNum);
      }
    }, [programIdNum, fetchProgramDetails])
  );

  useEffect(() => {
    if (activeProgram?.id === programIdNum) {
      fetchDashboardData();
    }
  }, [activeProgram?.id, programIdNum, fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Number.isInteger(programIdNum) && programIdNum > 0) {
      await fetchProgramDetails(programIdNum);
    }
    setRefreshing(false);
  }, [programIdNum, fetchProgramDetails]);

  // Validate route parameters
  if (!Number.isInteger(programIdNum) || programIdNum <= 0) {
    return <ErrorState message={t('programs.invalidRoute')} />;
  }

  const program = activeProgram;
  const currentWeek = getCurrentWeek();
  const weeksUntilDeload = getWeeksUntilDeload();
  const currentPhase = getCurrentPhase();

  const handleDelete = () => {
    if (!program) return;
    setDialog({
      visible: true,
      title: t('programs.deleteTitle'),
      message: t('programs.deleteMessage', { name: program.name }),
      onConfirm: async () => {
        const success = await deleteProgram(program.id);
        if (success) {
          setToast({ visible: true, message: t('programs.deleteSuccess'), type: 'success' });
          setTimeout(() => router.back(), 500);
        } else {
          setToast({ visible: true, message: t('programs.deleteError'), type: 'error' });
        }
      },
    });
  };

  const fetchState = resolveFetchState({
    isLoading,
    hasProgram: !!program,
    hasError: !!detailError,
    errorMessage: detailError ?? undefined,
  });

  const viewState = getDetailScreenView(fetchState);

  if (viewState === 'loading') {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Text className="text-subtext">{t('common.loading')}</Text>
      </View>
    );
  }

  if (viewState === 'error') {
    return (
      <View className="flex-1 bg-background justify-center items-center px-8">
        <Text className="text-6xl mb-6">⚠️</Text>
        <Text className="text-text text-xl font-bold text-center mb-2">{t('programs.loadError')}</Text>
        <Text className="text-subtext text-sm text-center mb-6">{fetchState.errorMessage}</Text>
        <Button
          title={t('common.back')}
          onPress={() => router.back()}
          variant="secondary"
          size="md"
        />
      </View>
    );
  }

  if (viewState === 'not_found' || !program) {
    return (
      <View className="flex-1 bg-background justify-center items-center px-8">
        <Text className="text-6xl mb-6">🔍</Text>
        <Text className="text-text text-xl font-bold text-center mb-3">{t('programs.notFound')}</Text>
        <Button
          title={t('common.back')}
          onPress={() => router.back()}
          variant="secondary"
          size="md"
        />
      </View>
    );
  }

  const goalInfo = getGoalBadge(program.goal, t);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: program.name }} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primaryText}
            colors={[theme.primaryText]}
          />
        }
      >
        {/* Program Info Card */}
        <Card>
          {program.isActive && (
            <View className="bg-successSurface rounded-full px-2.5 py-1 self-start mb-3">
              <Text className="text-successText text-xs font-bold">
                {t('programs.active')}
              </Text>
            </View>
          )}

          {program.description ? (
            <Text className="text-subtext text-sm mb-3">
              {program.description}
            </Text>
          ) : null}

          {/* Metadata (Plain Text, No Pills) */}
          <View className="border-t border-border/50 pt-3 mt-3 gap-2">
            <Text className="text-subtext text-xs font-semibold">
              {t('programs.weeksHeading')}: <Text className="text-text font-bold">
                {program.weeksDuration} {t('programs.weeksLabel')}
              </Text>
            </Text>

            {currentPhase && (
              <Text className="text-subtext text-xs font-semibold">
                {t('programs.phase')}: <Text className="text-text font-bold">
                  {getPhaseLabel(currentPhase, t)}
                </Text>
              </Text>
            )}

            {goalInfo.label && (
              <Text className="text-subtext text-xs font-semibold">
                {t('programs.goal')}: <Text className="text-text font-bold">
                  {goalInfo.label}
                </Text>
              </Text>
            )}

            <Text className="text-subtext text-xs font-semibold">
              {t('programs.startDate')}: <Text className="text-text font-bold">
                {new Date(program.startDate).toLocaleDateString(getLocaleForLanguage(language))} → {new Date(program.endDate).toLocaleDateString(getLocaleForLanguage(language))}
              </Text>
            </Text>

            {currentWeek && (
              <View className="mt-2 pt-2 border-t border-border/50 flex-row justify-between items-center">
                <Text className="text-text text-xs font-bold">
                  {t('programs.weekOf', { current: currentWeek, total: program.weeksDuration })}
                </Text>
                {weeksUntilDeload !== null && weeksUntilDeload > 0 && (
                  <Text className="text-subtext text-xs font-semibold">
                    {t('programs.deloadIn', { weeks: weeksUntilDeload })}
                  </Text>
                )}
              </View>
            )}
          </View>
        </Card>

        {/* Weeks List */}
        <View>
          <SectionHeader label={t('programs.weeksHeading')} className="mb-3" />
          {weeks.length > 0 ? (
            <View className="border-t border-border/50 bg-card rounded-2xl px-4">
              {weeks.map((week, index) => {
                const isCurrent = currentWeek === week.weekNumber;
                const status = weekCompletionMap.get(week.weekNumber) || 'future';
                const resolvedStatus = status !== 'future' ? status : isCurrent ? 'current' : 'future';

                let statusTextClass = 'text-subtext';
                let statusSurfaceClass = 'bg-card border border-border/50';
                if (resolvedStatus === 'done') {
                  statusTextClass = 'text-successText';
                  statusSurfaceClass = 'bg-successSurface';
                } else if (resolvedStatus === 'missed') {
                  statusTextClass = 'text-dangerText';
                  statusSurfaceClass = 'bg-dangerSurface';
                } else if (resolvedStatus === 'deload') {
                  statusTextClass = 'text-accentText';
                  statusSurfaceClass = 'bg-accentSurface';
                } else if (resolvedStatus === 'current') {
                  statusTextClass = 'text-primaryText';
                  statusSurfaceClass = 'bg-primarySurface';
                }

                return (
                  <TouchableOpacity
                    key={week.id}
                    onPress={() => router.push({
                      pathname: '/programs/week-detail',
                      params: { programId: program.id, weekNumber: week.weekNumber }
                    } as any)}
                    className={`py-3 flex-row justify-between items-center min-h-[44px] ${
                      index < weeks.length - 1 ? 'border-b border-border/50' : ''
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('programs.weekNumber', { num: week.weekNumber })} - ${t(`programs.dashboard.weekStatus.${resolvedStatus}`)}`}
                  >
                    <View className="flex-1 flex-row flex-wrap items-center gap-2 mr-2">
                      <Text className="text-text font-bold text-base">
                        {t('programs.weekNumber', { num: week.weekNumber })}
                      </Text>
                      <View className={`rounded-full px-2.5 py-0.5 ${statusSurfaceClass}`}>
                        <Text className={`text-2xs font-extrabold ${statusTextClass}`}>
                          {t(`programs.dashboard.weekStatus.${resolvedStatus}`)}
                        </Text>
                      </View>
                      {week.phase && week.phase !== 'accumulation' && (
                        <Text className="text-subtext text-xs font-semibold">
                          {getPhaseLabel(week.phase, t)}
                        </Text>
                      )}
                    </View>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <Polyline points="9 18 15 12 9 6" />
                    </Svg>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Card>
              <Text className="text-subtext text-sm text-center py-4">
                {t('programs.noWeeks')}
              </Text>
            </Card>
          )}
        </View>

        {/* Exercise Targets */}
        <View>
          <SectionHeader label={t('programs.exerciseTargets')} className="mb-3" />
          {targets.length > 0 ? (
            <View className="flex-row flex-wrap gap-2.5">
              {targets.map(target => (
                <StatTile
                  key={target.id}
                  value={`${target.targetSets}×${target.targetRepsMin}`}
                  label={target.exerciseName || t('programs.exerciseId', { id: target.exerciseId })}
                  accentColor="primary"
                  className="w-[calc(50%-5px)]"
                  delta={target.targetRepsMax ? t('programs.maxReps', { max: target.targetRepsMax }) : undefined}
                />
              ))}
            </View>
          ) : (
            <Card>
              <Text className="text-subtext text-sm text-center py-4">
                {t('programs.noTargets')}
              </Text>
            </Card>
          )}
        </View>

        {/* Danger Zone */}
        <View className="mt-4 mb-8">
          <Text className="text-dangerText text-xs font-bold uppercase tracking-widest mb-3">
            {t('programs.dangerZone')}
          </Text>
          <Button
            title={t('programs.deleteProgram')}
            onPress={handleDelete}
            variant="danger"
            size="md"
            fullWidth
          />
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <Dialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        type="destructive"
        onConfirm={() => {
          dialog.onConfirm();
          setDialog({ ...dialog, visible: false });
        }}
        onCancel={() => setDialog({ ...dialog, visible: false })}
      />
    </View>
  );
}
