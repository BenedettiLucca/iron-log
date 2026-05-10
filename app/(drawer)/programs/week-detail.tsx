import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePrograms } from '@/hooks/use-programs';
import { useI18n } from '@/src/i18n';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState, ErrorState } from '@/components/ScreenState';
import { resolveScreenState } from '@/src/utils/screen-state';
import { logger } from '@/services/logger';
import type { Session, WeekCompletionStatus } from '@/src/types';

export default function WeekDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { programId, weekNumber: initialWeek } = useLocalSearchParams<{ programId: string; weekNumber: string }>();
  const { 
    activeProgram, 
    fetchProgramDetails, 
    weeks, 
    weekCompletionMap, 
    fetchDashboardData,
    getSessionsForWeek,
    isLoading,
    detailError
  } = usePrograms();
  
  const [selectedWeek, setSelectedWeek] = useState(parseInt(initialWeek || '1'));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    if (programId) {
      try {
        setHasError(false);
        await fetchProgramDetails(parseInt(programId));
      } catch (e) {
        logger.error('Failed to load program week detail', e);
        setHasError(true);
        setErrorMessage(t('states.errorBody'));
      }
    }
  }, [programId, fetchProgramDetails, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeProgram) {
      fetchDashboardData();
    }
  }, [activeProgram, fetchDashboardData]);

  const loadSessions = useCallback(async () => {
    if (!activeProgram) return;
    try {
      const data = await getSessionsForWeek(selectedWeek);
      setSessions(data);
    } catch (e) {
      logger.error('Failed to load sessions for week', e);
    }
  }, [activeProgram, selectedWeek, getSessionsForWeek]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const { status } = resolveScreenState({
    isLoading: isLoading && weeks.length === 0,
    hasError: hasError || !!detailError,
    hasContent: weeks.length > 0,
    errorMessage: errorMessage || detailError || undefined
  });

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return <ErrorState message={errorMessage || detailError || undefined} onRetry={loadData} />;
  }

  const getStatusEmoji = (status: WeekCompletionStatus) => {
    switch (status) {
      case 'done': return '✅';
      case 'missed': return '❌';
      case 'deload': return '💚';
      default: return '';
    }
  };

  const getStatusBg = (status: WeekCompletionStatus, isSelected: boolean) => {
    if (isSelected) return 'bg-primary border-2 border-primary';
    switch (status) {
      case 'done': return 'bg-green-500/10 border border-green-500/30';
      case 'missed': return 'bg-red-500/10 border border-red-500/30';
      case 'deload': return 'bg-green-500/20 border border-green-500/50';
      case 'future': return 'bg-card border border-border opacity-50';
      default: return 'bg-card border border-border';
    }
  };

  const selectedWeekData = weeks.find(w => w.weekNumber === selectedWeek);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-text font-black text-2xl">
          {t('programs.weekNumber', { num: selectedWeek })}
          {selectedWeekData ? ` — ${t(`programs.phases.${selectedWeekData.phase}`)}` : ''}
        </Text>
      </View>

      {/* Week Grid */}
      <View className="px-4 mb-6">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 8 }}>
          {weeks.map((w) => {
            const status = weekCompletionMap.get(w.weekNumber) || 'future';
            const isSelected = selectedWeek === w.weekNumber;
            return (
              <TouchableOpacity
                key={w.id}
                onPress={() => setSelectedWeek(w.weekNumber)}
                className={`w-12 h-12 rounded-xl justify-center items-center ${getStatusBg(status, isSelected)}`}
              >
                <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-text'}`}>{w.weekNumber}</Text>
                {!isSelected && <Text className="text-2xs mt-0.5">{getStatusEmoji(status)}</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1 px-4">
        <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">
          {t('programs.dashboard.sessions')}
        </Text>

        {sessions.length > 0 ? (
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
                      {new Date(session.startTime).toLocaleDateString()} • {session.durationMinutes} min
                    </Text>
                  </View>
                  {session.sRpe && (
                    <View className="bg-primary/10 px-2 py-1 rounded">
                      <Text className="text-primary font-bold text-xs">sRPE {session.sRpe}</Text>
                    </View>
                  )}
                </View>
              </Card>
            </View>
          ))
        ) : (
          <View className="mt-8">
            <EmptyState
              icon="∅"
              title={t('programs.dashboard.noSessions')}
              description={t('programs.dashboard.weekStatus.' + (weekCompletionMap.get(selectedWeek) || 'future'))}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
