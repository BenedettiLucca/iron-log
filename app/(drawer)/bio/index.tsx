import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../../src/db/client';
import { bodyMetrics } from '../../../src/db/schema';
import { desc } from 'drizzle-orm';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Toast } from '../../../components/Toast';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Card } from '../../../components/Card';

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
    } catch {
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
      } catch {
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
      <ScrollView
        className="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 16 }}
      >
        {/* Card de Peso Diário */}
        <Card>
            <View className="flex-row items-center gap-4">
                <View className="flex-1">
                    <Input
                        label="REGISTRAR PESO (KG)"
                        keyboardType="numeric"
                        value={todayWeight}
                        onChangeText={setTodayWeight}
                        placeholder="00.0"
                        returnKeyType="done"
                        onSubmitEditing={saveDailyWeight}
                    />
                </View>
                <View className="pt-6">
                    <Button 
                        title="SALVAR" 
                        onPress={saveDailyWeight} 
                        size="sm"
                    />
                </View>
            </View>
        </Card>

        {/* Botão Evolução */}
        <Button 
            title="VER EVOLUÇÃO COMPLETA"
            onPress={() => router.push('/bio/evolution')}
            variant="ghost"
            fullWidth
            icon={<Text className="text-primary text-lg mr-2">📈</Text>}
        />

        {/* Botão de Check-in Mensal */}
        <TouchableOpacity 
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            className="bg-secondary rounded-2xl p-5 shadow-md flex-row justify-between items-center"
        >
            <View>
                <Text className="text-white font-bold text-xl uppercase tracking-wider">NOVO CHECK-IN</Text>
                <Text className="text-white/70 text-sm mt-1">Medidas e Fotos de Evolução</Text>
            </View>
            <View className="bg-white/20 w-10 h-10 rounded-full justify-center items-center">
                <Text className="text-white text-2xl font-bold">+</Text>
            </View>
        </TouchableOpacity>

        {/* Galeria Recente (Último Monthly) */}
        {metrics.find(m => m.type === 'monthly') && (
            <Card>
                <Text className="text-subtext font-bold uppercase text-xs mb-4 tracking-widest">FOTOS RECENTES</Text>
                <View className="flex-row justify-between">
                    {['photoFront', 'photoBack', 'photoSide'].map((p) => {
                        const latestMonthly = metrics.find(m => m.type === 'monthly' && m[p]);
                        const uri = latestMonthly?.[p];
                        return (
                            <View key={p} className="w-[31%] aspect-[3/4] bg-background rounded-lg border border-border overflow-hidden">
                                {uri ? (
                                    <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                                ) : (
                                    <View className="w-full h-full justify-center items-center">
                                        <Text className="text-[8px] text-subtext uppercase font-bold">VAZIO</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </Card>
        )}

        {/* Histórico Detalhado */}
        <View>
            <Text className="text-subtext font-bold uppercase text-xs mb-3 tracking-widest pl-1">HISTÓRICO RECENTE</Text>
            <View className="gap-2">
                {metrics.slice(0, 10).map((item) => (
                    <View key={item.id} className="bg-card p-4 rounded-2xl border border-border flex-row justify-between items-center">
                        <View className="flex-row items-center gap-3">
                            <View className={`w-2 h-2 rounded-full ${item.type === 'monthly' ? 'bg-secondary' : 'bg-primary'}`} />
                            <Text className="text-subtext text-xs font-mono font-medium">
                                {new Date(item.date).toLocaleDateString()}
                            </Text>
                        </View>
                        
                        <View className="flex-row items-center gap-2">
                            {item.type === 'monthly' && (
                                <Text className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded font-bold uppercase">CHECK-IN</Text>
                            )}
                            <Text className="text-text font-bold text-lg">{item.weight}kg</Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
      </ScrollView>

      {/* Modal de Check-in */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-background">
              <View className="flex-row justify-between items-center p-5 border-b border-border bg-card">
                  <Text className="text-text text-xl font-bold uppercase tracking-widest">CHECK-IN</Text>
                  <Button 
                    title="FECHAR" 
                    onPress={() => setModalVisible(false)} 
                    variant="ghost" 
                    size="sm" 
                  />
              </View>

              <ScrollView className="p-5" contentContainerStyle={{ gap: 24 }}>
                  <View>
                    <Text className="text-primary font-bold text-xs uppercase mb-4 tracking-widest">MEDIDAS (CM)</Text>
                    <View className="flex-row flex-wrap justify-between gap-y-4">
                        {[
                            { label: 'CINTURA', key: 'waist' },
                            { label: 'TÓRAX', key: 'chest' },
                            { label: 'BRAÇO D.', key: 'armRight' },
                            { label: 'COXA D.', key: 'thighRight' },
                            { label: 'PANTUR.', key: 'calf' }
                        ].map(item => (
                            <View key={item.key} className="w-[48%]">
                                <Input
                                    label={item.label}
                                    keyboardType="numeric"
                                    placeholder="00.0"
                                    onChangeText={t => setMonthlyData(p => ({...p, [item.key]: t}))}
                                />
                            </View>
                        ))}
                    </View>
                  </View>

                  <View>
                    <Text className="text-primary font-bold text-xs uppercase mb-4 tracking-widest">FOTOS</Text>
                    <View className="flex-row justify-between">
                        {(['front', 'back', 'side'] as const).map(side => (
                            <TouchableOpacity 
                                key={side} 
                                onPress={() => pickImage(side)}
                                className="w-[31%] aspect-[3/4] bg-card border-2 border-border border-dashed rounded-xl justify-center items-center overflow-hidden active:opacity-70"
                            >
                                {photos[side] ? (
                                    <Image source={{ uri: photos[side] }} className="w-full h-full" />
                                ) : (
                                    <View className="items-center">
                                        <Text className="text-2xl mb-1">📷</Text>
                                        <Text className="text-subtext text-[10px] uppercase font-bold">{side}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                  </View>

                  <Button 
                    title="SALVAR CHECK-IN" 
                    onPress={saveMonthlyCheckin} 
                    variant="success" 
                    size="lg"
                    fullWidth
                    style={{ marginBottom: 40 }}
                  />
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