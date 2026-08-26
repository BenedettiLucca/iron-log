import { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
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
  const activeGoalInfo = activeProgram?.goal ? getGoalBadge(activeProgram.goal, t) : null;

  const archivedPrograms = allPrograms.filter(p => !p.isActive);
  const hasData = activeProgram || archivedPrograms.length > 0;

  if (!isLoading && !hasData) {
    return (
      <View className="flex-1 bg-background">
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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 12 }}
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
            <Card
              pressable
              onPress={() => router.push(`/programs/detail?programId=${activeProgram.id}` as any)}
              accessibilityLabel={`${t('programs.active')}: ${activeProgram.name}`}
            >
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-text font-extrabold text-lg flex-1 mr-3" numberOfLines={2}>
                  {activeProgram.name}
                </Text>
                <View className="bg-successSurface rounded-full px-2.5 py-1">
                  <Text className="text-successText text-xs font-bold">
                    {t('programs.active')}
                  </Text>
                </View>
              </View>

              {activeProgram.description ? (
                <Text className="text-subtext text-sm mb-3">
                  {activeProgram.description}
                </Text>
              ) : null}

              {/* Metadata (Plain Text, No Pills) */}
              <View className="border-t border-border/50 pt-3 mt-3 gap-2">
                <Text className="text-subtext text-xs font-semibold">
                  {t('programs.weeksHeading')}: <Text className="text-text font-bold">
                    {currentWeek
                      ? t('programs.weekOf', { current: currentWeek, total: activeProgram.weeksDuration })
                      : t('programs.weeksDuration', { weeks: activeProgram.weeksDuration })
                    }
                  </Text>
                </Text>

                {currentPhase && (
                  <Text className="text-subtext text-xs font-semibold">
                    {t('programs.phase')}: <Text className="text-text font-bold">
                      {getPhaseLabel(currentPhase, t)}
                    </Text>
                  </Text>
                )}

                {weeksUntilDeload !== null && weeksUntilDeload > 0 && (
                  <View className="flex-row items-center gap-1.5">
                    <Svg accessible={false} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <Circle cx="12" cy="12" r="10" />
                      <Polyline points="12 6 12 12 16 14" />
                    </Svg>
                    <Text className="text-subtext text-xs font-semibold">
                      {t('programs.deloadIn', { weeks: weeksUntilDeload })}
                    </Text>
                  </View>
                )}

                {activeGoalInfo && (
                  <Text className="text-subtext text-xs font-semibold">
                    {t('programs.goal')}: <Text className="text-text font-bold">
                      {activeGoalInfo.emoji} {activeGoalInfo.label}
                    </Text>
                  </Text>
                )}
              </View>
            </Card>
          </View>
        )}

        {/* Archived Programs */}
        {archivedPrograms.length > 0 && (
          <View className="mt-2">
            <SectionHeader label={t('programs.archived')} className="mb-2" />
            <View className="border-t border-border/50">
              {archivedPrograms.map((program, index) => (
                <TouchableOpacity
                  key={program.id}
                  onPress={() => router.push(`/programs/detail?programId=${program.id}` as any)}
                  className={`py-3 flex-row justify-between items-center min-h-[44px] ${
                    index < archivedPrograms.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={program.name}
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-text font-bold text-base" numberOfLines={2}>
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
                    <Svg accessible={false} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <Polyline points="9 18 15 12 9 6" />
                    </Svg>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
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
