import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { db } from '../../../src/db/client';
import { bodyMetrics } from '../../../src/db/schema';
import { asc } from 'drizzle-orm';
import { LineChart } from 'react-native-gifted-charts';

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
          <View className="h-40 justify-center items-center bg-card rounded-xl mb-6">
              <Text className="text-subtext italic">Dados insuficientes para {title}</Text>
          </View>
      );

      return (
        <View className="bg-card p-4 rounded-xl border border-border mb-6">
            <Text className="text-text font-bold mb-4 uppercase text-xs tracking-widest">{title}</Text>
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
        </View>
      );
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Evolução' }} />
      
      {/* Tabs */}
      <View className="flex-row p-4 gap-2">
          {['weight', 'measures', 'photos'].map(tab => (
              <TouchableOpacity 
                key={tab}
                onPress={() => setActiveTab(tab as any)}
                className={`flex-1 p-3 rounded-lg border items-center ${activeTab === tab ? 'bg-primary border-primary' : 'bg-card border-border'}`}
              >
                  <Text className={activeTab === tab ? 'text-white font-bold' : 'text-subtext font-bold'}>
                      {tab === 'weight' ? 'PESO' : tab === 'measures' ? 'MEDIDAS' : 'FOTOS'}
                  </Text>
              </TouchableOpacity>
          ))}
      </View>

      <ScrollView className="flex-1 px-4">
          {activeTab === 'weight' && (
              <>
                <Text className="text-subtext text-xs mb-2 text-center">Média Móvel (7 Dias)</Text>
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
                  {photos.length === 0 && <Text className="text-subtext text-center mt-10">Nenhuma foto registrada.</Text>}
                  {photos.map((entry) => (
                      <View key={entry.id} className="mb-8">
                          <Text className="text-primary font-bold mb-2 uppercase tracking-widest border-b border-border pb-1">
                              {new Date(entry.date).toLocaleDateString()}
                          </Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                              {entry.photoFront && (
                                  <View>
                                      <Image source={{ uri: entry.photoFront }} className="w-40 h-56 rounded-lg bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-[10px] mt-1">FRENTE</Text>
                                  </View>
                              )}
                              {entry.photoBack && (
                                  <View>
                                      <Image source={{ uri: entry.photoBack }} className="w-40 h-56 rounded-lg bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-[10px] mt-1">COSTAS</Text>
                                  </View>
                              )}
                              {entry.photoSide && (
                                  <View>
                                      <Image source={{ uri: entry.photoSide }} className="w-40 h-56 rounded-lg bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-[10px] mt-1">PERFIL</Text>
                                  </View>
                              )}
                          </ScrollView>
                      </View>
                  ))}
              </View>
          )}
          
          <View className="h-10" />
      </ScrollView>
    </View>
  );
}
