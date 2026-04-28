import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, RefreshControl, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { db } from '../../../src/db/client';
import { bodyMetrics } from '../../../src/db/schema';
import { desc, eq } from 'drizzle-orm';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Toast } from '../../../components/Toast';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Card } from '../../../components/Card';
import { Dialog } from '../../../components/Dialog';
import { logger } from '@/services/logger';
import { Colors } from '@/constants/colors';
import { useBodyMetrics } from '@/hooks/use-body-metrics';
import { weightInputSchema, monthlyCheckinSchema } from '@/src/validators/forms';

export default function BioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.checkin === 'open') {
      setModalVisible(true);
    }
  }, [params]);
  const { metrics, fetchMetrics, saveDailyWeight: hookSaveWeight } = useBodyMetrics();
  const [todayWeight, setTodayWeight] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para o Check-in Mensal
  const [monthlyData, setMonthlyData] = useState({
      waist: '', armRight: '', thighRight: '', chest: '', calf: ''
  });
  const [photos, setPhotos] = useState<Record<string, string | null>>({ front: null, back: null, side: null });
  const [photoNotes, setPhotoNotes] = useState<Record<string, string>>({ front: '', back: '', side: '' });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', onConfirm: () => {}, field: '' as 'front' | 'back' | 'side' | null });

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMetrics();
    setRefreshing(false);
  }, [fetchMetrics]);

  const saveDailyWeight = async () => {
    if (!todayWeight) return;
    const validation = weightInputSchema.safeParse({ weight: todayWeight });
    if (!validation.success) {
      setToast({ visible: true, message: validation.error.errors[0]?.message || 'Peso inválido', type: 'error' });
      return;
    }
    const success = await hookSaveWeight(validation.data.weight);
    if (success) {
      setTodayWeight('');
      setToast({ visible: true, message: 'Peso registrado!', type: 'success' });
    } else {
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
              quality: 1,
              allowsEditing: true,
              aspect: [3, 4],
          });

              if (!result.canceled && result.assets && result.assets.length > 0) {
                  const uri = result.assets[0].uri;

              const manipResult = await ImageManipulator.manipulateAsync(
                  uri,
                  [
                      { resize: { width: 800, height: 800 } },
                      { crop: { originX: 0, originY: 0, width: 800, height: 800 } },
                  ]
              );

              const fileName = `checkin_${Date.now()}_${field}.jpg`;
              const newPath = FileSystem.documentDirectory + fileName;

              await FileSystem.copyAsync({ from: manipResult.uri, to: newPath });
              setPhotos(prev => ({ ...prev, [field]: newPath }));
              
              setToast({ visible: true, message: 'Foto selecionada!', type: 'success' });
          }
      } catch {
          setToast({ visible: true, message: 'Falha ao selecionar imagem.', type: 'error' });
      }
  };

  const deletePhoto = (field: 'front' | 'back' | 'side') => {
      setDialog({
          visible: true,
          title: 'Excluir Foto',
          message: `Tem certeza que deseja excluir a foto ${field === 'front' ? 'frontal' : field === 'back' ? 'de costas' : 'lateral'}?`,
          onConfirm: async () => {
              setPhotos(prev => ({ ...prev, [field]: null }));
              setPhotoNotes(prev => ({ ...prev, [field]: '' }));
              setDialog({ visible: false, title: '', message: '', onConfirm: () => {}, field: null });
              setToast({ visible: true, message: 'Foto removida.', type: 'success' });
          },
          field,
      });
  };

  const saveMonthlyCheckin = async () => {
      try {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 0, -1).getTime();

          const existingMonthly = await db.select().from(bodyMetrics)
              .where(eq(bodyMetrics.type, 'monthly'))
              .orderBy(desc(bodyMetrics.date))
              .limit(1);

          const existingId = existingMonthly.length > 0 && existingMonthly[0].date >= startOfMonth && existingMonthly[0].date < endOfMonth
              ? existingMonthly[0].id
              : null;

          // Validate monthly data with Zod
          const monthlyValidation = monthlyCheckinSchema.safeParse(monthlyData);
          if (!monthlyValidation.success) {
              logger.warn('Monthly checkin validation failed:', monthlyValidation.error.flatten().fieldErrors);
          }
          const validatedMeasures = monthlyValidation.success ? monthlyValidation.data : {};
          
          const entryData = {
              date: existingMonthly.length > 0 && existingMonthly[0].date >= startOfMonth && existingMonthly[0].date < endOfMonth
                  ? existingMonthly[0].date
                  : Date.now(),
              type: 'monthly' as const,
              weight: Number(todayWeight) || (existingMonthly.length > 0 ? existingMonthly[0].weight : 0),
              waist: validatedMeasures.waist || (existingMonthly.length > 0 ? existingMonthly[0].waist : 0),
              armRight: validatedMeasures.armRight || (existingMonthly.length > 0 ? existingMonthly[0].armRight : 0),
              thighRight: validatedMeasures.thighRight || (existingMonthly.length > 0 ? existingMonthly[0].thighRight : 0),
              chest: validatedMeasures.chest || (existingMonthly.length > 0 ? existingMonthly[0].chest : 0),
              calf: validatedMeasures.calf || (existingMonthly.length > 0 ? existingMonthly[0].calf : 0),
              photoFront: photos.front || (existingMonthly.length > 0 ? existingMonthly[0].photoFront : null),
              photoBack: photos.back || (existingMonthly.length > 0 ? existingMonthly[0].photoBack : null),
              photoSide: photos.side || (existingMonthly.length > 0 ? existingMonthly[0].photoSide : null),
              photoNotes: JSON.stringify(photoNotes),
          };

          if (existingId) {
              await db.update(bodyMetrics).set(entryData).where(eq(bodyMetrics.id, existingId));
          } else {
              await db.insert(bodyMetrics).values(entryData);
          }

          setModalVisible(false);
          setPhotos({ front: null, back: null, side: null });
          setPhotoNotes({ front: '', back: '', side: '' });
          setMonthlyData({ waist: '', armRight: '', thighRight: '', chest: '', calf: '' });
          fetchMetrics();
          setToast({ visible: true, message: 'Check-in mensal realizado!', type: 'success' });
      } catch (e) {
          logger.error('Erro inesperado', e);
          setToast({ visible: true, message: 'Falha ao salvar check-in.', type: 'error' });
      }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
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

        {/* Botões de Ação Rápida */}
        <View className="flex-row gap-3 mb-4">
            <TouchableOpacity
                onPress={() => router.push('/bio/goals')}
                className="flex-1 bg-primary p-3 rounded-xl items-center justify-center flex-row shadow-sm active:opacity-90"
            >
                <Text className="text-lg mr-1.5">🎯</Text>
                <Text className="text-white font-bold text-xs uppercase tracking-wider">Metas</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => router.push('/bio/evolution')}
                className="flex-1 bg-primary p-3 rounded-xl items-center justify-center flex-row shadow-sm active:opacity-90"
            >
                <Text className="text-lg mr-1.5">📈</Text>
                <Text className="text-white font-bold text-xs uppercase tracking-wider">Evolução</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => router.push('/bio/analytics')}
                className="flex-1 bg-primary p-3 rounded-xl items-center justify-center flex-row shadow-sm active:opacity-90"
            >
                <Text className="text-lg mr-1.5">📊</Text>
                <Text className="text-white font-bold text-xs uppercase tracking-wider">Dados</Text>
            </TouchableOpacity>
        </View>

        {/* Check-in Mensal */}
        <Card>
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-primary font-bold text-xs uppercase tracking-widest">CHECK-IN MENSAL</Text>
                <TouchableOpacity 
                    onPress={() => router.push('/bio/checkin')}
                    className="bg-primary px-4 py-2 rounded-xl active:opacity-80"
                >
                    <Text className="text-white font-bold text-xs uppercase">Abrir</Text>
                </TouchableOpacity>
            </View>

            <View className="flex-row justify-between">
                {(['front', 'back', 'side'] as const).map(side => {
                    const label = side === 'front' ? 'FRENTE' : side === 'back' ? 'COSTAS' : 'LATERAL';
                    return (
                        <View key={side} className="w-[31%]">
                            <TouchableOpacity 
                                onPress={() => pickImage(side)}
                                className="w-full aspect-[3/4] bg-background border-2 border-border border-dashed rounded-xl justify-center items-center overflow-hidden active:opacity-70 relative"
                            >
                                {photos[side] ? (
                                    <>
                                        <Image source={{ uri: photos[side] }} className="w-full h-full" />
                                        <TouchableOpacity
                                            onPress={() => deletePhoto(side)}
                                            className="absolute top-2 right-2 bg-danger/90 w-6 h-6 rounded-full justify-center items-center shadow-lg"
                                        >
                                            <Text className="text-white text-xs font-bold">✕</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <View className="items-center">
                                        <Text className="text-2xl mb-1">📷</Text>
                                        <Text className="text-subtext text-xs uppercase font-bold">{label}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TextInput
                                className="mt-2 bg-card rounded-lg px-2 py-1.5 text-xs text-text border border-border"
                                placeholder="Notas..."
                                placeholderTextColor={Colors.darkSubtext}
                                value={photoNotes[side]}
                                onChangeText={t => setPhotoNotes(prev => ({ ...prev, [side]: t }))}
                                maxLength={60}
                            />
                        </View>
                    );
                })}
            </View>
        </Card>

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
                                        <Text className="text-2xs text-subtext uppercase font-bold">VAZIO</Text>
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
                                <Text className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded font-bold uppercase">CHECK-IN</Text>
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
                                        <Text className="text-subtext text-xs uppercase font-bold">{side}</Text>
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

      <Dialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onConfirm={() => {
            dialog.onConfirm();
        }}
        onCancel={() => {
            setDialog({ ...dialog, visible: false, title: '', message: '', onConfirm: () => {}, field: null });
        }}
      />
    </View>
  );
}
