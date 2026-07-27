import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { db } from '../../src/db/client';
import { measurementGoals, bodyMetrics } from '../../src/db/schema';
import { desc, eq, InferSelectModel } from 'drizzle-orm';
import { BodyMetric, MeasurementGoalType } from '@/src/types';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Dialog } from '@/components/Dialog';
import { DatePicker } from '@/components/DatePicker';
import { ProgressBar } from '@/components/ProgressBar';
import { LoadingState, ErrorState } from '@/components/ScreenState';
import { logger } from '@/services/logger';
import { goalInputSchema } from '@/src/validators/forms';
import { useI18n, getLocaleForLanguage } from '../../src/i18n/index';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/use-toast';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { calculateGoalProgress, findGoalBaseline } from '../../src/utils/goal-progress';

type MeasurementType = 'weight' | 'waist' | 'armRight' | 'thighRight' | 'chest' | 'calf';

function ArrowRightIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12h14M12 5l7 7-7 7" />
    </Svg>
  );
}

export default function GoalsScreen() {
  const { t, language } = useI18n();
  const themeColors = useThemeColors();
  const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
    weight: t('bioGoals.weight'),
    waist: t('bioGoals.waist'),
    armRight: t('bioGoals.armRight'),
    thighRight: t('bioGoals.thighRight'),
    chest: t('bioGoals.chest'),
    calf: t('bioGoals.calf'),
  };

  const [goals, setGoals] = useState<InferSelectModel<typeof measurementGoals>[]>([]);
  const [allMetrics, setAllMetrics] = useState<BodyMetric[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const operationLockRef = useRef(false);
  const { toast, showToast, setToast } = useToast();

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
      setLoading(true);
      setHasError(false);
      const goalsData = await db.select().from(measurementGoals).orderBy(desc(measurementGoals.targetDate));
      setGoals(goalsData);

      const metricsData = await db.select().from(bodyMetrics).orderBy(desc(bodyMetrics.date));
      setAllMetrics(metricsData as BodyMetric[]);

      const latest: Record<string, number | null> = {
        weight: null,
        waist: null,
        armRight: null,
        thighRight: null,
        chest: null,
        calf: null,
      };

      for (const m of metricsData) {
        if (latest.weight === null && m.weight !== null) latest.weight = m.weight;
        if (latest.waist === null && m.waist !== null) latest.waist = m.waist;
        if (latest.armRight === null && m.armRight !== null) latest.armRight = m.armRight;
        if (latest.thighRight === null && m.thighRight !== null) latest.thighRight = m.thighRight;
        if (latest.chest === null && m.chest !== null) latest.chest = m.chest;
        if (latest.calf === null && m.calf !== null) latest.calf = m.calf;
      }
      setLatestMetrics(latest);
    } catch (error) {
      logger.error('Error loading goals', error);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  const saveGoal = async () => {
    if (operationLockRef.current || isSaving) return;

    if (!newGoal.targetDate) {
      showToast(t('bioGoals.dateRequired'), 'error');
      return;
    }

    const validation = goalInputSchema.safeParse({
      type: newGoal.type,
      targetValue: newGoal.targetValue,
      targetDate: newGoal.targetDate,
    });
    if (!validation.success) {
      const msg = validation.error.issues[0]?.message || t('common.invalidData');
      logger.warn('Goal validation failed:', msg);
      showToast(t('common.invalidData'), 'error');
      return;
    }

    operationLockRef.current = true;
    setIsSaving(true);
    try {
      const targetDate = validation.data.targetDate.getTime();

      if (editingGoalId !== null) {
        await db.update(measurementGoals)
          .set({
            type: validation.data.type,
            targetValue: validation.data.targetValue,
            targetDate,
            achieved: false,
            achievedDate: null,
          })
          .where(eq(measurementGoals.id, editingGoalId));
      } else {
        await db.insert(measurementGoals).values({
          type: validation.data.type,
          targetValue: validation.data.targetValue,
          startDate: Date.now(),
          targetDate,
          achieved: false,
        });
      }

      await loadGoals();
      setModalVisible(false);
      setEditingGoalId(null);
      setNewGoal({ type: 'weight', targetValue: '', targetDate: null });
      showToast(t('common.saveSuccess'), 'success');
    } catch (error) {
      logger.error('Error saving goal', error);
      showToast(t('common.operationError'), 'error');
    } finally {
      operationLockRef.current = false;
      setIsSaving(false);
    }
  };

  const deleteGoal = (id: number) => {
    setDialog({
      visible: true,
      title: t('bioGoals.deleteGoal'),
      message: t('bioGoals.deleteGoalConfirm'),
      onConfirm: async () => {
        if (operationLockRef.current) return;
        operationLockRef.current = true;
        setIsDeleting(true);
        try {
          await db.delete(measurementGoals).where(eq(measurementGoals.id, id));
          await loadGoals();
          showToast(t('common.deleteSuccess'), 'success');
        } catch (error) {
          logger.error('Error deleting goal', error);
          showToast(t('common.operationError'), 'error');
        } finally {
          operationLockRef.current = false;
          setIsDeleting(false);
          setDialog(prev => ({ ...prev, visible: false }));
        }
      },
    });
  };

  const openEditModal = (goal: InferSelectModel<typeof measurementGoals>) => {
    setEditingGoalId(goal.id);
    setNewGoal({
      type: goal.type as MeasurementType,
      targetValue: goal.targetValue.toString(),
      targetDate: new Date(goal.targetDate),
    });
    setModalVisible(true);
  };

  const openAddModal = () => {
    setEditingGoalId(null);
    setNewGoal({
      type: 'weight',
      targetValue: '',
      targetDate: null,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingGoalId(null);
    setNewGoal({
      type: 'weight',
      targetValue: '',
      targetDate: null,
    });
  };

  const getDaysRemaining = (targetDate: number) => {
    const days = Math.ceil((targetDate - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (loading) {
    return <LoadingState />;
  }

  if (hasError) {
    return <ErrorState onRetry={loadGoals} />;
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        {!loading && !hasError && goals.length === 0 ? (
          <View className="border border-dashed border-border rounded-2xl p-6 bg-card items-center">
            <Text className="text-5xl mb-4">🎯</Text>
            <Text className="text-text text-lg font-bold text-center mb-2">{t("bioGoals.noGoals")}</Text>
            <Text className="text-subtext text-sm text-center leading-5">{t("bioGoals.emptyDesc")}</Text>
          </View>
        ) : (
          goals.map((goal) => {
            const currentVal = latestMetrics[goal.type] ?? null;
            const initialVal = findGoalBaseline(allMetrics, goal.type as MeasurementGoalType, goal.startDate);

            const { progress, isCompleted } = calculateGoalProgress(
              initialVal,
              currentVal,
              goal.targetValue,
              goal.achieved
            );

            const diff = currentVal !== null ? Math.abs(goal.targetValue - currentVal) : null;
            const unit = goal.type === 'weight' ? 'kg' : 'cm';
            const remainingText = isCompleted
              ? t('bioGoals.achieved')
              : diff !== null
                ? `${t('bioGoals.remaining')} ${diff.toFixed(1)} ${unit}`
                : '—';

            const daysLeft = getDaysRemaining(goal.targetDate);
            const deadlineFormatted = new Date(goal.targetDate).toLocaleDateString(getLocaleForLanguage(language));

            return (
              <Card key={goal.id}>
                {/* Header row */}
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-xs font-extrabold text-primaryText tracking-wider">
                    {MEASUREMENT_LABELS[goal.type as MeasurementType]}
                  </Text>
                  <Text className="text-xs text-subtext">
                    {deadlineFormatted} ({daysLeft}d)
                  </Text>
                </View>

                {/* Values row */}
                <View className="flex-row items-center gap-2 mb-3">
                  <Text className="text-xl font-extrabold text-text">
                    {currentVal !== null ? currentVal.toFixed(1) : '—'}
                    <Text className="text-xs text-subtext font-medium"> {unit}</Text>
                  </Text>
                  <ArrowRightIcon size={14} color={themeColors.subtext} />
                  <Text className="text-sm text-subtext font-medium">
                    {goal.targetValue.toFixed(1)} {unit}
                  </Text>
                </View>

                {/* Progress bar */}
                <View
                  className="w-full mb-2"
                  accessible={progress === null}
                  accessibilityLabel={progress === null ? t('bioGoals.progressUnavailable') : undefined}
                >
                  <ProgressBar
                    current={progress ?? 0}
                    total={100}
                    showLabel={false}
                    isAccessible={progress !== null}
                  />
                </View>

                {/* Progress info row */}
                <View className="flex-row justify-between mb-3">
                  <Text className="text-2xs font-bold text-subtext">
                    {progress !== null ? `${progress}% ${t('bioGoals.completed')}` : '—'}
                  </Text>
                  <Text className="text-2xs font-bold text-subtext">
                    {remainingText}
                  </Text>
                </View>

                {/* Actions row */}
                <View className="flex-row gap-2 mt-2">
                  <View className="flex-1">
                    <Button
                      title={t("common.edit")}
                      accessibilityLabel={t('bioGoals.editActionLabel', { name: MEASUREMENT_LABELS[goal.type as MeasurementType] })}
                      onPress={() => openEditModal(goal)}
                      variant="ghost"
                      size="sm"
                      fullWidth
                      disabled={isSaving || isDeleting}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      title={t("common.delete")}
                      accessibilityLabel={t('bioGoals.deleteActionLabel', { name: MEASUREMENT_LABELS[goal.type as MeasurementType] })}
                      onPress={() => deleteGoal(goal.id)}
                      variant="danger"
                      size="sm"
                      fullWidth
                      disabled={isSaving || isDeleting}
                    />
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Add Goal Button as Bottom CTA */}
      <View className="p-4 bg-background border-t border-border/20">
        <Button
          title={t("bioGoals.newGoal")}
          onPress={openAddModal}
          variant="primary"
          size="lg"
          fullWidth
          disabled={isSaving || isDeleting}
        />
      </View>

      {/* Add/Edit Goal Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View className="flex-1 bg-background p-4">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-text text-xl font-bold">
              {editingGoalId !== null ? t("bioGoals.editGoal") : t("bioGoals.newGoal")}
            </Text>
            <Button title={t("common.close")} onPress={closeModal} variant="ghost" size="sm" disabled={isSaving} />
          </View>

          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ gap: 16 }}
          >
            <View>
              <Text className="text-subtext text-xs font-bold mb-3">{t("bioGoals.measurementType")}</Text>
              <View className="flex-row flex-wrap gap-2">
                {(Object.keys(MEASUREMENT_LABELS) as MeasurementType[]).map((type) => {
                  const isActive = newGoal.type === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setNewGoal({ ...newGoal, type })}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      className={`px-4 py-2 rounded-full border min-h-[44px] items-center justify-center ${
                        isActive
                          ? 'bg-primary border-transparent'
                          : 'bg-card border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isActive ? 'text-onPrimary' : 'text-subtext'
                        }`}
                      >
                        {MEASUREMENT_LABELS[type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
              title={editingGoalId !== null ? t("common.save") : t("bioGoals.createGoal")}
              onPress={saveGoal}
              variant="success"
              size="lg"
              fullWidth
              style={{ marginTop: 20 }}
              loading={isSaving}
              disabled={isSaving}
            />
          </ScrollView>
        </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <Dialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onConfirm={dialog.onConfirm}
        onCancel={() => setDialog({ ...dialog, visible: false })}
      />
    </View>
  );
}
