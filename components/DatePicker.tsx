import { useState } from 'react';
import { Platform, Pressable, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

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
  placeholder = 'Selecione uma data',
  minimumDate,
  mode = 'date',
}: DatePickerProps) {
  const [show, setShow] = useState(false);

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
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const borderColor = value ? '#E07A5F' : '#3D5A80';

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
              {value ? formatDate(value) : placeholder}
            </Text>
          </Pressable>

          <Modal
            visible={show}
            transparent
            animationType="slide"
            onRequestClose={() => setShow(false)}
          >
            <View style={styles.modalOverlay}>
              <View className="bg-background rounded-t-3xl p-4">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-text text-lg font-bold uppercase">Selecionar Data</Text>
                  <TouchableOpacity onPress={() => setShow(false)}>
                    <Text className="text-primary font-bold text-base">Concluir</Text>
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
                    locale="pt-BR"
                    textColor="#E07A5F"
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
              {value ? formatDate(value) : placeholder}
            </Text>
          </Pressable>

          {show && (
            <DateTimePicker
              value={value || new Date()}
              mode={mode}
              display="default"
              onChange={handleChange}
              minimumDate={minimumDate}
              accentColor="#E07A5F"
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
