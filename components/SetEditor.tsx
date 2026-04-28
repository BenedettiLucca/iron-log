import { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';
import { Card } from './Card';
import { useHaptics } from '@/hooks/use-haptics';

interface SetEditorProps {
  visible: boolean;
  setNumber: number;
  initialWeight: number;
  initialReps?: number;
  initialDuration?: number;
  initialRir?: number | null;
  isDuration: boolean;
  onSave: (weight: number, reps?: number, duration?: number, rir?: number) => void;
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
  const [weight, setWeight] = useState(initialWeight.toString());
  const [reps, setReps] = useState(initialReps?.toString() || '');
  const [duration, setDuration] = useState(initialDuration?.toString() || '');
  const [rir, setRir] = useState(initialRir?.toString() || '2');

  useEffect(() => {
    if (visible) {
      setWeight(initialWeight.toString());
      setReps(initialReps?.toString() || '');
      setDuration(initialDuration?.toString() || '');
      setRir(initialRir?.toString() || '2');
    }
  }, [visible, initialWeight, initialReps, initialDuration, initialRir]);

  const handleSave = () => {
    trigger('success');
    
    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue < 0) {
      return;
    }

    if (isDuration) {
      const durationValue = parseInt(duration, 10);
      if (isNaN(durationValue) || durationValue <= 0) {
        return;
      }
      onSave(weightValue, undefined, durationValue, undefined);
    } else {
      const repsValue = parseInt(reps, 10);
      if (isNaN(repsValue) || repsValue <= 0) {
        return;
      }
      const rirValue = parseInt(rir, 10);
      onSave(weightValue, repsValue, undefined, isNaN(rirValue) ? 2 : rirValue);
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
            Editar Série {setNumber}
          </Text>
          <Text className="text-subtext text-sm mb-6 text-center">
            Modifique os valores da série
          </Text>

          <View className="gap-4 mb-6">
            {!isDuration ? (
              <>
                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">Carga (kg)</Text>
                  <TextInput
                    className="bg-background text-text text-2xl font-bold p-4 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="0"
                  />
                </View>

                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">Repetições</Text>
                  <TextInput
                    className="bg-background text-text text-2xl font-bold p-4 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={setReps}
                    placeholder="0"
                  />
                </View>

                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">Reserva (RIR)</Text>
                  <TextInput
                    className="bg-background text-text text-xl font-bold p-3 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={rir}
                    onChangeText={setRir}
                    placeholder="2"
                  />
                </View>
              </>
            ) : (
              <>
                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">Carga Extra (kg)</Text>
                  <TextInput
                    className="bg-background text-text text-2xl font-bold p-4 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="0"
                  />
                </View>

                <View>
                  <Text className="text-subtext text-xs font-bold uppercase mb-2">Duração (segundos)</Text>
                  <TextInput
                    className="bg-background text-text text-2xl font-bold p-4 rounded-xl border border-border text-center"
                    keyboardType="numeric"
                    value={duration}
                    onChangeText={setDuration}
                    placeholder="0"
                  />
                </View>
              </>
            )}
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onCancel}
              className="flex-1 py-3 px-4 rounded-xl items-center bg-background border border-border"
            >
              <Text className="text-text font-semibold text-base">Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              className="flex-1 py-3 px-4 rounded-xl items-center bg-primary"
            >
              <Text className="text-white font-semibold text-base">Salvar</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
