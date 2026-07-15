import { useRef, type Component, type RefObject } from 'react';
import { View, Text, TouchableOpacity, Modal, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { focusAccessibilityNode } from '@/src/utils/accessibility';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';
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
  returnFocusRef?: RefObject<Component | null>;
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
  returnFocusRef,
}: DialogProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReactiveReducedMotion();
  const titleRef = useRef<Text>(null);

  const resolvedConfirmText = confirmText ?? t('common.confirm');
  const resolvedCancelText = cancelText ?? t('common.cancel');

  const handleRestoreFocus = () => {
    if (returnFocusRef?.current) {
      const refToFocus = returnFocusRef.current;
      requestAnimationFrame(() => {
        focusAccessibilityNode(refToFocus);
      });
    }
  };

  const wrappedConfirm = () => {
    onConfirm();
    handleRestoreFocus();
  };

  const wrappedCancel = () => {
    onCancel();
    handleRestoreFocus();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      statusBarTranslucent
      navigationBarTranslucent
      accessibilityViewIsModal
      onRequestClose={wrappedCancel}
      onShow={() => {
        Keyboard.dismiss();
        focusAccessibilityNode(titleRef.current);
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        className="flex-1 justify-center items-center bg-black/40"
        style={{
          paddingTop: Math.max(insets.top, 24),
          paddingRight: Math.max(insets.right, 24),
          paddingBottom: Math.max(insets.bottom, 24),
          paddingLeft: Math.max(insets.left, 24),
        }}
        accessible={false}
        onPress={wrappedCancel}
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
            onAccessibilityEscape={wrappedCancel}
            className="text-text text-xl font-bold mb-3"
          >
            {title}
          </Text>
          <Text
            accessible
            onAccessibilityEscape={wrappedCancel}
            className="text-subtext text-base mb-6 leading-6"
          >
            {message}
          </Text>

          <View className="flex-col gap-3">
            <Button
              title={resolvedConfirmText}
              variant={type === 'destructive' ? 'danger' : 'primary'}
              onPress={wrappedConfirm}
              onAccessibilityEscape={wrappedCancel}
              accessibilityLabel={resolvedConfirmText}
            />

            <Button
              title={resolvedCancelText}
              variant="ghost"
              onPress={wrappedCancel}
              onAccessibilityEscape={wrappedCancel}
              accessibilityLabel={resolvedCancelText}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
