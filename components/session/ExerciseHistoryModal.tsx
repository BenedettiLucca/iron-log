import { View, Text, Modal, TouchableOpacity, FlatList } from 'react-native';
import { getLocaleForLanguage, Language } from '../../src/i18n/index';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

interface ExerciseHistoryItem {
  sessionId: number;
  date: number;
  weight: number | null;
  reps: number | null;
  duration: number | null;
  rir: number | null;
}

interface ExerciseHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  historyData: ExerciseHistoryItem[];
  t: TranslationFn;
  language: Language;
}

export function ExerciseHistoryModal({
  visible,
  onClose,
  historyData,
  t,
  language,
}: ExerciseHistoryModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" accessibilityViewIsModal onRequestClose={onClose}>
      <View className="flex-1 bg-background p-4">
        <View className="flex-row justify-between items-center mb-4 mt-2">
          <Text className="text-text text-xl font-bold uppercase" accessibilityRole="header">{t("exerciseSession.history")}</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Text className="text-primaryText font-bold uppercase">{t("common.close")}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={historyData}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => {
            const date = new Date(item.date);
            const dateStr = date.toLocaleDateString(getLocaleForLanguage(language));
            const perfStr = `${item.weight}kg × ${item.duration ? `${item.duration}s` : item.reps}`;
            const rirStr = item.rir !== null ? `RIR ${item.rir}` : '';
            const itemLabel = [dateStr, perfStr, rirStr].filter(Boolean).join(', ');
            return (
              <View
                className="bg-card p-3 mb-2 rounded border border-border flex-row justify-between items-center"
                accessible={true}
                accessibilityRole="summary"
                accessibilityLabel={itemLabel}
              >
                <Text className="text-subtext font-mono text-xs">
                  {dateStr}
                </Text>
                <Text className="text-text font-bold">
                  {item.weight}kg × {item.duration ? `${item.duration}s` : item.reps}
                </Text>
                {item.rir !== null && (
                  <Text className="text-subtext text-xs">RIR {item.rir}</Text>
                )}
              </View>
            );
          }}
        />
      </View>
    </Modal>
  );
}
