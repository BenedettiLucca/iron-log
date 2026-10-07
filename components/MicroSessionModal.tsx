import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '@/src/db/client';
import { exercises, sets } from '@/src/db/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';
import {
  resumeMicroSession,
  addMicroSet,
  finishMicroSession,
  discardMicroSession,
  MicroSetLimitError,
} from '@/services/MicroSessionService';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useI18n } from '@/src/i18n';
import { Button } from './Button';
import { Card } from './Card';
import { parseLocalizedDecimal } from '@/src/utils/localized-decimal';
import Svg, { Path } from 'react-native-svg';

export interface MicroSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onFinished: () => void;
}

interface LoggedMicroSet {
  id: number;
  exerciseId: number;
  exerciseName: string;
  weightKg: number;
  reps: number;
}

interface ExerciseOption {
  id: number;
  name: string;
}

export function MicroSessionModal({
  visible,
  onClose,
  onFinished,
}: MicroSessionModalProps) {
  const { t } = useI18n();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();

  const [availableExercises, setAvailableExercises] = useState<ExerciseOption[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [weightText, setWeightText] = useState('20');
  const [repsText, setRepsText] = useState('10');
  const [loggedSets, setLoggedSets] = useState<LoggedMicroSet[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setErrorMessage(null);
      // 1. Fetch exercises
      const exList = await db
        .select({ id: exercises.id, name: exercises.name })
        .from(exercises)
        .orderBy(asc(exercises.name));
      setAvailableExercises(exList);
      if (exList.length > 0 && !selectedExerciseId) {
        setSelectedExerciseId(exList[0].id);
      }

      // 2. Check for active micro session
      const active = resumeMicroSession();
      if (active) {
        setActiveSessionId(active.id);
        const setRows = await db
          .select({
            id: sets.id,
            exerciseId: sets.exerciseId,
            exerciseName: sets.exerciseName,
            weightKg: sets.weightKg,
            reps: sets.reps,
          })
          .from(sets)
          .where(and(eq(sets.sessionId, active.id), isNull(sets.deletedAt)))
          .orderBy(asc(sets.id));

        setLoggedSets(
          setRows.map((s) => ({
            id: s.id,
            exerciseId: s.exerciseId,
            exerciseName: s.exerciseName || 'Exercício',
            weightKg: s.weightKg,
            reps: s.reps,
          }))
        );
      } else {
        setActiveSessionId(null);
        setLoggedSets([]);
      }
    } catch {
      setErrorMessage(t('states.errorBody'));
    }
  }, [selectedExerciseId, t]);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

  const handleAddSet = useCallback(() => {
    if (!selectedExerciseId) return;
    setErrorMessage(null);

    const parsedWeight = parseLocalizedDecimal(weightText, { allowNegative: false });
    const weightVal = parsedWeight.status === 'valid' ? parsedWeight.value : parseFloat(weightText);
    const repsVal = parseInt(repsText, 10);

    if (isNaN(weightVal) || weightVal <= 0) {
      setErrorMessage(t('exercise.invalidWeight'));
      return;
    }

    if (isNaN(repsVal) || repsVal <= 0) {
      setErrorMessage(t('exercise.invalidReps'));
      return;
    }

    try {
      addMicroSet({
        exerciseId: selectedExerciseId,
        weightKg: weightVal,
        reps: repsVal,
      });

      // Reload sets
      loadData();
    } catch (err) {
      if (
        err instanceof MicroSetLimitError ||
        (typeof err === 'object' && err !== null && 'code' in err && err.code === 'MICRO_SET_LIMIT_EXCEEDED')
      ) {
        setErrorMessage(t('microSession.singleSetLimit'));
      } else {
        setErrorMessage(t('states.errorBody'));
      }
    }
  }, [selectedExerciseId, weightText, repsText, loadData, t]);

  const handleFinish = useCallback(async () => {
    if (loggedSets.length === 0) {
      setErrorMessage(t('microSession.emptySetsError'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await finishMicroSession({ sessionId: activeSessionId ?? undefined });
      onFinished();
    } catch {
      setErrorMessage(t('states.errorBody'));
    } finally {
      setIsSubmitting(false);
    }
  }, [loggedSets.length, activeSessionId, onFinished, t]);

  const handleDiscard = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await discardMicroSession(activeSessionId ?? undefined);
      setActiveSessionId(null);
      setLoggedSets([]);
      onClose();
    } catch {
      setErrorMessage(t('states.errorBody'));
    } finally {
      setIsSubmitting(false);
    }
  }, [activeSessionId, onClose, t]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/60"
      >
        <View
          style={{ paddingTop: 16, paddingBottom: 24 + insets.bottom }}
          className="bg-card rounded-t-3xl px-4 max-h-[90%]"
        >
          {/* Header */}
          <View className="flex-row justify-between items-center pb-3 border-b border-border">
            <View>
              <Text className="text-xl font-bold text-text">
                {t('microSession.title')}
              </Text>
              <Text className="text-xs text-subtext mt-0.5">
                {t('microSession.singleSetLimit')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              className="w-11 h-11 items-center justify-center rounded-full bg-background"
            >
              <Svg width="18" height="18" viewBox="0 0 24 24" stroke={theme.subtext} strokeWidth="2.5" fill="none" accessible={false}>
                <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="py-2">
            {errorMessage ? (
              <View className="bg-dangerSurface border border-dangerText/30 rounded-xl p-3 my-2">
                <Text className="text-dangerText text-xs font-semibold">{errorMessage}</Text>
              </View>
            ) : null}

            {/* Exercise Selector */}
            <Text className="text-xs font-bold text-subtext uppercase tracking-wider mt-3 mb-2">
              {t('microSession.selectExercise')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            >
              {availableExercises.map((ex) => {
                const isSelected = selectedExerciseId === ex.id;
                const isLogged = loggedSets.some((s) => s.exerciseId === ex.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => setSelectedExerciseId(ex.id)}
                    className={`px-3.5 py-2 rounded-xl border min-h-[44px] justify-center items-center ${
                      isSelected
                        ? 'bg-primary border-transparent'
                        : isLogged
                        ? 'bg-successSurface border-successText/40'
                        : 'bg-background border-border'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        isSelected
                          ? 'text-onPrimary'
                          : isLogged
                          ? 'text-successText'
                          : 'text-text'
                      }`}
                    >
                      {ex.name} {isLogged ? '✓' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Weight and Reps Inputs */}
            <View className="flex-row gap-3 mt-3">
              <View className="flex-1">
                <Text className="text-xs font-bold text-subtext uppercase tracking-wider mb-1">
                  {t('microSession.weight')}
                </Text>
                <TextInput
                  value={weightText}
                  onChangeText={setWeightText}
                  keyboardType="decimal-pad"
                  className="bg-background border border-border rounded-xl px-3 py-2.5 text-text font-bold text-base min-h-[44px]"
                  placeholder="0"
                  placeholderTextColor={theme.subtext}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-subtext uppercase tracking-wider mb-1">
                  {t('microSession.reps')}
                </Text>
                <TextInput
                  value={repsText}
                  onChangeText={setRepsText}
                  keyboardType="number-pad"
                  className="bg-background border border-border rounded-xl px-3 py-2.5 text-text font-bold text-base min-h-[44px]"
                  placeholder="0"
                  placeholderTextColor={theme.subtext}
                />
              </View>
            </View>

            {/* Add Set Button */}
            <View className="mt-4">
              <Button
                title={t('microSession.addSet')}
                onPress={handleAddSet}
                variant="secondary"
                size="md"
              />
            </View>

            {/* Logged Sets Summary */}
            <View className="mt-5">
              <Text className="text-xs font-bold text-subtext uppercase tracking-wider mb-2">
                {t('microSession.loggedSets')} ({loggedSets.length})
              </Text>
              {loggedSets.length === 0 ? (
                <Text className="text-subtext text-xs italic py-2">
                  {t('microSession.noSetsLogged')}
                </Text>
              ) : (
                loggedSets.map((s, index) => (
                  <Card key={s.id || index} className="mb-2 bg-background/60">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-text font-bold text-sm">
                        {s.exerciseName}
                      </Text>
                      <Text className="text-subtext font-semibold text-xs">
                        {s.weightKg} kg × {s.reps} reps
                      </Text>
                    </View>
                  </Card>
                ))
              )}
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View className="flex-row gap-3 pt-3 border-t border-border mt-2">
            <Button
              title={t('microSession.discard')}
              onPress={handleDiscard}
              variant="danger"
              size="md"
              disabled={isSubmitting || loggedSets.length === 0}
              style={{ flex: 1 }}
            />
            <Button
              title={t('microSession.finish')}
              onPress={handleFinish}
              variant="primary"
              size="md"
              loading={isSubmitting}
              disabled={isSubmitting || loggedSets.length === 0}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
