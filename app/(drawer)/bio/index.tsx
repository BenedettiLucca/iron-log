import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { db } from '../../../src/db/client';
import { bodyMetrics } from '../../../src/db/schema';
import { desc, eq } from 'drizzle-orm';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Toast } from '../../../components/Toast';

export default function BioScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [todayWeight, setTodayWeight] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  
  // Estados para o Check-in Mensal
  const [monthlyData, setMonthlyData] = useState({
      waist: '', armRight: '', thighRight: '', chest: '', calf: ''
  });
  const [photos, setPhotos] = useState<Record<string, string | null>>({ front: null, back: null, side: null });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const data = await db.select().from(bodyMetrics).orderBy(desc(bodyMetrics.date));
      setMetrics(data || []);
    } catch (e) {
      console.error("Erro ao carregar métricas:", e);
      setMetrics([]);
    }
  };

  const saveDailyWeight = async () => {
    if (!todayWeight) return;
    try {
        await db.insert(bodyMetrics).values({
            date: Date.now(),
            type: 'daily',
            weight: Number(todayWeight)
        });
        setTodayWeight('');
        loadMetrics();
        setToast({ visible: true, message: 'Peso registrado!', type: 'success' });
    } catch (e) {
        setToast({ visible: true, message: 'Falha ao salvar peso.', type: 'error' });
    }
  };

  const pickImage = async (field: 'front' | 'back' | 'side') => {
      try {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            setToast({ visible: true, message: 'Precisamos de acesso às fotos para salvar sua evolução.', type: 'error' });
            return;
          }

          const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
              const uri = result.assets[0].uri;
              const fileName = `checkin_${Date.now()}_${field}.jpg`;
              const newPath = FileSystem.documentDirectory + fileName;

              await FileSystem.copyAsync({ from: uri, to: newPath });
              setPhotos(prev => ({ ...prev, [field]: newPath }));
          }
      } catch (e) {
          setToast({ visible: true, message: 'Falha ao selecionar imagem.', type: 'error' });
      }
  };

  const saveMonthlyCheckin = async () => {
      try {
          await db.insert(bodyMetrics).values({
              date: Date.now(),
              type: 'monthly',
              weight: Number(todayWeight) || (metrics.length > 0 ? metrics[0].weight : 0),
              waist: Number(monthlyData.waist) || 0,
              armRight: Number(monthlyData.armRight) || 0,
              thighRight: Number(monthlyData.thighRight) || 0,
              chest: Number(monthlyData.chest) || 0,
              calf: Number(monthlyData.calf) || 0,
              photoFront: photos.front,
              photoBack: photos.back,
              photoSide: photos.side
          });
          setModalVisible(false);
          loadMetrics();
          setToast({ visible: true, message: 'Check-in mensal realizado!', type: 'success' });
      } catch (e) {
          console.error(e);
          setToast({ visible: true, message: 'Falha ao salvar check-in.', type: 'error' });
      }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Bio & Evolução' }} />
      
      <ScrollView className="p-4">
        {/* Card de Peso Diário */}
        <View className="bg-card p-4 rounded-xl border border-border mb-6 shadow-sm">
            <Text className="text-subtext font-bold uppercase text-xs mb-2 tracking-widest">Registrar Peso (kg)</Text>
            <View className="flex-row gap-4">
                <TextInput 
                    className="flex-1 bg-background text-text p-3 rounded-lg border border-border font-bold text-lg"
                    keyboardType="numeric"
                    value={todayWeight}
                    onChangeText={setTodayWeight}
                    placeholder="00.0"
                    placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity onPress={saveDailyWeight} className="bg-primary justify-center px-6 rounded-lg shadow-sm">
                    <Text className="text-white font-bold uppercase text-xs">SALVAR</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Botão Evolução */}
        <TouchableOpacity 
            onPress={() => router.push('/bio/evolution')}
            className="bg-card border border-primary p-4 rounded-xl items-center mb-6 flex-row justify-center gap-2"
        >
            <Text className="text-primary font-bold text-lg uppercase tracking-widest">VER EVOLUÇÃO COMPLETA</Text>
            <Text className="text-primary font-bold text-lg">></Text>
        </TouchableOpacity>

        {/* Botão de Check-in Mensal */}
        <TouchableOpacity 
            onPress={() => setModalVisible(true)}
            className="bg-secondary p-5 rounded-xl border border-secondary/20 mb-6 flex-row justify-between items-center shadow-md"
        >
            <View>
                <Text className="text-white font-bold text-lg uppercase tracking-wider">NOVO CHECK-IN</Text>
                <Text className="text-white/70 text-xs mt-1 italic">Medidas e Fotos de Evolução</Text>
            </View>
            <View className="bg-white/20 w-8 h-8 rounded-full justify-center items-center">
                <Text className="text-white text-xl font-bold">+</Text>
            </View>
        </TouchableOpacity>

        {/* Galeria Recente (Último Monthly) */}
        {metrics.find(m => m.type === 'monthly') && (
            <View className="bg-card p-4 rounded-xl border border-border mb-6 shadow-sm">
                <Text className="text-subtext font-bold uppercase text-xs mb-4 tracking-widest">FOTOS RECENTES</Text>
                <View className="flex-row justify-between">
                    {['photoFront', 'photoBack', 'photoSide'].map((p, idx) => {
                        const latestMonthly = metrics.find(m => m.type === 'monthly' && m[p]);
                        const uri = latestMonthly?.[p];
                        return (
                            <View key={p} className="w-[31%] aspect-[3/4] bg-background rounded-lg border border-border overflow-hidden">
                                {uri ? (
                                    <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                                ) : (
                                    <View className="w-full h-full justify-center items-center">
                                        <Text className="text-[8px] text-subtext uppercase">VAZIO</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>
        )}

        {/* Histórico Detalhado */}
        <Text className="text-subtext font-bold uppercase text-xs mb-2 tracking-widest pl-1">HISTÓRICO</Text>
        <View className="gap-2 mb-10">
            {metrics.map((item) => (
                <View key={item.id} className="bg-card p-3 rounded-lg border border-border flex-row justify-between items-center">
                    <Text className="text-subtext text-xs font-mono">{new Date(item.date).toLocaleDateString()}</Text>
                    <View>
                        {item.type === 'monthly' ? (
                            <Text className="text-primary font-bold text-xs uppercase">CHECK-IN</Text>
                        ) : (
                            <Text className="text-text font-bold">{item.weight}kg</Text>
                        )}
                    </View>
                </View>
            ))}
        </View>
      </ScrollView>

      {/* Modal de Check-in */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-background">
              <View className="flex-row justify-between items-center p-4 border-b border-border bg-card">
                  <Text className="text-text text-xl font-bold uppercase tracking-widest">CHECK-IN</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)} className="p-2 bg-danger/10 rounded-full">
                      <Text className="text-danger font-bold text-xs">FECHAR</Text>
                  </TouchableOpacity>
              </View>

              <ScrollView className="p-4">
                  <Text className="text-primary font-bold text-xs uppercase mb-4 tracking-widest">MEDIDAS (CM)</Text>
                  <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
                      {[
                          { label: 'CINTURA', key: 'waist' },
                          { label: 'TÓRAX', key: 'chest' },
                          { label: 'BRAÇO D.', key: 'armRight' },
                          { label: 'COXA D.', key: 'thighRight' },
                          { label: 'PANTUR.', key: 'calf' }
                      ].map(item => (
                        <View key={item.key} className="w-[48%]">
                            <Text className="text-subtext text-[10px] uppercase font-bold mb-1 ml-1">{item.label}</Text>
                            <TextInput 
                                className="bg-card text-text p-3 rounded-xl border border-border"
                                placeholder="00.0" placeholderTextColor="#9CA3AF"
                                keyboardType="numeric"
                                onChangeText={t => setMonthlyData(p => ({...p, [item.key]: t}))}
                            />
                        </View>
                      ))}
                  </View>

                  <Text className="text-primary font-bold text-xs uppercase mb-4 tracking-widest">FOTOS</Text>
                  <View className="flex-row justify-between mb-10">
                      {(['front', 'back', 'side'] as const).map(side => (
                          <TouchableOpacity 
                            key={side} 
                            onPress={() => pickImage(side)}
                            className="w-[31%] aspect-[3/4] bg-card border border-border border-dashed rounded-xl justify-center items-center overflow-hidden"
                          >
                              {photos[side] ? (
                                  <Image source={{ uri: photos[side] }} className="w-full h-full" />
                              ) : (
                                  <Text className="text-subtext text-xs uppercase">{side}</Text>
                              )}
                          </TouchableOpacity>
                      ))}
                  </View>

                  <TouchableOpacity onPress={saveMonthlyCheckin} className="bg-success p-5 rounded-2xl items-center mb-20 shadow-lg shadow-success/30">
                      <Text className="text-white font-bold text-lg uppercase tracking-widest">SALVAR</Text>
                  </TouchableOpacity>
              </ScrollView>
          </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}