import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
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
      if (programIdNum) {
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
    if (programIdNum) {
      await fetchProgramDetails(programIdNum);
    }
    setRefreshing(false);
  }, [programIdNum, fetchProgramDetails]);

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
      {/* Header */}
      <View className="px-4 pt-6 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-primaryText text-sm font-semibold">{t('common.back')}</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-text text-xl font-bold" numberOfLines={1}>{program.name}</Text>
          {program.isActive && (
            <View className="bg-primarySurface rounded-md px-2 py-0.5 self-start mt-1">
              <Text className="text-primaryText text-xs font-bold uppercase">{t('programs.active')}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 16 }}
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
          <SectionHeader label={t('programs.title') || 'Programa'} className="mb-2" />
          <Text className="text-text text-xl font-extrabold mb-3">{program.name}</Text>
          {program.description ? (
            <Text className="text-subtext text-sm mb-4">{program.description}</Text>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-2 mb-3">
            {program.isActive && (
              <View className="bg-successSurface rounded-full px-3 py-1">
                <Text className="text-successText text-xs font-bold uppercase">{t('programs.active')}</Text>
              </View>
            )}
            {currentPhase && (
              <View className="bg-accentSurface rounded-full px-3 py-1">
                <Text className="text-accentText text-xs font-bold uppercase">{getPhaseLabel(currentPhase, t)}</Text>
              </View>
            )}
            <View className="bg-card border border-border rounded-full px-3 py-1">
              <Text className="text-subtext text-xs font-bold uppercase">{goalInfo.label}</Text>
            </View>
          </View>
          <View className="flex-row justify-between pt-3 border-t border-border/50">
            <Text className="text-subtext text-xs">
              {new Date(program.startDate).toLocaleDateString(getLocaleForLanguage(language))} → {new Date(program.endDate).toLocaleDateString(getLocaleForLanguage(language))}
            </Text>
            <Text className="text-subtext text-xs font-semibold">
              {program.weeksDuration} {t('programs.weeksLabel')}
            </Text>
          </View>
          {currentWeek && (
            <View className="mt-2 pt-2 border-t border-border/50 flex-row justify-between items-center">
              <Text className="text-text text-xs font-bold uppercase">
                {t('programs.weekOf', { current: currentWeek, total: program.weeksDuration })}
              </Text>
              {weeksUntilDeload !== null && weeksUntilDeload > 0 && (
                <Text className="text-subtext text-xs font-semibold">
                  {t('programs.deloadIn', { weeks: weeksUntilDeload })}
                </Text>
              )}
            </View>
          )}
        </Card>

        {/* Weeks List */}
        <View>
          <SectionHeader label="Semanas" className="mb-3" />
          {weeks.length > 0 ? (
            weeks.map(week => {
              const status = weekCompletionMap.get(week.weekNumber) || 'future';
              const isCurrent = currentWeek === week.weekNumber;

              let badgeStyle = 'bg-card border border-border text-subtext';
              let statusText = 'Pendente';

              if (isCurrent) {
                badgeStyle = 'bg-primarySurface text-primaryText';
                statusText = 'Atual';
              } else if (status === 'done') {
                badgeStyle = 'bg-successSurface text-successText';
                statusText = 'Concluída';
              } else if (status === 'missed') {
                badgeStyle = 'bg-dangerSurface text-dangerText';
                statusText = 'Perdida';
              } else if (status === 'deload') {
                badgeStyle = 'bg-accentSurface text-accentText';
                statusText = 'Deload';
              }

              const badgeBg = badgeStyle.split(' ')[0];
              const badgeText = badgeStyle.split(' ').slice(1).join(' ');

              return (
                <Card
                  key={week.id}
                  className="mb-2"
                  pressable
                  onPress={() => router.push({
                    pathname: '/programs/week-detail',
                    params: { programId: program.id, weekNumber: week.weekNumber }
                  } as any)}
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-3">
                      <Text className="text-text font-bold text-base">
                        {t('programs.weekNumber', { num: week.weekNumber })}
                      </Text>
                      <View className={`rounded-full px-2.5 py-0.5 ${badgeBg}`}>
                        <Text className={`text-2xs font-extrabold uppercase tracking-wider ${badgeText}`}>
                          {statusText}
                        </Text>
                      </View>
                      {week.phase && week.phase !== 'accumulation' && (
                        <View className="bg-accentSurface rounded-full px-2.5 py-0.5">
                          <Text className="text-accentText text-2xs font-bold uppercase">
                            {getPhaseLabel(week.phase, t)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <Polyline points="9 18 15 12 9 6" />
                    </Svg>
                  </View>
                </Card>
              );
            })
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
                  delta={target.targetRepsMax ? `Até ${target.targetRepsMax} reps` : undefined}
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
