import { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { usePrograms } from '@/hooks/use-programs';
import { getLocaleForLanguage, useI18n } from '../../src/i18n/index';
import { getPhaseLabel, getGoalBadge } from '../../src/utils/programs';
import { useToast } from '../../hooks/use-toast';
import { SectionHeader } from '@/components/SectionHeader';
import Svg, { Polyline, Circle } from 'react-native-svg';
export default function ProgramsListScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { t, language } = useI18n();
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

  const { toast, setToast } = useToast();
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
            tintColor={theme.primaryText}
            colors={[theme.primaryText]}
          />
        }
      >
        {/* Active Program Card */}
        {activeProgram && (
          <View className="mb-2">
            <SectionHeader label={t('programs.active')} className="mb-2" />
            <Card pressable onPress={() => router.push(`/programs/detail?programId=${activeProgram.id}` as any)}>
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-text font-extrabold text-lg flex-1 mr-3" numberOfLines={1}>
                  {activeProgram.name}
                </Text>
                <View className="bg-successSurface rounded-full px-2.5 py-1">
                  <Text className="text-successText text-xs font-bold uppercase">
                    {t('programs.active')}
                  </Text>
                </View>
              </View>

              {activeProgram.description ? (
                <Text className="text-subtext text-sm mb-3">
                  {activeProgram.description}
                </Text>
              ) : null}

              {/* Metadata Grid (2 Columns) */}
              <View className="flex-row justify-between mb-2">
                <View className="flex-1 mr-2">
                  <Text className="text-subtext text-2xs font-extrabold uppercase tracking-widest mb-0.5">{t('programs.weeksLabel')}</Text>
                  <Text className="text-text text-sm font-semibold">
                    {currentWeek
                      ? t('programs.weekOf', { current: currentWeek, total: activeProgram.weeksDuration })
                      : t('programs.weeksDuration', { weeks: activeProgram.weeksDuration })
                    }
                  </Text>
                </View>
                {currentPhase && (
                  <View className="flex-1">
                    <Text className="text-subtext text-2xs font-extrabold uppercase tracking-widest mb-0.5">{t('programs.phase')}</Text>
                    <View className="bg-accentSurface rounded-full px-2.5 py-0.5 self-start">
                      <Text className="text-accentText text-xs font-bold uppercase">
                        {getPhaseLabel(currentPhase, t)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {weeksUntilDeload !== null && weeksUntilDeload > 0 && (
                <View className="flex-row items-center gap-1.5 mt-2">
                  <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx="12" cy="12" r="10" />
                    <Polyline points="12 6 12 12 16 14" />
                  </Svg>
                  <Text className="text-subtext text-xs font-semibold">
                    {t('programs.deloadIn', { weeks: weeksUntilDeload })}
                  </Text>
                </View>
              )}

              {activeProgram.goal && (
                <View className="flex-row items-center mt-3 bg-text/5 px-2.5 py-1.5 rounded-full self-start">
                  <Text className="text-xs mr-1.5">{getGoalBadge(activeProgram.goal, t).emoji}</Text>
                  <Text className="text-subtext text-xs font-semibold">
                    {getGoalBadge(activeProgram.goal, t).label}
                  </Text>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Archived Programs */}
        {archivedPrograms.length > 0 && (
          <View className="mt-2">
            <SectionHeader label={t('programs.archived')} className="mb-2" />
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
                      {program.weeksDuration} {t('programs.weeksLabel')} • {getGoalBadge(program.goal, t).label}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-subtext text-xs">
                      {new Date(program.startDate).toLocaleDateString(getLocaleForLanguage(language))}
                    </Text>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <Polyline points="9 18 15 12 9 6" />
                    </Svg>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="p-4 border-t border-border bg-card shadow-lg">
        <Button
          title={t('programs.createNew')}
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
