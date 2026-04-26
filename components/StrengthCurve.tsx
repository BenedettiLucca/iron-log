import { Text, View } from 'react-native';
import { Card } from './Card';

interface StrengthCurveProps {
  currentWeight: number;
  previousWeights: number[];
  bestSet: { weight: number; reps: number; date: Date | null };
  goalWeight?: number;
  goalDate?: Date;
}

export function StrengthCurve({ currentWeight, previousWeights, bestSet, goalWeight, goalDate }: StrengthCurveProps) {
  // Calculate strength curve metrics
  const avgWeight = previousWeights.length > 0 ? previousWeights.reduce((sum, w) => sum + w, 0) / previousWeights.length : currentWeight;
  const minWeight = Math.min(...previousWeights, currentWeight);

  const trend = currentWeight >= avgWeight ? '📈 Crescendo' : '📉 Descendo';
  const trendColor = currentWeight >= avgWeight ? 'text-success' : 'text-danger';

  return (
    <Card className="border-l border-accent/20 mt-4">
      <Text className="text-accent text-xs font-bold uppercase mb-3 tracking-widest">Curva de Força</Text>

      {/* Current Stats */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-1">
            <Text className="text-subtext text-xs font-bold uppercase">Peso Atual</Text>
            <Text className="text-2xl font-black text-text">{currentWeight}kg</Text>
          </View>
          <View className="flex-1">
            <Text className="text-subtext text-xs font-bold uppercase">Média (7 dias)</Text>
            <Text className="text-2xl font-bold text-text">{avgWeight.toFixed(1)}kg</Text>
          </View>
        </View>

        {/* Trend */}
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-1">
            <Text className="text-subtext text-xs font-bold uppercase">Tendência</Text>
            <Text className={`text-2xl font-bold ${trendColor}`}>
              {trend}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-subtext text-xs font-bold uppercase">Mínimo/Máximo</Text>
            <Text className="text-2xl font-black text-text">{minWeight}kg</Text>
          </View>
        </View>
      </View>

      {/* Best Performance */}
      {bestSet && (
        <Card className="border-l border-success/20 mt-4">
          <Text className="text-success text-xs font-bold uppercase mb-3 tracking-widest">Melhor Série</Text>

          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1">
                <Text className="text-subtext text-xs font-bold uppercase">Carga</Text>
                <Text className="text-2xl font-black text-text">{bestSet.weight}kg</Text>
                <Text className="text-subtext text-xs font-bold uppercase">x {bestSet.reps} reps</Text>
              </View>
              <View className="flex-1">
                <Text className="text-subtext text-xs font-bold uppercase">Data</Text>
                <Text className="text-2xl font-black text-text">{bestSet.date ? new Date(bestSet.date).toLocaleDateString() : '-'}</Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-subtext text-xs font-bold uppercase">Volume</Text>
                <Text className="text-2xl font-black text-text">{(bestSet.weight * bestSet.reps).toFixed(0)}kg</Text>
              </View>
            </View>
          </View>
        </Card>
      )}

      {/* Goals */}
      {goalWeight && goalDate && new Date(goalDate).getTime() > Date.now() && (
        <Card className="border-l border-warning/20 mt-4">
          <Text className="text-warning text-xs font-bold uppercase mb-3 tracking-widest">Meta de Peso</Text>

          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1">
                <Text className="text-subtext text-xs font-bold uppercase">Meta</Text>
                <Text className="text-2xl font-black text-text">{goalWeight}kg</Text>
              </View>
              <View className="flex-1">
                <Text className="text-subtext text-xs font-bold uppercase">Prazo Meta</Text>
                <Text className="text-2xl font-black text-text">
                  {Math.ceil((new Date(goalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)).toString()}d
                </Text>
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-subtext text-sm font-bold uppercase">Data Alvo</Text>
              <Text className="text-4xl font-black text-text">
                {new Date(goalDate).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </Card>
      )}
    </Card>
  );
}
