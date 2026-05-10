import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { db } from '../../../src/db/client';
import { bodyMetrics } from '../../../src/db/schema';
import { desc, eq, and, gte, lt } from 'drizzle-orm';
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
import { weightInputSchema } from '@/src/validators/forms';
import { useI18n } from '../../../src/i18n/index';
import { isCheckinDirty } from '@/src/utils/checkin-dirty';
import { validateMonthlyCheckin, buildCheckinEntryData, getMonthlyCheckinDateRange } from '@/src/utils/checkin-validation';

type CheckinPhotos = {
  front: string | null;
  back: string | null;
  side: string | null;
};

export default function BioScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.checkin === 'open') {
      setModalVisible(true);
    }
  }, [params.checkin]);
  const { metrics, fetchMetrics, saveDailyWeight: hookSaveWeight } = useBodyMetrics();
  const [todayWeight, setTodayWeight] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para o Check-in Mensal
  const [monthlyData, setMonthlyData] = useState<Record<string, string>>({
      waist: '', armRight: '', thighRight: '', chest: '', calf: ''
  });
  const [photos, setPhotos] = useState<CheckinPhotos>({ front: null, back: null, side: null });
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
      setToast({ visible: true, message: validation.error.issues[0]?.message || t('bio.invalidWeight'), type: 'error' });
      return;
    }
    const success = await hookSaveWeight(validation.data.weight);
    if (success) {
      setTodayWeight('');
      setToast({ visible: true, message: t('bio.saveWeightSuccess'), type: 'success' });
    } else {
      setToast({ visible: true, message: t('bio.saveWeightError'), type: 'error' });
    }
  };

  const pickImage = async (field: 'front' | 'back' | 'side') => {
      try {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            setToast({ visible: true, message: t('bio.photoPermission'), type: 'error' });
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
                      { resize: { width: 800 } },
                  ]
              );

              const fileName = `checkin_${Date.now()}_${field}.jpg`;
              const newPath = FileSystem.documentDirectory + fileName;

              await FileSystem.copyAsync({ from: manipResult.uri, to: newPath });
              setPhotos(prev => ({ ...prev, [field]: newPath }));
              
              setToast({ visible: true, message: t('bio.photoSelected'), type: 'success' });
          }
      } catch {
          setToast({ visible: true, message: t('bio.photoSelectError'), type: 'error' });
      }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const deletePhoto = (field: 'front' | 'back' | 'side') => {
      setDialog({
          visible: true,
          title: t('bio.deletePhoto'),
          message: t('bio.deletePhotoConfirm'),
          onConfirm: async () => {
              // Delete the physical file to prevent orphaned photos
              const photoUri = photos[field];
              if (photoUri) {
                try {
                  const fileInfo = await FileSystem.getInfoAsync(photoUri);
                  if (fileInfo.exists) {
                    await FileSystem.deleteAsync(photoUri, { idempotent: true });
                  }
                } catch (e) {
                  logger.warn('Failed to delete photo file', e);
                }
              }
              setPhotos(prev => ({ ...prev, [field]: null }));
              setPhotoNotes(prev => ({ ...prev, [field]: '' }));
              setDialog({ visible: false, title: '', message: '', onConfirm: () => {}, field: null });
              setToast({ visible: true, message: t('bio.photoRemoved'), type: 'success' });
          },
          field,
      });
  };

  const resetCheckinForm = useCallback(() => {
    setPhotos({ front: null, back: null, side: null });
    setPhotoNotes({ front: '', back: '', side: '' });
    setMonthlyData({ waist: '', armRight: '', thighRight: '', chest: '', calf: '' });
  }, []);

  const handleCloseModal = useCallback(() => {
    const dirty = isCheckinDirty({ photos, monthlyData, photoNotes });
    if (dirty) {
      setDialog({
        visible: true,
        title: t('bio.discardTitle'),
        message: t('bio.discardMessage'),
        onConfirm: () => {
          resetCheckinForm();
          setModalVisible(false);
          setDialog({ visible: false, title: '', message: '', onConfirm: () => {}, field: null });
        },
        field: null,
      });
    } else {
      setModalVisible(false);
    }
  }, [photos, monthlyData, photoNotes, t, resetCheckinForm]);

  const saveMonthlyCheckin = async () => {
      try {
          // Step 1: Validate — block save on failure
          const validation = validateMonthlyCheckin(monthlyData);
          if (!validation.success) {
              logger.warn('Monthly checkin validation blocked save:', validation.errors);
              const fields = validation.errors ? Object.keys(validation.errors).join(', ') : '';
              setToast({ visible: true, message: `${t('bio.validationError')}${fields ? ` (${fields})` : ''}`, type: 'error' });
              return;
          }

          // Step 2: Check for existing monthly entry this month
          const now = Date.now();
          const { startOfMonth, startOfNextMonth } = getMonthlyCheckinDateRange(now);

          const existingMonthly = await db.select().from(bodyMetrics)
              .where(and(
                eq(bodyMetrics.type, 'monthly'),
                gte(bodyMetrics.date, startOfMonth),
                lt(bodyMetrics.date, startOfNextMonth),
              ))
              .orderBy(desc(bodyMetrics.date))
              .limit(1);

          const existingData = existingMonthly[0];
          const existingId = existingData?.id ?? null;
          const entryDate = existingData?.date ?? now;

          // Step 3: Build entry data using validated values + fallbacks
          const entryData = buildCheckinEntryData({
            validated: validation.data!,
            existingData,
            photos,
            photoNotes,
            weight: Number(todayWeight) || (existingData?.weight ?? 0),
            date: entryDate,
          });

          // Step 4: Persist
          if (existingId) {
              await db.update(bodyMetrics).set(entryData).where(eq(bodyMetrics.id, existingId));
          } else {
              await db.insert(bodyMetrics).values(entryData);
          }

          resetCheckinForm();
          setModalVisible(false);
          fetchMetrics();
          setToast({ visible: true, message: t('bio.saveCheckinSuccess'), type: 'success' });
      } catch (e) {
          logger.error('Erro inesperado', e);
          setToast({ visible: true, message: t('bio.saveCheckinError'), type: 'error' });
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
                        label={t('bio.registerWeight')}
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
                        title={t("bio.save")} 
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
                <Text className="text-white font-bold text-xs uppercase tracking-wider">{t("bioNav.goals")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => router.push('/bio/evolution')}
                className="flex-1 bg-primary p-3 rounded-xl items-center justify-center flex-row shadow-sm active:opacity-90"
            >
                <Text className="text-lg mr-1.5">📈</Text>
                <Text className="text-white font-bold text-xs uppercase tracking-wider">{t("bioNav.evolution")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => router.push('/bio/analytics')}
                className="flex-1 bg-primary p-3 rounded-xl items-center justify-center flex-row shadow-sm active:opacity-90"
            >
                <Text className="text-lg mr-1.5">📊</Text>
                <Text className="text-white font-bold text-xs uppercase tracking-wider">{t("bioNav.data")}</Text>
            </TouchableOpacity>
        </View>

        {/* Check-in Mensal */}
        <Card>
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-primary font-bold text-xs uppercase tracking-widest">{t("bio.monthlyCheckin")}</Text>
                <TouchableOpacity 
                    onPress={() => setModalVisible(true)}
                    className="bg-primary px-4 py-2 rounded-xl active:opacity-80"
                >
                    <Text className="text-white font-bold text-xs uppercase">{t("bio.open")}</Text>
                </TouchableOpacity>
            </View>

            {/* Show last check-in photos as read-only thumbnails */}
            {metrics.find(m => m.type === 'monthly' && (m.photoFront || m.photoBack || m.photoSide)) ? (
                <View className="flex-row justify-between">
                    {(['photoFront', 'photoBack', 'photoSide'] as const).map((p) => {
                        const latestMonthly = metrics.find(m => m.type === 'monthly' && m[p]);
                        const uri = latestMonthly ? latestMonthly[p] : undefined;
                        const labelKey = p === 'photoFront' ? 'bio.front' : p === 'photoBack' ? 'bio.back' : 'bio.side';
                        return (
                            <View key={p} className="w-[31%] aspect-[3/4] bg-background rounded-lg border border-border overflow-hidden">
                                {uri ? (
                                    <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                                ) : (
                                    <View className="w-full h-full justify-center items-center">
                                        <Text className="text-subtext text-xs uppercase font-bold">{t(labelKey)}</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            ) : (
                <View className="items-center py-4">
                    <Text className="text-subtext text-xs uppercase font-bold">{t("bio.noCheckinYet")}</Text>
                </View>
            )}
        </Card>

        {/* Galeria Recente (Último Monthly) */}
        {metrics.find(m => m.type === 'monthly') && (
            <Card>
                <Text className="text-subtext font-bold uppercase text-xs mb-4 tracking-widest">{t("bio.recentPhotos")}</Text>
                <View className="flex-row justify-between">
                    {(['photoFront', 'photoBack', 'photoSide'] as const).map((p) => {
                        const latestMonthly = metrics.find(m => m.type === 'monthly' && m[p]);
                        const uri = latestMonthly ? latestMonthly[p] : undefined;
                        return (
                            <View key={p} className="w-[31%] aspect-[3/4] bg-background rounded-lg border border-border overflow-hidden">
                                {uri ? (
                                    <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                                ) : (
                                    <View className="w-full h-full justify-center items-center">
                                        <Text className="text-2xs text-subtext uppercase font-bold">{t("bio.empty")}</Text>
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
            <Text className="text-subtext font-bold uppercase text-xs mb-3 tracking-widest pl-1">{t("bio.history")}</Text>
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
                                <Text className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded font-bold uppercase">{t("bio.checkin")}</Text>
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
                  <Text className="text-text text-xl font-bold uppercase tracking-widest">{t("bio.checkin")}</Text>
                  <Button 
                    title={t("common.close")} 
                    onPress={handleCloseModal} 
                    variant="ghost" 
                    size="sm" 
                  />
              </View>

              <ScrollView className="p-5" contentContainerStyle={{ gap: 24 }}>
                  <View>
                    <Text className="text-primary font-bold text-xs uppercase mb-4 tracking-widest">{t("bio.measurements")}</Text>
                    <View className="flex-row flex-wrap justify-between gap-y-4">
                        {[
                            { label: t('bio.waist'), key: 'waist' },
                            { label: t('bio.chest'), key: 'chest' },
                            { label: t('bio.armRightAbbr'), key: 'armRight' },
                            { label: t('bio.thighRight'), key: 'thighRight' },
                            { label: t('bio.calf'), key: 'calf' }
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
                    <Text className="text-primary font-bold text-xs uppercase mb-4 tracking-widest">{t("bio.photos")}</Text>
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
                    title={t("bio.saveCheckin")} 
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
