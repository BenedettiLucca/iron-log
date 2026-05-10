import { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Toast } from '../../../components/Toast';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Dialog } from '../../../components/Dialog';
import { Colors } from '@/constants/colors';
import { usePrograms } from '@/hooks/use-programs';
import { useI18n } from '../../../src/i18n/index';
import { getDetailScreenView, resolveFetchState } from '@/src/utils/program-detail-state';

export default function ProgramDetailScreen() {
  const router = useRouter();
  const { t } = useI18n();
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

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', onConfirm: () => {} });
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (programIdNum) {
        fetchProgramDetails(programIdNum).then(() => {
          fetchDashboardData();
        });
      }
    }, [programIdNum, fetchProgramDetails, fetchDashboardData])
  );

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

  const getPhaseLabel = (phase: string | null) => {
    if (!phase) return '';
    switch (phase) {
      case 'accumulation': return t('programs.phases.accumulation');
      case 'intensification': return t('programs.phases.intensification');
      case 'deload': return t('programs.phases.deload');
      default: return phase;
    }
  };

  const getGoalBadge = (goal: string) => {
    switch (goal) {
      case 'hypertrophy': return { emoji: '💪', label: t('programs.goals.hypertrophy') };
      case 'strength': return { emoji: '🏋️', label: t('programs.goals.strength') };
      case 'endurance': return { emoji: '🏃', label: t('programs.goals.endurance') };
      default: return { emoji: '🎯', label: goal };
    }
  };

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

  const goalInfo = getGoalBadge(program.goal);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-6 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-primary text-sm font-semibold">{t('common.back')}</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-text text-xl font-bold" numberOfLines={1}>{program.name}</Text>
          {program.isActive && (
            <View className="bg-primary/10 rounded-md px-2 py-0.5 self-start mt-1">
              <Text className="text-primary text-xs font-bold uppercase">{t('programs.active')}</Text>
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
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Program Info Card */}
        <Card>
          {program.description ? (
            <Text className="text-subtext text-sm mb-3">{program.description}</Text>
          ) : null}
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-xs">{goalInfo.emoji}</Text>
            <View className="bg-accent/20 rounded-md px-2 py-0.5">
              <Text className="text-accent text-xs font-semibold">{goalInfo.label}</Text>
            </View>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-subtext text-xs">
              📅 {new Date(program.startDate).toLocaleDateString()} → {new Date(program.endDate).toLocaleDateString()}
            </Text>
            <Text className="text-subtext text-xs">
              {program.weeksDuration} {t('programs.weeksLabel')}
            </Text>
          </View>
          {currentWeek && (
            <View className="mt-2 pt-2 border-t border-border">
              <View className="flex-row items-center gap-3">
                <Text className="text-text text-sm font-semibold">
                  {t('programs.weekOf', { current: currentWeek, total: program.weeksDuration })}
                </Text>
                {currentPhase && (
                  <View className="bg-accent/20 rounded-md px-2 py-0.5">
                    <Text className="text-accent text-xs font-semibold">{getPhaseLabel(currentPhase)}</Text>
                  </View>
                )}
              </View>
              {weeksUntilDeload !== null && weeksUntilDeload > 0 && (
                <Text className="text-subtext text-xs mt-1">
                  ⏰ {t('programs.deloadIn', { weeks: weeksUntilDeload })}
                </Text>
              )}
            </View>
          )}
        </Card>

        {/* Weekly Grid */}
        <View>
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">
            {t('programs.dashboard.weekGrid')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {weeks.map(week => {
              const status = weekCompletionMap.get(week.weekNumber) || 'future';
              const isCurrent = currentWeek === week.weekNumber;
              
              let emoji = '';
              if (isCurrent) emoji = '🏋️';
              else if (status === 'done') emoji = '✅';
              else if (status === 'missed') emoji = '❌';
              else if (status === 'deload') emoji = '💚';

              return (
                <TouchableOpacity
                  key={week.id}
                  onPress={() => router.push({
                    pathname: '/programs/week-detail',
                    params: { programId: program.id, weekNumber: week.weekNumber }
                  } as any)}
                  className={`w-[calc(20%-7px)] aspect-square rounded-xl border-2 items-center justify-center ${
                    isCurrent ? 'bg-primary border-primary' : 
                    status === 'done' ? 'bg-green-500/10 border-green-500/30' :
                    status === 'missed' ? 'bg-red-500/10 border-red-500/30' :
                    status === 'deload' ? 'bg-green-500/20 border-green-500/50' :
                    'bg-card border-border'
                  }`}
                >
                  <Text className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-text'}`}>
                    {week.weekNumber}
                  </Text>
                  {emoji ? <Text className="text-[10px] mt-0.5">{emoji}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Assigned Routines Per Week */}
        <View>
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">
            {t('programs.weekAssignments')}
          </Text>
          {weeks.length > 0 ? (
            weeks.map(week => (
              <Card key={week.id} className="mb-2">
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-text text-sm font-semibold">
                        {t('programs.weekNumber', { num: week.weekNumber })}
                      </Text>
                      <View className={`rounded-md px-1.5 py-0.5 ${
                        week.phase === 'deload'
                          ? 'bg-success/20'
                          : week.phase === 'intensification'
                          ? 'bg-accent/20'
                          : 'bg-background'
                      }`}>
                        <Text className={`text-[10px] font-semibold ${
                          week.phase === 'deload' ? 'text-success' : 'text-accent'
                        }`}>
                          {getPhaseLabel(week.phase)}
                        </Text>
                      </View>
                    </View>
                    {week.routineId ? (
                      <Text className="text-subtext text-xs mt-0.5">
                        {t('programs.routineAssigned')}
                      </Text>
                    ) : (
                      <Text className="text-subtext text-xs mt-0.5 italic">
                        {t('programs.noRoutine')}
                      </Text>
                    )}
                  </View>
                  {week.rirTarget !== null && week.rirTarget !== undefined && (
                    <Text className="text-subtext text-xs">RIR {week.rirTarget}</Text>
                  )}
                </View>
              </Card>
            ))
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
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">
            {t('programs.exerciseTargets')}
          </Text>
          {targets.length > 0 ? (
            targets.map(target => (
              <Card key={target.id} className="mb-2">
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-text text-sm font-semibold">
                      {target.exerciseName || t('programs.exerciseId', { id: target.exerciseId })}
                    </Text>
                    <Text className="text-subtext text-xs mt-0.5">
                      {target.targetSets}×{target.targetRepsMin}–{target.targetRepsMax}
                    </Text>
                  </View>
                  <View className="bg-primary/10 rounded-md px-2 py-0.5">
                    <Text className="text-primary text-xs font-bold">
                      {target.targetSets}×{target.targetRepsMin}–{target.targetRepsMax}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
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
          <Text className="text-danger text-xs font-bold uppercase tracking-widest mb-3">
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
