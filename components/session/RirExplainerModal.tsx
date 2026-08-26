import { View, Text, Modal, TouchableOpacity } from 'react-native';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

interface RirExplainerModalProps {
  visible: boolean;
  onClose: () => void;
  t: TranslationFn;
}

export function RirExplainerModal({
  visible,
  onClose,
  t,
}: RirExplainerModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} accessibilityViewIsModal>
      <TouchableOpacity
        activeOpacity={1}
        className="flex-1 justify-center items-center bg-black/40 p-6"
        onPress={onClose}
        accessible={false}
        accessibilityRole="none"
      >
        <TouchableOpacity
          activeOpacity={1}
          className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl border border-border"
          onPress={(e) => e.stopPropagation()}
          accessible={false}
          accessibilityRole="none"
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-text text-xl font-bold" accessibilityRole="header">{t('exercise.rirQuestion')}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Text className="text-subtext text-2xl font-bold">✕</Text>
            </TouchableOpacity>
          </View>

          <View className="space-y-4">
            <View className="flex-row items-start gap-3">
              <View className="bg-dangerSurface p-2 rounded-lg">
                <Text className="text-dangerText text-2xl">0-1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-base mb-1">{t("exercise.rirStrong")}</Text>
                <Text className="text-subtext text-sm">{t("exercise.rirStrongDesc")}</Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="bg-successSurface p-2 rounded-lg">
                <Text className="text-successText text-2xl">2-3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-base mb-1">{t("exercise.rirModerate")}</Text>
                <Text className="text-subtext text-sm">{t("exercise.rirModerateDesc")}</Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="bg-secondarySurface p-2 rounded-lg">
                <Text className="text-secondaryText text-2xl">4-5</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-base mb-1">{t("exercise.rirLight")}</Text>
                <Text className="text-subtext text-sm">{t("exercise.rirLightDesc")}</Text>
              </View>
            </View>

            <View className="bg-background p-3 rounded-lg border border-border mt-4">
              <Text className="text-subtext text-xs leading-5">
                {t("exercise.rirExplainer")}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            className="mt-6 bg-primary p-3 rounded-xl items-center"
            accessibilityRole="button"
            accessibilityLabel={t('common.understood')}
          >
            <Text className="text-onPrimary font-bold text-base uppercase">{t('common.understood')}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
