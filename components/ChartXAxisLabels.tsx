import React from 'react';
import { View, Text } from 'react-native';
import { CHART_INITIAL_SPACING } from '@/src/utils/chart-layout';

interface ChartXAxisLabelsProps {
  axisLabels: string[];
  slotSpacing: number;
  viewportWidth: number;
  yAxisLabelWidth: number;
}

export function ChartXAxisLabels({
  axisLabels,
  slotSpacing,
  viewportWidth,
  yAxisLabelWidth,
}: ChartXAxisLabelsProps) {
  if (axisLabels.length === 0) {
    return null;
  }

  const labelWidth = Math.min(slotSpacing, CHART_INITIAL_SPACING * 2);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        marginLeft: yAxisLabelWidth,
        width: viewportWidth,
        height: 20,
        position: 'relative',
      }}
    >
      {axisLabels.map((label, index) => {
        const centerX = CHART_INITIAL_SPACING + index * slotSpacing;
        const left = centerX - labelWidth / 2;

        return (
          <View
            key={`${label}-${index}`}
            style={{
              position: 'absolute',
              left,
              width: labelWidth,
              alignItems: 'center',
            }}
          >
            <Text
              className="text-subtext text-2xs text-center"
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
