import { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Toast } from '../../../components/Toast';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { Button } from '../../../components/Button';
import { Colors } from '@/constants/colors';
import { usePrograms } from '@/hooks/use-programs';
import { useI18n } from '../../../src/i18n/index';

export default function ProgramsListScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const {
    allPrograms,
    activeProgram,
    isLoading,
    fetchAllPrograms,
    fetchActiveProgram,
    getCurrentWeek,
    getWeeksUntilDeload,
    getCurrentPhase,
  } = usePrograms();

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAllPrograms();
      fetchActiveProgram();
    }, [fetchAllPrograms, fetchActiveProgram])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAllPrograms(), fetchActiveProgram()]);
    setRefreshing(false);
  }, [fetchAllPrograms, fetchActiveProgram]);

  const currentWeek = getCurrentWeek();
  const weeksUntilDeload = getWeeksUntilDeload();
  const currentPhase = getCurrentPhase();

  const archivedPrograms = allPrograms.filter(p => !p.isActive);
  const hasData = activeProgram || archivedPrograms.length > 0;

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

  if (!isLoading && !hasData) {
    return (
      <View className="flex-1 bg-background">
        <View className="px-4 pt-6 pb-4">
          <Text className="text-text text-2xl font-bold">{t('programs.title')}</Text>
          <Text className="text-subtext text-sm mt-1">{t('programs.subtitle')}</Text>
        </View>
        <EmptyState
          icon="📋"
          title={t('programs.emptyTitle')}
          description={t('programs.emptyDescription')}
          actionLabel={t('programs.createNew')}
          onAction={() => router.push('/programs/create' as any)}
        />
        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast({ ...toast, visible: false })}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-6 pb-4">
        <Text className="text-text text-2xl font-bold">{t('programs.title')}</Text>
        <Text className="text-subtext text-sm mt-1">{t('programs.subtitle')}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Active Program Card */}
        {activeProgram && (
          <Card pressable onPress={() => router.push(`/programs/detail?programId=${activeProgram.id}` as any)}>
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-text font-bold text-lg" numberOfLines={1}>
                    {activeProgram.name}
                  </Text>
                </View>
              </View>
              <View className="bg-primary/10 border border-primary/30 rounded-lg px-2.5 py-1">
                <Text className="text-primary text-xs font-bold uppercase">
                  {t('programs.active')}
                </Text>
              </View>
            </View>

            {activeProgram.description ? (
              <Text className="text-subtext text-sm mb-2" numberOfLines={1}>
                {activeProgram.description}
              </Text>
            ) : null}

            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-subtext text-sm">
                {currentWeek
                  ? t('programs.weekOf', { current: currentWeek, total: activeProgram.weeksDuration })
                  : t('programs.weeksDuration', { weeks: activeProgram.weeksDuration })
                }
              </Text>
              {currentPhase && (
                <View className="bg-accent/20 rounded-md px-2 py-0.5">
                  <Text className="text-accent text-xs font-semibold">
                    {getPhaseLabel(currentPhase)}
                  </Text>
                </View>
              )}
            </View>

            {weeksUntilDeload !== null && weeksUntilDeload > 0 && (
              <Text className="text-subtext text-xs mt-1">
                ⏰ {t('programs.deloadIn', { weeks: weeksUntilDeload })}
              </Text>
            )}

            {activeProgram.goal && (
              <View className="flex-row items-center mt-2">
                <Text className="text-xs mr-1">{getGoalBadge(activeProgram.goal).emoji}</Text>
                <Text className="text-subtext text-xs font-medium">
                  {getGoalBadge(activeProgram.goal).label}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Archived Programs */}
        {archivedPrograms.length > 0 && (
          <View className="mt-2">
            <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">
              {t('programs.archived')}
            </Text>
            {archivedPrograms.map(program => (
              <Card
                key={program.id}
                pressable
                onPress={() => router.push(`/programs/detail?programId=${program.id}` as any)}
                className="mb-3"
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-3">
                    <Text className="text-text font-bold text-base" numberOfLines={1}>
                      {program.name}
                    </Text>
                    <Text className="text-subtext text-xs mt-0.5">
                      {program.weeksDuration} {t('programs.weeksLabel')} • {getGoalBadge(program.goal).label}
                    </Text>
                  </View>
                  <Text className="text-subtext text-xs">
                    {new Date(program.startDate).toLocaleDateString()}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="p-4 border-t border-border bg-card shadow-lg">
        <Button
          title={`➕ ${t('programs.createNew')}`}
          onPress={() => router.push('/programs/create' as any)}
          variant="primary"
          size="md"
          fullWidth
        />
      </View>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}
