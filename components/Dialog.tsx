import { View, Text, TouchableOpacity, Modal } from 'react-native';

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
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'default',
}: DialogProps) {
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
            <TouchableOpacity
              className={`py-3 px-4 rounded-xl items-center ${
                type === 'destructive' ? 'bg-danger' : 'bg-primary'
              }`}
              onPress={onConfirm}
              accessibilityLabel={confirmText}
              accessibilityRole="button"
            >
              <Text className="text-white font-semibold text-base">{confirmText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-3 px-4 rounded-xl items-center bg-background border border-border"
              onPress={onCancel}
              accessibilityLabel={cancelText}
              accessibilityRole="button"
            >
              <Text className="text-text font-semibold text-base">{cancelText}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
