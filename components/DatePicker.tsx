import { useState } from 'react';
import { Platform, Pressable, Modal, View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
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
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder,
  minimumDate,
  mode = 'date',
}: DatePickerProps) {
  const { t, language } = useI18n();
  const [show, setShow] = useState(false);
  const colorScheme = useColorScheme();
  const theme = getThemeColors(colorScheme);

  const displayPlaceholder = placeholder || t('datePicker.placeholder');
  const locale = getLocaleForLanguage(language);

  const showMode = () => {
    setShow(true);
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }

    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const borderColor = value ? theme.primary : theme.border;

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-subtext text-xs font-bold uppercase mb-2">{label}</Text>
      )}

      {Platform.OS === 'ios' ? (
        // iOS: Use modal approach
        <>
          <Pressable
            onPress={showMode}
            style={[
              styles.pickerButton,
              { borderColor: borderColor }
            ]}
          >
            <Text className={value ? 'text-text text-base' : 'text-subtext text-base'}>
              {value ? formatDate(value) : displayPlaceholder}
            </Text>
          </Pressable>

          <Modal
            visible={show}
            transparent
            animationType="slide"
            onRequestClose={() => setShow(false)}
          >
            <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
              <View className="bg-background rounded-t-3xl p-4">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-text text-lg font-bold uppercase">{t('datePicker.title')}</Text>
                  <TouchableOpacity onPress={() => setShow(false)}>
                    <Text className="text-primary font-bold text-base">{t('datePicker.done')}</Text>
                  </TouchableOpacity>
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
                    textColor={theme.primary}
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
            style={[
              styles.pickerButton,
              { borderColor: borderColor }
            ]}
          >
            <Text className={value ? 'text-text text-base' : 'text-subtext text-base'}>
              {value ? formatDate(value) : displayPlaceholder}
            </Text>
          </Pressable>

          {show && (
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
