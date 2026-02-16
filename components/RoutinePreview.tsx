import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Modal } from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { db } from '../src/db/client';
import { routineExercises, exercises } from '../src/db/schema';
import { eq } from 'drizzle-orm';

interface RoutinePreviewProps {
  visible: boolean;
  routineId: number | null;
  onClose: () => void;
  onStart: () => void;
  routineName?: string;
}

interface ExercisePreview {
  id: number;
  name: string;
  target?: string | null;
  restSeconds?: number | null;
  notes?: string | null;
  type?: string;
}

export function RoutinePreview({ visible, routineId, onClose, onStart, routineName }: RoutinePreviewProps) {
  const [exerciseList, setExerciseList] = useState<ExercisePreview[]>([]);
  const [loading, setLoading] = useState(false);

  const loadExercises = useCallback(async () => {
    if (!routineId) return;
    setLoading(true);
    
    try {
      const result = await db
        .select({
          id: exercises.id,
          name: exercises.name,
          type: exercises.type,
          target: routineExercises.target,
          restSeconds: routineExercises.restSeconds,
          notes: routineExercises.notes,
          orderIndex: routineExercises.orderIndex,
        })
        .from(routineExercises)
        .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
        .where(eq(routineExercises.routineId, routineId))
        .orderBy(routineExercises.orderIndex);

      setExerciseList(result as unknown as ExercisePreview[]);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => {
    if (visible && routineId) {
      loadExercises();
    }
  }, [visible, routineId, loadExercises]);

  const estimatedDuration = () => {
    // Rough estimate: 2 mins per exercise (setup + rest) + actual work time
    const workTimePerExercise = 3; // minutes
    const totalExerciseCount = exerciseList.length;
    if (totalExerciseCount === 0) return 0;
    return Math.max(15, totalExerciseCount * workTimePerExercise);
  };

  const formatRest = (seconds?: number | null) => {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row justify-between items-center p-4 border-b border-border">
          <View>
            <Text className="text-subtext text-xs font-bold uppercase tracking-wider">Pré-visualização</Text>
            <Text className="text-text text-xl font-bold" numberOfLines={1}>{routineName || 'Rotina'}</Text>
          </View>
          <Button title="Fechar" onPress={onClose} variant="ghost" size="sm" />
        </View>

        {/* Content */}
        <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16 }}>
          {/* Quick Stats */}
          <View className="flex-row gap-3">
            <Card className="flex-1 items-center py-4 bg-primary/5">
              <Text className="text-primary text-3xl font-bold">{exerciseList.length}</Text>
              <Text className="text-subtext text-xs font-semibold mt-1 uppercase">Exercícios</Text>
            </Card>
            <Card className="flex-1 items-center py-4 bg-primary/5">
              <Text className="text-primary text-3xl font-bold">~{estimatedDuration()}</Text>
              <Text className="text-subtext text-xs font-semibold mt-1 uppercase">Minutos</Text>
            </Card>
          </View>

          {/* Exercise List */}
          <View>
            <Text className="text-subtext text-xs font-bold uppercase mb-4 tracking-wider">Sequência de Exercícios</Text>
            
            {loading ? (
              <Card className="items-center py-8">
                <Text className="text-subtext">Carregando...</Text>
              </Card>
            ) : exerciseList.length === 0 ? (
              <Card className="items-center py-8">
                <Text className="text-subtext">Nenhum exercício encontrado</Text>
              </Card>
            ) : (
              <View className="gap-3">
                {exerciseList.map((exercise: ExercisePreview, index: number) => (
                  <Card key={exercise.id} className="flex-row items-center py-3">
                    {/* Number Badge */}
                    <View className="w-8 h-8 rounded-full bg-primary/10 justify-center items-center mr-3">
                      <Text className="text-primary font-bold text-sm">{index + 1}</Text>
                    </View>
                    
                    {/* Exercise Info */}
                    <View className="flex-1">
                      <Text className="text-text font-bold text-base">{exercise.name}</Text>
                      <View className="flex-row items-center gap-2 mt-0.5">
                        {exercise.target && (
                          <Text className="text-subtext text-xs bg-background px-2 py-0.5 rounded">
                            {exercise.target}
                          </Text>
                        )}
                        {exercise.restSeconds && (
                          <Text className="text-subtext text-xs">
                            ⏱️ {formatRest(exercise.restSeconds)}
                          </Text>
                        )}
                        {exercise.type === 'duration' && (
                          <Text className="text-secondary text-xs">⏱️ Duração</Text>
                        )}
                      </View>
                      {exercise.notes && (
                        <Text className="text-subtext text-xs mt-1 italic" numberOfLines={1}>
                          {exercise.notes}
                        </Text>
                      )}
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View className="p-4 border-t border-border bg-card">
          <Button
            title="Iniciar Treino"
            onPress={onStart}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>
      </View>
    </Modal>
  );
}
