import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePrograms } from '@/hooks/use-programs';
import { getLocaleForLanguage, useI18n } from '@/src/i18n';
import { Card } from '@/components/Card';
import { LoadingState, ErrorState } from '@/components/ScreenState';
import { resolveScreenState } from '@/src/utils/screen-state';
import { logger } from '@/services/logger';
import type { Session, WeekCompletionStatus } from '@/src/types';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { db } from '@/src/db/client';
import { routineExercises, exercises } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

export default function WeekDetailScreen() {
  const { t, language } = useI18n();
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
    detailError,
    getCurrentWeek,
  } = usePrograms();
  
  const [selectedWeek, setSelectedWeek] = useState(parseInt(initialWeek || '1'));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weekExercises, setWeekExercises] = useState<{ id: number; name: string; target: string | null; notes: string | null; restSeconds: number | null }[]>([]);
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

  const loadWeekExercises = useCallback(async () => {
    const currentWeekData = weeks.find(w => w.weekNumber === selectedWeek);
    if (currentWeekData?.routineId) {
      try {
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
          .where(eq(routineExercises.routineId, currentWeekData.routineId))
          .orderBy(routineExercises.orderIndex);
        setWeekExercises(data);
      } catch (e) {
        logger.error('Failed to load week exercises', e);
        setWeekExercises([]);
      }
    } else {
      setWeekExercises([]);
    }
  }, [selectedWeek, weeks]);

  useEffect(() => {
    loadWeekExercises();
  }, [loadWeekExercises]);

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

  const selectedWeekData = weeks.find(w => w.weekNumber === selectedWeek);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-16 pb-2">
        <View className="flex-row items-center gap-3">
          <SectionHeader label={t('programs.weekDetail') || 'Semana'} />
          {selectedWeekData && (
            <View className={`rounded-full px-2.5 py-0.5 ${
              selectedWeek === getCurrentWeek() ? 'bg-primary/10' :
              weekCompletionMap.get(selectedWeek) === 'done' ? 'bg-success/10' :
              weekCompletionMap.get(selectedWeek) === 'missed' ? 'bg-danger/10' :
              weekCompletionMap.get(selectedWeek) === 'deload' ? 'bg-accent/10' :
              'bg-card border border-border/50'
            }`}>
              <Text className={`text-2xs font-extrabold uppercase tracking-wider ${
                selectedWeek === getCurrentWeek() ? 'text-primary' :
                weekCompletionMap.get(selectedWeek) === 'done' ? 'text-success' :
                weekCompletionMap.get(selectedWeek) === 'missed' ? 'text-danger' :
                weekCompletionMap.get(selectedWeek) === 'deload' ? 'text-accent' :
                'text-subtext'
              }`}>
                {selectedWeek === getCurrentWeek() ? 'Atual' :
                 weekCompletionMap.get(selectedWeek) === 'done' ? 'Concluída' :
                 weekCompletionMap.get(selectedWeek) === 'missed' ? 'Perdida' :
                 weekCompletionMap.get(selectedWeek) === 'deload' ? 'Deload' :
                 'Pendente'}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-text font-black text-2xl mt-1">
          {t('programs.weekNumber', { num: selectedWeek })}
          {selectedWeekData ? ` — ${t(`programs.phases.${selectedWeekData.phase}`)}` : ''}
        </Text>
      </View>

      {/* Week Grid */}
      <View className="px-4 mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 8 }}>
          {weeks.map((w) => {
            const status = weekCompletionMap.get(w.weekNumber) || 'future';
            const isSelected = selectedWeek === w.weekNumber;
            
            let bgClass = 'bg-card border border-border opacity-50';
            let textClass = 'text-subtext';
            
            if (isSelected) {
              bgClass = 'bg-primary border-2 border-primary';
              textClass = 'text-white';
            } else {
              switch (status) {
                case 'done':
                  bgClass = 'bg-success/10 border border-success/20';
                  textClass = 'text-success';
                  break;
                case 'missed':
                  bgClass = 'bg-danger/10 border border-danger/20';
                  textClass = 'text-danger';
                  break;
                case 'deload':
                  bgClass = 'bg-accent/10 border border-accent/20';
                  textClass = 'text-accent';
                  break;
                case 'future':
                default:
                  bgClass = 'bg-card border border-border/50';
                  textClass = 'text-subtext';
                  break;
              }
            }

            return (
              <TouchableOpacity
                key={w.id}
                onPress={() => setSelectedWeek(w.weekNumber)}
                className={`w-12 h-12 rounded-xl justify-center items-center ${bgClass}`}
              >
                <Text className={`text-xs font-bold ${textClass}`}>{w.weekNumber}</Text>
                {!isSelected && <Text className="text-2xs mt-0.5">{getStatusEmoji(status)}</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {selectedWeekData && (
          <View className="mb-4">
            <SectionHeader label="Metas da Semana" className="mb-3" />
            <View className="flex-row gap-2.5">
              <StatTile
                value={selectedWeekData.rirTarget !== null ? `RIR ${selectedWeekData.rirTarget}` : 'N/A'}
                label="RIR Alvo"
                accentColor="primary"
                className="flex-1"
              />
              <StatTile
                value={selectedWeekData.intensityMod !== null ? `${Math.round(selectedWeekData.intensityMod * 100)}%` : '100%'}
                label="Intensidade"
                accentColor="secondary"
                className="flex-1"
              />
              <StatTile
                value={t(`programs.phases.${selectedWeekData.phase}`) || 'Acumulação'}
                label="Fase do Bloco"
                accentColor="warning"
                className="flex-1"
              />
            </View>
          </View>
        )}

        {/* Exercise List */}
        <View className="mb-4">
          <SectionHeader label="Exercícios Planejados" className="mb-3" />
          {weekExercises.length > 0 ? (
            weekExercises.map((ex, idx) => (
              <Card key={`${ex.id}-${idx}`} className="mb-2">
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-text font-bold text-base">{ex.name}</Text>
                    <View className="flex-row gap-3 mt-1">
                      {ex.target && (
                        <Text className="text-subtext text-xs">
                          Meta: {ex.target}
                        </Text>
                      )}
                      {ex.restSeconds && (
                        <Text className="text-subtext text-xs">
                          Rest: {ex.restSeconds}s
                        </Text>
                      )}
                    </View>
                    {ex.notes && (
                      <Text className="text-subtext text-xs italic mt-0.5">
                        Obs: {ex.notes}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Card>
              <Text className="text-subtext text-sm text-center py-4">
                Nenhuma rotina ou exercício planejado para esta semana
              </Text>
            </Card>
          )}
        </View>

        <SectionHeader label={t('programs.dashboard.sessions')} className="mb-3" />

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
                      {new Date(session.startTime).toLocaleDateString(getLocaleForLanguage(language))} • {session.durationMinutes} min
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
          <View className="my-2">
            <Card>
              <Text className="text-subtext text-sm text-center py-4">
                {t('programs.dashboard.noSessions') || 'Nenhum treino realizado nesta semana'}
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
