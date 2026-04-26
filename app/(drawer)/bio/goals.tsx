import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { db } from '../../../src/db/client';
import { measurementGoals } from '../../../src/db/schema';
import { desc, eq } from 'drizzle-orm';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { DatePicker } from '@/components/DatePicker';
import { logger } from '@/services/logger';
import { goalInputSchema } from '@/src/validators/forms';

type MeasurementType = 'weight' | 'waist' | 'armRight' | 'thighRight' | 'chest' | 'calf';

const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  weight: 'Peso (kg)',
  waist: 'Cintura (cm)',
  armRight: 'Braço Direito (cm)',
  thighRight: 'Coxa Direita (cm)',
  chest: 'Tórax (cm)',
  calf: 'Panturrilha (cm)',
};

export default function GoalsScreen() {
  const [goals, setGoals] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGoal, setNewGoal] = useState({
    type: 'weight' as MeasurementType,
    targetValue: '',
    targetDate: null as Date | null,
  });
  const [dialog, setDialog] = useState({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const data = await db.select().from(measurementGoals).orderBy(desc(measurementGoals.targetDate));
      setGoals(data);
    } catch (error) {
      logger.error('Operation failed', 'Error loading goals:', error);
    }
  };

  const addGoal = async () => {
    try {
      if (!newGoal.targetDate) {
        return;
      }

      // Validate with Zod
      const validation = goalInputSchema.safeParse({
        type: newGoal.type,
        targetValue: newGoal.targetValue,
        targetDate: newGoal.targetDate,
      });
      if (!validation.success) {
        const msg = validation.error.errors[0]?.message || 'Dados inválidos';
        logger.warn('Goal validation failed:', msg);
        return;
      }

      const targetDate = validation.data.targetDate.getTime();
      const startDate = Date.now();

      await db.insert(measurementGoals).values({
        type: validation.data.type,
        targetValue: validation.data.targetValue,
        startDate,
        targetDate,
        achieved: false,
      });

      setModalVisible(false);
      setNewGoal({ type: 'weight', targetValue: '', targetDate: null });
      loadGoals();
    } catch (error) {
      logger.error('Operation failed', 'Error adding goal:', error);
    }
  };

  const deleteGoal = async (id: number) => {
    setDialog({
      visible: true,
      title: 'Excluir Meta',
      message: 'Tem certeza que deseja excluir esta meta?',
      onConfirm: async () => {
        try {
          await db.delete(measurementGoals).where(eq(measurementGoals.id, id));
          loadGoals();
        } catch (error) {
          logger.error('Operation failed', 'Error deleting goal:', error);
        }
      },
    });
  };

  const getDaysRemaining = (targetDate: number) => {
    const days = Math.ceil((targetDate - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Metas' }} />

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16 }}>
        <Button
          title="Nova Meta"
          onPress={() => setModalVisible(true)}
          variant="primary"
          fullWidth
        />

        {goals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="Nenhuma meta definida"
            description="Defina metas para suas métricas corporais e acompanhe seu progresso."
          />
        ) : (
          goals.map((goal) => (
            <Card key={goal.id}>
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                  <Text className="text-text font-bold text-lg mb-1">
                    {MEASUREMENT_LABELS[goal.type as MeasurementType]}
                  </Text>
                  <Text className="text-subtext text-xs">
                    Meta: {goal.targetValue} • {getDaysRemaining(goal.targetDate)} dias restantes
                  </Text>
                </View>
                {goal.achieved && (
                  <View className="bg-success/10 px-2 py-1 rounded-lg">
                    <Text className="text-success text-xs font-bold uppercase">Alcançada!</Text>
                  </View>
                )}
              </View>

              <View className="flex-row gap-2 mt-3">
                <Button
                  title="Excluir"
                  onPress={() => deleteGoal(goal.id)}
                  variant="danger"
                  size="sm"
                  fullWidth
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background p-4">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-text text-xl font-bold uppercase">Nova Meta</Text>
            <Button title="Fechar" onPress={() => setModalVisible(false)} variant="ghost" size="sm" />
          </View>

          <ScrollView contentContainerStyle={{ gap: 16 }}>
            <View>
              <Text className="text-subtext text-xs font-bold uppercase mb-3">Tipo de Medida</Text>
              <View className="flex-row flex-wrap gap-2">
                {(Object.keys(MEASUREMENT_LABELS) as MeasurementType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setNewGoal({ ...newGoal, type })}
                    className={`px-4 py-2 rounded-lg border-2 ${
                      newGoal.type === type
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold uppercase ${
                        newGoal.type === type ? 'text-primary' : 'text-subtext'
                      }`}
                    >
                      {MEASUREMENT_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Input
              label="Valor Alvo"
              keyboardType="numeric"
              value={newGoal.targetValue}
              onChangeText={(text) => setNewGoal({ ...newGoal, targetValue: text })}
              placeholder="00.0"
            />

            <DatePicker
              label="Data Alvo"
              value={newGoal.targetDate}
              onChange={(date) => setNewGoal({ ...newGoal, targetDate: date })}
              placeholder="Selecione a data"
              minimumDate={new Date()}
            />

            <Button
              title="Criar Meta"
              onPress={addGoal}
              variant="success"
              size="lg"
              fullWidth
              style={{ marginTop: 20 }}
            />
          </ScrollView>
        </View>
      </Modal>

      <Dialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onConfirm={() => {
          dialog.onConfirm();
          setDialog({ ...dialog, visible: false });
        }}
        onCancel={() => setDialog({ ...dialog, visible: false })}
      />
    </View>
  );
}
