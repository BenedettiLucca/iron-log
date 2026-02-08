import { View, Text, ScrollView, Image, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { db } from '../../../src/db/client';
import { bodyMetrics } from '../../../src/db/schema';
import { asc } from 'drizzle-orm';
import { LineChart } from 'react-native-gifted-charts';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';

export default function EvolutionScreen() {
  const [weightData, setWeightData] = useState<any[]>([]);
  const [measuresData, setMeasuresData] = useState<any>({});
  const [photos, setPhotos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'weight' | 'measures' | 'photos'>('weight');

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
      
      // Pegar apenas os últimos 20 pontos para o gráfico não ficar poluido
      setWeightData(maData.slice(-20));

      // 2. Processar Medidas
      const measures = data.filter(m => m.type === 'monthly');
      const processMeasure = (key: string) => measures.map(m => ({
          value: m[key] || 0,
          label: new Date(m.date).toLocaleDateString('pt-BR', { month: 'short' })
      })).slice(-6); // Últimos 6 meses

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

    } catch (e) {
      console.error(e);
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
                textColor="#cdd6f4"
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
      <View className="flex-row p-4 gap-2">
          {['weight', 'measures', 'photos'].map(tab => (
              <View key={tab} className="flex-1">
                <Button
                    title={tab === 'weight' ? 'PESO' : tab === 'measures' ? 'MEDIDAS' : 'FOTOS'}
                    onPress={() => setActiveTab(tab as any)}
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
                {renderChart(weightData, 'Evolução de Peso', '#E07A5F')}
              </>
          )}

          {activeTab === 'measures' && (
              <>
                {renderChart(measuresData.waist, 'Cintura (cm)', '#81B29A')}
                {renderChart(measuresData.arm, 'Braço (cm)', '#3D5A80')}
                {renderChart(measuresData.chest, 'Tórax (cm)', '#F2CC8F')}
              </>
          )}

          {activeTab === 'photos' && (
              <View>
                  {photos.length === 0 && (
                    <View className="items-center mt-10">
                        <Text className="text-4xl mb-4">📷</Text>
                        <Text className="text-subtext text-center">Nenhuma foto registrada.</Text>
                        <Text className="text-subtext/60 text-xs text-center mt-2">Faça um Check-in mensal para adicionar fotos.</Text>
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
                                      <Text className="text-center text-subtext text-[10px] mt-2 font-bold uppercase">FRENTE</Text>
                                  </View>
                              )}
                              {entry.photoBack && (
                                  <View>
                                      <Image source={{ uri: entry.photoBack }} className="w-48 h-64 rounded-2xl bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-[10px] mt-2 font-bold uppercase">COSTAS</Text>
                                  </View>
                              )}
                              {entry.photoSide && (
                                  <View>
                                      <Image source={{ uri: entry.photoSide }} className="w-48 h-64 rounded-2xl bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-[10px] mt-2 font-bold uppercase">PERFIL</Text>
                                  </View>
                              )}
                          </ScrollView>
                      </View>
                  ))}
              </View>
          )}
      </ScrollView>
    </View>
  );
}
