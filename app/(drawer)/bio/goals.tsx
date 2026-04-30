import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { db } from '../../../src/db/client';
import { measurementGoals } from '../../../src/db/schema';
import { desc, eq, InferSelectModel } from 'drizzle-orm';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { DatePicker } from '@/components/DatePicker';
import { logger } from '@/services/logger';
import { goalInputSchema } from '@/src/validators/forms';
import { useI18n } from '../../../src/i18n/index';

type MeasurementType = 'weight' | 'waist' | 'armRight' | 'thighRight' | 'chest' | 'calf';

export default function GoalsScreen() {
  const { t } = useI18n();
  const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
    weight: t('bioGoals.weight'),
    waist: t('bioGoals.waist'),
    armRight: t('bioGoals.armRight'),
    thighRight: t('bioGoals.thighRight'),
    chest: t('bioGoals.chest'),
    calf: t('bioGoals.calf'),
  };
  const [goals, setGoals] = useState<InferSelectModel<typeof measurementGoals>[]>([]);
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
      logger.error('Error loading goals', error);
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
        const msg = validation.error.issues[0]?.message || t('common.invalidData');
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
      logger.error('Error adding goal', error);
    }
  };

  const deleteGoal = async (id: number) => {
    setDialog({
      visible: true,
      title: t('bioGoals.deleteGoal'),
      message: t('bioGoals.deleteGoalConfirm'),
      onConfirm: async () => {
        try {
          await db.delete(measurementGoals).where(eq(measurementGoals.id, id));
          loadGoals();
        } catch (error) {
          logger.error('Error deleting goal', error);
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
      <Stack.Screen options={{ title: t('bioNav.goals') }} />

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16 }}>
        <Button
          title={t("bioGoals.newGoal")}
          onPress={() => setModalVisible(true)}
          variant="primary"
          fullWidth
        />

        {goals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title={t("bioGoals.noGoals")}
            description={t("bioGoals.emptyDesc")}
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
                    {t('bioGoals.goalStatus', { target: goal.targetValue, days: getDaysRemaining(goal.targetDate) })}
                  </Text>
                </View>
                {goal.achieved && (
                  <View className="bg-success/10 px-2 py-1 rounded-lg">
                    <Text className="text-success text-xs font-bold uppercase">{t("bioGoals.achieved")}</Text>
                  </View>
                )}
              </View>

              <View className="flex-row gap-2 mt-3">
                <Button
                  title={t("bioGoals.delete")}
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
            <Text className="text-text text-xl font-bold uppercase">{t("bioGoals.newGoal")}</Text>
            <Button title={t("common.close")} onPress={() => setModalVisible(false)} variant="ghost" size="sm" />
          </View>

          <ScrollView contentContainerStyle={{ gap: 16 }}>
            <View>
              <Text className="text-subtext text-xs font-bold uppercase mb-3">{t("bioGoals.measurementType")}</Text>
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
              label={t('bioGoals.targetValue')}
              keyboardType="numeric"
              value={newGoal.targetValue}
              onChangeText={(text) => setNewGoal({ ...newGoal, targetValue: text })}
              placeholder="00.0"
            />

            <DatePicker
              label={t('bioGoals.targetDate')}
              value={newGoal.targetDate}
              onChange={(date) => setNewGoal({ ...newGoal, targetDate: date })}
              placeholder={t("bioGoals.selectDate")}
              minimumDate={new Date()}
            />

            <Button
              title={t("bioGoals.createGoal")}
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
