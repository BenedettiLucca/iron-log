import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Modal, View, Text, StyleSheet, useColorScheme } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getThemeColors } from '@/constants/colors';
import { useI18n, getLocaleForLanguage } from '@/src/i18n';

interface DatePickerProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  mode?: 'date' | 'time';
  error?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder,
  minimumDate,
  mode = 'date',
  error,
  disabled = false,
  accessibilityLabel,
}: DatePickerProps) {
  const { t, language } = useI18n();
  const [show, setShow] = useState(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const colorScheme = useColorScheme();
  const theme = getThemeColors(colorScheme);
  const isOpen = show && !disabled;

  useEffect(() => {
    if (disabled) setShow(false);
  }, [disabled]);

  const displayPlaceholder = placeholder || t('datePicker.placeholder');
  const locale = getLocaleForLanguage(language);

  const showMode = () => {
    if (disabled) return;
    setShow(true);
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }

    if (disabledRef.current || event.type === 'dismissed') return;
    if (selectedDate) onChange(selectedDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const borderColor = error
    ? theme.dangerText
    : isOpen
    ? theme.primaryText
    : theme.border;

  const mergedAccessibilityLabel = accessibilityLabel ?? label ?? displayPlaceholder;
  const displayValue = value ? formatDate(value) : displayPlaceholder;

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-text text-xs font-semibold mb-1.5 uppercase tracking-wider">
          {label}
        </Text>
      )}

      {Platform.OS === 'ios' ? (
        // iOS: Use modal approach
        <>
          <Pressable
            onPress={showMode}
            disabled={disabled}
            className={disabled ? 'opacity-60' : 'active:opacity-[0.92]'}
            accessibilityRole="button"
            accessibilityLabel={mergedAccessibilityLabel}
            accessibilityValue={{ text: displayValue }}
            accessibilityState={{ disabled, expanded: isOpen }}
            accessibilityHint={error}
            style={[
              styles.pickerButton,
              { borderColor: borderColor }
            ]}
          >
            <Text className={value ? 'text-text text-base' : 'text-subtext text-base'}>
              {displayValue}
            </Text>
          </Pressable>

          <Modal
            visible={isOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setShow(false)}
          >
            <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
              <View className="bg-background rounded-t-3xl p-4">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-text text-lg font-bold uppercase">{t('datePicker.title')}</Text>
                  <Pressable
                    onPress={() => setShow(false)}
                    className="min-h-[44px] min-w-[44px] items-center justify-center active:opacity-[0.92]"
                    accessibilityRole="button"
                    accessibilityLabel={t('datePicker.done')}
                  >
                    <Text className="text-primaryText font-bold text-base">{t('datePicker.done')}</Text>
                  </Pressable>
                </View>
                <View className="min-h-[200px]">
                  <DateTimePicker
                    value={value || new Date()}
                    mode={mode}
                    display="spinner"
                    onChange={handleChange}
                    minimumDate={minimumDate}
                    style={{ width: '100%' }}
                    locale={locale}
                    textColor={theme.primaryText}
                  />
                </View>
              </View>
            </View>
          </Modal>
        </>
      ) : (
        // Android: Use inline picker
        <>
          <Pressable
            onPress={showMode}
            disabled={disabled}
            className={disabled ? 'opacity-60' : 'active:opacity-[0.92]'}
            accessibilityRole="button"
            accessibilityLabel={mergedAccessibilityLabel}
            accessibilityValue={{ text: displayValue }}
            accessibilityState={{ disabled, expanded: isOpen }}
            accessibilityHint={error}
            style={[
              styles.pickerButton,
              { borderColor: borderColor }
            ]}
          >
            <Text className={value ? 'text-text text-base' : 'text-subtext text-base'}>
              {displayValue}
            </Text>
          </Pressable>

          {isOpen && (
            <DateTimePicker
              value={value || new Date()}
              mode={mode}
              display="default"
              onChange={handleChange}
              minimumDate={minimumDate}
              accentColor={theme.primary}
            />
          )}
        </>
      )}

      {error && (
        <Text className="text-dangerText text-xs mt-1" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pickerButton: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
