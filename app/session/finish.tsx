import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { db } from '../../src/db/client';
import { sessions, bodyMetrics } from '../../src/db/schema';
import { eq, desc } from 'drizzle-orm';
import Slider from '@react-native-community/slider';

export default function FinishSessionScreen() {
  const router = useRouter();
  const { sessionId, startTime } = useLocalSearchParams();
  
  const [weight, setWeight] = useState('');
  const [sRpe, setSRpe] = useState<number>(7); // Média
  const [notes, setNotes] = useState('');

  // Pré-carregar peso da Bio
  useEffect(() => {
    const fetchLastWeight = async () => {
        try {
            const lastMetrics = await db.select({ weight: bodyMetrics.weight })
                .from(bodyMetrics)
                .where(eq(bodyMetrics.type, 'daily')) // Ou qualquer tipo que tenha peso
                .orderBy(desc(bodyMetrics.date))
                .limit(1);
            
            if (lastMetrics.length > 0 && lastMetrics[0].weight) {
                setWeight(lastMetrics[0].weight.toString());
            }
        } catch (e) {
            console.error("Erro ao buscar peso:", e);
        }
    };
    fetchLastWeight();
  }, []);

  const handleFinish = async () => {
    try {
      const endTimestamp = Date.now();
      const startTimestamp = Number(startTime);
      const durationMinutes = Math.round((endTimestamp - startTimestamp) / 60000);

      // 1. Atualizar Sessão
      await db.update(sessions)
        .set({
          endTime: endTimestamp,
          durationMinutes: durationMinutes > 0 ? durationMinutes : 1, // Mínimo 1 min
          bodyWeight: weight ? Number(weight) : null,
          sRpe: sRpe,
          notes: notes
        })
        .where(eq(sessions.id, Number(sessionId)));

      // 2. Salvar Peso na Bio (Sincronização)
      if (weight) {
          await db.insert(bodyMetrics).values({
              date: endTimestamp,
              type: 'daily',
              weight: Number(weight)
          });
      }

      // Navegar para o resumo
      router.replace({
        pathname: '/session/summary',
        params: { sessionId }
      });

    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao finalizar sessão.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="text-text text-3xl font-bold mb-6">Finalizar Treino</Text>

        {/* Peso Corporal */}
        <View className="mb-6">
          <Text className="text-subtext font-bold mb-2 uppercase text-sm tracking-wider">Peso Corporal (KG)</Text>
          <TextInput
            className="bg-card text-text text-xl p-4 rounded-xl border border-border"
            keyboardType="numeric"
            placeholder="Ex: 82.5"
            placeholderTextColor="#9CA3AF"
            value={weight}
            onChangeText={setWeight}
          />
        </View>

        {/* sRPE Selector */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-subtext font-bold uppercase text-sm tracking-wider">Esforço Percebido (sRPE)</Text>
            <View className="bg-primary px-4 py-1 rounded-full">
                <Text className="text-white font-bold text-xl">{sRpe}</Text>
            </View>
          </View>
          
          <Slider
            style={{width: '100%', height: 40}}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={sRpe}
            onValueChange={setSRpe}
            minimumTrackTintColor="#E07A5F"
            maximumTrackTintColor="#3D405B"
            thumbTintColor="#E07A5F"
          />

          <View className="flex-row justify-between px-1">
              <Text className="text-subtext text-[10px]">REGENERATIVO</Text>
              <Text className="text-subtext text-[10px]">MÁXIMO</Text>
          </View>

          <Text className="text-primary font-bold text-center mt-4 text-lg">
            {sRpe <= 4 ? "Leve / Aquecimento" : sRpe <= 6 ? "Moderado" : sRpe <= 8 ? "Intenso / RPE 8-9" : "Falha Total"}
          </Text>
        </View>

        {/* Notas */}
        <View className="mb-8">
          <Text className="text-subtext font-bold mb-2 uppercase text-sm tracking-wider">Observações</Text>
          <TextInput
            className="bg-card text-text text-lg p-4 rounded-xl border border-border min-h-[100px]"
            multiline
            placeholder="Dores, ajustes de carga, energia..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity 
          className="bg-success p-4 rounded-xl items-center shadow-lg active:opacity-90"
          onPress={handleFinish}
        >
          <Text className="text-white font-bold text-xl uppercase tracking-widest">Gerar Relatório</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}