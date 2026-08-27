import { useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { focusAccessibilityNode } from '@/src/utils/accessibility';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useI18n } from '../src/i18n/index';
import { Button } from './Button';

interface SetActionsDialogProps {
  visible: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function SetActionsDialog({
  visible,
  onEdit,
  onDelete,
  onCancel,
}: SetActionsDialogProps) {
  const { t } = useI18n();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReactiveReducedMotion();
  const titleRef = useRef<Text>(null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      statusBarTranslucent
      navigationBarTranslucent
      accessibilityViewIsModal
      onRequestClose={onCancel}
      onShow={() => {
        Keyboard.dismiss();
        focusAccessibilityNode(titleRef.current);
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        className="flex-1 justify-center items-center"
        style={{
          backgroundColor: theme.overlay,
          paddingTop: Math.max(insets.top, 24),
          paddingRight: Math.max(insets.right, 24),
          paddingBottom: Math.max(insets.bottom, 24),
          paddingLeft: Math.max(insets.left, 24),
        }}
        accessible={false}
        onPress={onCancel}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl"
          onPress={(e) => e.stopPropagation()}
          accessible={false}
          accessibilityViewIsModal
        >
          <Text
            ref={titleRef}
            accessible
            accessibilityRole="header"
            onAccessibilityEscape={onCancel}
            className="text-text text-xl font-bold mb-3"
          >
            {t('setCard.actionsTitle')}
          </Text>

          <View className="flex-col gap-3">
            <Button
              title={t('common.edit')}
              variant="secondary"
              onPress={onEdit}
              accessibilityLabel={t('common.edit')}
              onAccessibilityEscape={onCancel}
            />

            <Button
              title={t('common.delete')}
              variant="danger"
              onPress={onDelete}
              accessibilityLabel={t('common.delete')}
              onAccessibilityEscape={onCancel}
            />

            <Button
              title={t('common.cancel')}
              variant="ghost"
              onPress={onCancel}
              accessibilityLabel={t('common.cancel')}
              onAccessibilityEscape={onCancel}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
