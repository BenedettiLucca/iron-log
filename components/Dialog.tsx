import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useI18n } from '../src/i18n/index';
import { Button } from './Button';

interface DialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'default' | 'destructive';
}

export function Dialog({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  type = 'default',
}: DialogProps) {
  const { t } = useI18n();
  const resolvedConfirmText = confirmText ?? t('common.confirm');
  const resolvedCancelText = cancelText ?? t('common.cancel');
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
      accessibilityLabel={`${title}. ${message}`}
    >
      <TouchableOpacity
        activeOpacity={1}
        className="flex-1 justify-center items-center bg-black/40"
        onPress={onCancel}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="bg-card rounded-2xl p-6 m-6 max-w-sm w-full shadow-xl"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-text text-xl font-bold mb-3">{title}</Text>
          <Text className="text-subtext text-base mb-6 leading-6">{message}</Text>

          <View className="flex-col gap-3">
            <Button
              title={resolvedConfirmText}
              variant={type === 'destructive' ? 'danger' : 'primary'}
              onPress={onConfirm}
              accessibilityLabel={resolvedConfirmText}
            />

            <Button
              title={resolvedCancelText}
              variant="ghost"
              onPress={onCancel}
              accessibilityLabel={resolvedCancelText}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
