import React from 'react';
import { View, Text } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Card } from './Card';

interface VolumeDataPoint {
  date: number;
  volume: number;
  setsCount?: number;
}

interface VolumeChartProps {
  data: VolumeDataPoint[];
  height?: number;
  showAxis?: boolean;
  showDots?: boolean;
}

/**
 * Chart component for visualizing training volume over time
 */
export function VolumeChart({
  data,
  height = 200,
  showAxis = true,
  showDots = true,
}: VolumeChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <View style={{ height }} className="justify-center items-center">
          <Text className="text-subtext text-sm">Sem dados suficientes para o gráfico</Text>
        </View>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.map((point, index) => ({
    value: Math.round(point.volume),
    label: new Date(point.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    dataPoint: point,
  }));

  // Find max value for Y-axis scaling
  const maxValue = Math.max(...chartData.map((d) => d.value));

  return (
    <Card>
      <Text className="text-subtext text-xs font-bold uppercase mb-4 tracking-wider">
        Volume de Treino
      </Text>

      <View style={{ height }}>
        <LineChart
          data={chartData}
          height={height - 40}
          width={chartData.length * 60}
          maxValue={maxValue * 1.1} // Add 10% padding
          noOfSections={5}
          showVerticalLines={false}
          showXAxisIndices={showAxis}
          showYAxisIndices={showAxis}
          yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
          xAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
          yAxisThickness={0}
          xAxisThickness={0}
          initialSpacing={10}
          spacing={chartData.length > 7 ? 40 : 50}
          color="#E07A5F"
          thickness={3}
          dataPointsHeight={6}
          dataPointsWidth={6}
          dataPointsRadius={showDots ? 4 : 0}
          dataPointsColor="#E07A5F"
          textFontSize={12}
          textColor="#9CA3AF"
          startFillColor="rgba(224, 122, 95, 0.3)"
          endFillColor="rgba(224, 122, 95, 0.0)"
          startOpacity={0.5}
          endOpacity={0.1}
        />
      </View>

      {/* Legend */}
      <View className="flex-row justify-center items-center gap-2 mt-3">
        <View className="w-3 h-3 rounded-full bg-primary" />
        <Text className="text-subtext text-xs">Volume (kg × reps)</Text>
      </View>
    </Card>
  );
}

/**
 * Compact volume stats row
 */
interface VolumeStatsRowProps {
  totalVolume: number;
  averageVolume: number;
  totalSets: number;
}

export function VolumeStatsRow({ totalVolume, averageVolume, totalSets }: VolumeStatsRowProps) {
  return (
    <View className="flex-row gap-3">
      <Card className="flex-1">
        <Text className="text-subtext text-[10px] font-bold uppercase mb-1">Volume Total</Text>
        <Text className="text-text text-xl font-black">{totalVolume.toLocaleString()}</Text>
        <Text className="text-subtext text-[10px]">kg</Text>
      </Card>

      <Card className="flex-1">
        <Text className="text-subtext text-[10px] font-bold uppercase mb-1">Média Diária</Text>
        <Text className="text-text text-xl font-black">{Math.round(averageVolume).toLocaleString()}</Text>
        <Text className="text-subtext text-[10px]">kg</Text>
      </Card>

      <Card className="flex-1">
        <Text className="text-subtext text-[10px] font-bold uppercase mb-1">Total Séries</Text>
        <Text className="text-text text-xl font-black">{totalSets}</Text>
      </Card>
    </View>
  );
}
