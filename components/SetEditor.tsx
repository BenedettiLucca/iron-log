import { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TextInput } from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/src/i18n/index';
import { parseEditedSetInput } from '@/src/validators/forms';

interface SetEditorProps {
  visible: boolean;
  setNumber: number;
  initialWeight: number;
  initialReps?: number;
  initialDuration?: number;
  initialRir?: number | null;
  isDuration: boolean;
  /** Async contract: must resolve true on persistence success, false otherwise. */
  onSave: (weight: number, reps?: number, duration?: number, rir?: number) => Promise<boolean>;
  onCancel: () => void;
}

export function SetEditor({
  visible,
  setNumber,
  initialWeight,
  initialReps,
  initialDuration,
  initialRir,
  isDuration,
  onSave,
  onCancel,
}: SetEditorProps) {
  const { trigger } = useHaptics();
  const { t } = useI18n();
  const [weight, setWeight] = useState(initialWeight.toString());
  const [reps, setReps] = useState(initialReps?.toString() ?? '');
  const [duration, setDuration] = useState(initialDuration?.toString() ?? '');
  const [rir, setRir] = useState(initialRir?.toString() ?? '2');
  const [isSaving, setIsSaving] = useState(false);

  // Field-level error messages
  const [weightError, setWeightError] = useState<string | undefined>();
  const [repsError, setRepsError] = useState<string | undefined>();
  const [durationError, setDurationError] = useState<string | undefined>();
  const [rirError, setRirError] = useState<string | undefined>();

  // Refs for focus management
  const weightRef = useRef<TextInput>(null);
  const repsRef = useRef<TextInput>(null);
  const durationRef = useRef<TextInput>(null);
  const rirRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setWeight(initialWeight.toString());
      setReps(initialReps?.toString() ?? '');
      setDuration(initialDuration?.toString() ?? '');
      setRir(initialRir?.toString() ?? '2');
      setIsSaving(false);
      setWeightError(undefined);
      setRepsError(undefined);
      setDurationError(undefined);
      setRirError(undefined);
    }
  }, [visible, initialWeight, initialReps, initialDuration, initialRir]);

  const clearErrors = () => {
    setWeightError(undefined);
    setRepsError(undefined);
    setDurationError(undefined);
    setRirError(undefined);
  };

  const handleSave = async () => {
    if (isSaving) return;

    clearErrors();

    const result = parseEditedSetInput({ weight, reps, duration, rir, isDuration });

    if (!result.ok) {
      // Show field-level errors
      if (result.errors.weight) setWeightError(t('exercise.enterWeight'));
      if (result.errors.reps) setRepsError(t('exercise.enterReps'));
      if (result.errors.duration) setDurationError(t('exercise.enterDuration'));
      if (result.errors.rir) setRirError(t('setEditor.invalidRir'));

      // Focus first invalid field
      switch (result.firstErrorField) {
        case 'weight': weightRef.current?.focus(); break;
        case 'reps': repsRef.current?.focus(); break;
        case 'duration': durationRef.current?.focus(); break;
        case 'rir': rirRef.current?.focus(); break;
      }
      return; // Keep modal open
    }

    setIsSaving(true);
    try {
      const success = await onSave(
        result.weightKg,
        result.reps,
        result.durationSeconds,
        result.rir,
      );
      if (success) {
        // Fire haptic only after confirmed persistence
        trigger('success');
      }
      // If false, modal stays open (caller sets error toast)
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-center items-center bg-black/40 p-6">
        <Card className="w-full max-w-sm p-6">
          <Text className="text-text text-2xl font-bold mb-2 text-center">
            {t('setEditor.title', { number: setNumber })}
          </Text>
          <Text className="text-subtext text-sm mb-6 text-center">
            {t('setEditor.description')}
          </Text>

          <View className="gap-4 mb-6">
            {!isDuration ? (
              <>
                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">{t('exercise.weight')}</Text>
                  <TextInput
                    ref={weightRef}
                    className="bg-background text-text text-2xl font-bold p-4 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={(v) => { setWeight(v); setWeightError(undefined); }}
                    placeholder="0"
                  />
                  {weightError && (
                    <Text className="text-danger text-xs mt-1">{weightError}</Text>
                  )}
                </View>

                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">{t('setEditor.repetitions')}</Text>
                  <TextInput
                    ref={repsRef}
                    className="bg-background text-text text-2xl font-bold p-4 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={(v) => { setReps(v); setRepsError(undefined); }}
                    placeholder="0"
                  />
                  {repsError && (
                    <Text className="text-danger text-xs mt-1">{repsError}</Text>
                  )}
                </View>

                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">{t('exercise.rir')}</Text>
                  <TextInput
                    ref={rirRef}
                    className="bg-background text-text text-xl font-bold p-3 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={rir}
                    onChangeText={(v) => { setRir(v); setRirError(undefined); }}
                    placeholder="2"
                  />
                  {rirError && (
                    <Text className="text-danger text-xs mt-1">{rirError}</Text>
                  )}
                </View>
              </>
            ) : (
              <>
                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">{t('setEditor.extraWeight')}</Text>
                  <TextInput
                    ref={weightRef}
                    className="bg-background text-text text-2xl font-bold p-4 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={(v) => { setWeight(v); setWeightError(undefined); }}
                    placeholder="0"
                  />
                  {weightError && (
                    <Text className="text-danger text-xs mt-1">{weightError}</Text>
                  )}
                </View>

                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">{t('setEditor.duration')}</Text>
                  <TextInput
                    ref={durationRef}
                    className="bg-background text-text text-2xl font-bold p-4 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={duration}
                    onChangeText={(v) => { setDuration(v); setDurationError(undefined); }}
                    placeholder="0"
                  />
                  {durationError && (
                    <Text className="text-danger text-xs mt-1">{durationError}</Text>
                  )}
                </View>
              </>
            )}
          </View>

          <View className="flex-row gap-3">
            <Button
              title={t('common.cancel')}
              variant="ghost"
              size="sm"
              onPress={onCancel}
              className="flex-1"
              disabled={isSaving}
            />

            <Button
              title={isSaving ? t('exercise.saving') : t('common.save')}
              variant="primary"
              size="sm"
              onPress={handleSave}
              className="flex-1"
              disabled={isSaving}
              loading={isSaving}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
