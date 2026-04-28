import { View, Text, ScrollView, Image, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { db } from '../../../src/db/client';
import { bodyMetrics } from '../../../src/db/schema';
import { asc } from 'drizzle-orm';
import { LineChart } from 'react-native-gifted-charts';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { PhotoComparison } from '../../../components/PhotoComparison';
import { logger } from '@/services/logger';
import { BodyMetric } from '@/src/types';
import { Colors } from '@/constants/colors';

export default function EvolutionScreen() {
  const [weightData, setWeightData] = useState<BodyMetric[]>([]);
  const [measuresData, setMeasuresData] = useState<Record<string, { value: number; label: string }[]>>({});
  const [photos, setPhotos] = useState<BodyMetric[]>([]);
  const [activeTab, setActiveTab] = useState<'weight' | 'measures' | 'photos' | 'analytics'>('weight');
  const [comparison, setComparison] = useState({
    visible: false,
    beforeUri: null as string | null,
    afterUri: null as string | null,
    label: '',
  });
  const [analytics, setAnalytics] = useState({
    weightChangeRate: 0,
    averageWeight: 0,
    totalEntries: 0,
    firstEntryDate: null as Date | null,
    lastEntryDate: null as Date | null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carregar em ordem ASCENDENTE para calcular média móvel corretamente
      const data = await db.select().from(bodyMetrics).orderBy(asc(bodyMetrics.date));

      // 1. Processar Peso (Média Móvel 7 Dias)
      const weights = data.filter(m => m.weight && m.weight > 0);
      const maData = weights.map((point, index, arr) => {
          // Pegar janela de até 7 dias anteriores
          const windowStart = Math.max(0, index - 6);
          const window = arr.slice(windowStart, index + 1);
          const avg = window.reduce((sum, item) => sum + item.weight!, 0) / window.length;

          return {
              value: parseFloat(avg.toFixed(1)),
              label: new Date(point.date).getDate().toString(),
              dataPointText: parseFloat(avg.toFixed(1)).toString()
          };
      });

      // Pegar até 30 pontos para o gráfico não ficar poluído (aprox 30 dias)
      setWeightData(maData.slice(-30));

      // 2. Processar Medidas
      const measures = data.filter(m => m.type === 'monthly');
      const processMeasure = (key: 'waist' | 'armRight' | 'chest' | 'calf') => measures.map(m => ({
          value: m[key] || 0,
          label: new Date(m.date).toLocaleDateString('pt-BR', { month: 'short' })
      })).slice(-12); // Últimos 12 meses

      setMeasuresData({
          waist: processMeasure('waist'),
          arm: processMeasure('armRight'),
          chest: processMeasure('chest')
      });

      // 3. Processar Fotos (Do mais novo para o mais velho)
      const photoEntries = data
        .filter(m => m.type === 'monthly' && (m.photoFront || m.photoBack || m.photoSide))
        .reverse(); // Descendente
      setPhotos(photoEntries);

      // 4. Calculate Analytics
      if (weights.length > 0) {
        const totalWeight = weights.reduce((sum, m) => sum + (m.weight || 0), 0);
        const averageWeight = totalWeight / weights.length;

        const firstWeight = weights[0].weight;
        const lastWeight = weights[weights.length - 1].weight;
        const firstDate = new Date(weights[0].date);
        const lastDate = new Date(weights[weights.length - 1].date);
        const weeksDiff = Math.max((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7), 1);
        const weightChangeRate = firstWeight !== null && lastWeight !== null
          ? ((lastWeight - firstWeight) / weeksDiff)
          : 0;

        setAnalytics({
          weightChangeRate,
          averageWeight,
          totalEntries: data.length,
          firstEntryDate: firstDate,
          lastEntryDate: lastDate,
        });
      }

    } catch (e) {
      logger.error('Erro inesperado', e);
    }
  };

  const renderChart = (data: any[], title: string, color: string) => {
      if (!data || data.length < 2) return (
          <Card style={{ marginBottom: 24, height: 160, justifyContent: 'center', alignItems: 'center' }}>
              <Text className="text-subtext italic">Dados insuficientes para {title}</Text>
          </Card>
      );

      return (
        <Card style={{ marginBottom: 24 }}>
            <Text className="text-text font-bold mb-6 uppercase text-xs tracking-widest">{title}</Text>
            <LineChart 
                data={data} 
                color={color} 
                thickness={3}
                dataPointsColor={color}
                textColor={Colors.blue300}
                hideRules
                yAxisColor="transparent"
                xAxisColor="transparent"
                height={180}
                width={Dimensions.get('window').width - 80}
                initialSpacing={20}
                spacing={40}
                textFontSize={10}
            />
        </Card>
      );
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Evolução' }} />
      
      {/* Tabs */}
      <View className="flex-row p-4 gap-2 flex-wrap">
          {(['weight', 'measures', 'photos', 'analytics'] as const).map(tab => (
              <View key={tab} className="flex-1 min-w-[70px]">
                <Button
                    title={tab === 'weight' ? 'PESO' : tab === 'measures' ? 'MEDIDAS' : tab === 'photos' ? 'FOTOS' : 'ANÁLISE'}
                    onPress={() => setActiveTab(tab)}
                    variant={activeTab === tab ? 'primary' : 'ghost'}
                    size="sm"
                />
              </View>
          ))}
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
          {activeTab === 'weight' && (
              <>
                <Text className="text-subtext text-xs mb-4 text-center font-medium">Média Móvel (7 Dias)</Text>
                {renderChart(weightData, 'Evolução de Peso', Colors.primary)}
              </>
          )}

          {activeTab === 'measures' && (
              <>
                {renderChart(measuresData.waist, 'Cintura (cm)', Colors.success)}
                {renderChart(measuresData.arm, 'Braço (cm)', Colors.secondary)}
                {renderChart(measuresData.chest, 'Tórax (cm)', Colors.accent)}
              </>
          )}

                   {activeTab === 'photos' && (
               <View className="gap-4">
                   <View className="flex-row justify-between items-center mb-4">
                       <Text className="text-subtext text-xs font-bold uppercase tracking-widest">FOTOS RECENTES</Text>
                       {photos.length >= 2 && (
                           <Button
                               title="Comparar"
                               onPress={() => {
                                   const latest = photos[0];
                                   const previous = photos[1];
                                   if (latest && previous) {
                                       setComparison({
                                           visible: true,
                                           beforeUri: previous.photoFront || previous.photoBack || previous.photoSide,
                                           afterUri: latest.photoFront || latest.photoBack || latest.photoSide,
                                           label: 'Últimos Check-ins',
                                       });
                                   }
                               }}
                               variant="secondary"
                               size="sm"
                           />
                       )}
                   </View>
                   {photos.length === 0 && (
                     <View className="items-center mt-10">
                         <Text className="text-4xl mb-4">📷</Text>
                         <Text className="text-subtext text-center">Nenhuma foto registrada.</Text>
                         <Text className="text-subtext/60 text-xs text-center mt-2">Faça um check-in mensal para adicionar fotos de evolução.</Text>
                     </View>
                   )}
                   {photos.map((entry) => (
                      <View key={entry.id} className="mb-8">
                          <View className="flex-row items-center gap-2 mb-4">
                            <View className="h-[1px] flex-1 bg-border" />
                            <Text className="text-primary font-bold text-sm uppercase tracking-widest">
                                {new Date(entry.date).toLocaleDateString()}
                            </Text>
                            <View className="h-[1px] flex-1 bg-border" />
                          </View>

                          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-4 pl-2">
                              {entry.photoFront && (
                                  <View>
                                      <Image source={{ uri: entry.photoFront }} className="w-48 h-64 rounded-2xl bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-xs mt-2 font-bold uppercase">FRENTE</Text>
                                  </View>
                              )}
                              {entry.photoBack && (
                                  <View>
                                      <Image source={{ uri: entry.photoBack }} className="w-48 h-64 rounded-2xl bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-xs mt-2 font-bold uppercase">COSTAS</Text>
                                  </View>
                              )}
                              {entry.photoSide && (
                                  <View>
                                      <Image source={{ uri: entry.photoSide }} className="w-48 h-64 rounded-2xl bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-xs mt-2 font-bold uppercase">PERFIL</Text>
                                  </View>
                              )}
                          </ScrollView>
                      </View>
                  ))}
              </View>
          )}

          {activeTab === 'analytics' && (
              <View className="gap-4">
                  {weightData.length === 0 ? (
                    <EmptyState
                      icon="📊"
                      title="Sem dados suficientes"
                      description="Registre suas métricas para ver análises e tendências."
                    />
                  ) : (
                    <>
                      {/* Weight Change Rate */}
                      <Card>
                        <Text className="text-subtext text-xs font-bold uppercase mb-2">Variação de Peso</Text>
                        <View className="flex-row items-end gap-2">
                          <Text className={`text-4xl font-black ${analytics.weightChangeRate >= 0 ? 'text-success' : 'text-danger'}`}>
                            {analytics.weightChangeRate >= 0 ? '+' : ''}
                            {analytics.weightChangeRate.toFixed(2)}
                          </Text>
                          <Text className="text-subtext text-sm mb-1">kg/semana</Text>
                        </View>
                      </Card>

                      {/* Average Weight */}
                      <Card>
                        <Text className="text-subtext text-xs font-bold uppercase mb-2">Peso Médio</Text>
                        <View className="flex-row items-end gap-2">
                          <Text className="text-4xl font-black text-text">
                            {analytics.averageWeight.toFixed(1)}
                          </Text>
                          <Text className="text-subtext text-sm mb-1">kg</Text>
                        </View>
                      </Card>

                      {/* Statistics Grid */}
                      <View className="flex-row gap-3">
                        <Card className="flex-1">
                          <Text className="text-subtext text-xs font-bold uppercase mb-1">Total de Registros</Text>
                          <Text className="text-2xl font-black text-text">{analytics.totalEntries}</Text>
                        </Card>

                        <Card className="flex-1">
                          <Text className="text-subtext text-xs font-bold uppercase mb-1">Período</Text>
                          <Text className="text-2xl font-black text-text">
                            {analytics.firstEntryDate && analytics.lastEntryDate
                              ? Math.ceil(
                                  (analytics.lastEntryDate.getTime() - analytics.firstEntryDate.getTime()) /
                                    (1000 * 60 * 60 * 24 * 30)
                                )
                              : 0}
                          </Text>
                          <Text className="text-subtext text-xs">meses</Text>
                        </Card>
                      </View>

                      {/* Trend Analysis */}
                      <Card>
                        <Text className="text-subtext text-xs font-bold uppercase mb-3">Tendência</Text>
                        <View className="flex-row items-center gap-3">
                          <View
                            className={`w-16 h-16 rounded-full items-center justify-center ${
                              analytics.weightChangeRate > 0.1
                                ? 'bg-success/20'
                                : analytics.weightChangeRate < -0.1
                                ? 'bg-danger/20'
                                : 'bg-secondary/20'
                            }`}
                          >
                            <Text className="text-3xl">
                              {analytics.weightChangeRate > 0.1 ? '📈' : analytics.weightChangeRate < -0.1 ? '📉' : '➡️'}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-text font-bold text-sm mb-1">
                              {analytics.weightChangeRate > 0.1
                                ? 'Ganhando peso'
                                : analytics.weightChangeRate < -0.1
                                ? 'Perdendo peso'
                                : 'Estável'}
                            </Text>
                            <Text className="text-subtext text-xs">
                              {analytics.weightChangeRate > 0.1
                                ? 'Você está ganhando peso consistentemente'
                                : analytics.weightChangeRate < -0.1
                                ? 'Você está perdendo peso consistentemente'
                                : 'Seu peso está estável'}
                            </Text>
                          </View>
                        </View>
                      </Card>

                      {/* Info Card */}
                      <Card className="bg-secondary/10 border-secondary/20">
                        <Text className="text-secondary text-xs font-bold uppercase mb-2">💡 Dica</Text>
                        <Text className="text-subtext text-xs leading-5">
                          Para mudanças de peso saudáveis, tente manter uma variação entre -0.5 a +0.5 kg por semana.
                        </Text>
                      </Card>
                     </>
                   )}
               </View>
           )}
       </ScrollView>

       {/* Photo Comparison Modal */}
       <PhotoComparison
           visible={comparison.visible}
           beforeUri={comparison.beforeUri}
           afterUri={comparison.afterUri}
           label={comparison.label}
           onClose={() => setComparison({ visible: false, beforeUri: null, afterUri: null, label: '' })}
       />
     </View>
  );
}
