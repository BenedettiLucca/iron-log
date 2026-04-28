import { useState, useCallback } from 'react';
import { View, Text, Image, Modal, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { Button } from './Button';
import { Colors } from '@/constants/colors';
import { useI18n } from '../src/i18n/index';

interface PhotoComparisonProps {
  visible: boolean;
  onClose: () => void;
  beforeUri: string | null;
  afterUri: string | null;
  label: string;
}

export function PhotoComparison({ visible, onClose, beforeUri, afterUri, label }: PhotoComparisonProps) {
  const [sliderValue, setSliderValue] = useState(0.5);
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = useCallback((event: any) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  if (!beforeUri || !afterUri) return null;

  const clipWidth = sliderValue * containerWidth;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        className="flex-1 justify-center items-center bg-black/80 p-6"
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="bg-card rounded-2xl p-6 max-w-lg w-full shadow-xl border border-border"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-text text-xl font-bold uppercase tracking-widest">Comparação: {label}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel={t("common.closeComparison")} accessibilityRole="button">
              <Text className="text-subtext text-2xl">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Comparison View — clip-based before/after */}
          <View className="relative overflow-hidden rounded-xl bg-background mb-4" style={{ height: 300 }} onLayout={onLayout}>
            {/* Before Image (full background) */}
            <Image
              source={{ uri: beforeUri }}
              className="absolute top-0 left-0 bottom-0"
              style={{ width: containerWidth || '100%', height: 300 }}
              resizeMode="contain"
            />

            {/* After Image (clipped by slider) */}
            <View
              className="absolute top-0 left-0 bottom-0 overflow-hidden"
              style={{ width: clipWidth, height: 300 }}
            >
              <Image
                source={{ uri: afterUri }}
                style={{ width: containerWidth || '100%', height: 300 }}
                resizeMode="contain"
              />
            </View>

            {/* Divider Line */}
            <View
              className="absolute top-0 bottom-0 w-0.5 bg-white/90"
              style={{ left: clipWidth - 1 }}
            />

            {/* Handle knob */}
            <View
              className="absolute top-1/2 w-8 h-8 bg-white rounded-full shadow-lg justify-center items-center"
              style={{ left: clipWidth - 16, marginTop: -16 }}
            >
              <Text className="text-text text-xs font-bold">⟨⟩</Text>
            </View>

            {/* Labels */}
            <View className="absolute top-2 left-0 right-0 flex-row justify-between px-2">
              <View className="bg-black/50 px-2 py-1 rounded">
                <Text className="text-white text-xs font-bold uppercase">Antes</Text>
              </View>
              <View className="bg-black/50 px-2 py-1 rounded">
                <Text className="text-white text-xs font-bold uppercase">Depois</Text>
              </View>
            </View>
          </View>

          {/* Slider Control */}
          <View className="mb-4">
            <Text className="text-subtext text-xs text-center mb-2">
              Deslize para comparar as fotos
            </Text>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              value={sliderValue}
              onValueChange={setSliderValue}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.gray300}
              thumbTintColor={Colors.primary}
            />
            <View className="flex-row justify-between px-2 mt-1">
              <Text className="text-subtext text-xs">Antes</Text>
              <Text className="text-subtext text-xs">Depois</Text>
            </View>
          </View>

          {/* Toggle Visibility */}
          <View className="flex-row gap-2 mb-4">
            <TouchableOpacity
              onPress={() => setSliderValue(0)}
              className="flex-1 py-3 px-4 rounded-xl bg-background border border-border items-center"
            >
              <Text className="text-text font-bold text-sm">Ver Antes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSliderValue(1)}
              className="flex-1 py-3 px-4 rounded-xl bg-background border border-border items-center"
            >
              <Text className="text-text font-bold text-sm">Ver Depois</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSliderValue(0.5)}
              className="flex-1 py-3 px-4 rounded-xl bg-primary items-center"
            >
              <Text className="text-white font-bold text-sm">Comparar</Text>
            </TouchableOpacity>
          </View>

          {/* Close Button */}
          <Button
            title="Fechar"
            onPress={onClose}
            variant="primary"
            size="lg"
            fullWidth
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
