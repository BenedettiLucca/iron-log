import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/src/i18n';
import { db } from '@/src/db/client';
import { exercises } from '@/src/db/schema';
import { logger } from '@/services/logger';

export interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exerciseId: number) => void;
  title?: string;
}

interface ExerciseRow {
  id: number;
  name: string;
  type?: string | null;
}

/**
 * Mid-session exercise picker (#81): search + select an exercise to append
 * to the running session. Reads the exercises table directly (read-only).
 */
export function ExercisePickerModal({
  visible,
  onClose,
  onSelectExercise,
  title,
}: ExercisePickerModalProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ExerciseRow[]>([]);

  const loadExercises = useCallback(() => {
    if (!visible) return;
    try {
      const all = db
        .select({ id: exercises.id, name: exercises.name, type: exercises.type })
        .from(exercises)
        .all();
      setRows(all);
    } catch (e) {
      logger.error('ExercisePickerModal: failed to load exercises', e);
      setRows([]);
    }
  }, [visible]);

  React.useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  const handleSelect = useCallback(
    (exerciseId: number) => {
      onSelectExercise(exerciseId);
      setQuery('');
      onClose();
    },
    [onSelectExercise, onClose]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="bg-background rounded-t-2xl border-t border-border p-4 gap-3"
          style={{ paddingBottom: 32, maxHeight: '75%' }}
        >
          <Text className="text-text text-lg font-extrabold">{title ?? t('session.addExercise')}</Text>

          <TextInput
            className="bg-background text-text p-3 rounded-xl border border-border"
            placeholder={t('session.searchExercise')}
            placeholderTextColor="#888"
            value={query}
            onChangeText={setQuery}
            accessibilityLabel={t('session.searchExercise')}
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="handled"
            className="flex-grow"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                className="py-3 border-b border-border/40"
              >
                <Text className="text-text text-base">{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text className="text-subtext text-center mt-4">{t('session.noExercisesInSession')}</Text>
            }
          />

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            className="bg-card border border-border rounded-full py-3 items-center justify-center"
          >
            <Text className="text-subtext text-sm font-semibold uppercase">{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
