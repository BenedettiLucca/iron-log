import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { db } from '../../src/db/client';
import { bodyMetrics } from '../../src/db/schema';
import { desc, eq, and, gte, lt } from 'drizzle-orm';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Toast } from '../../components/Toast';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { Dialog } from '../../components/Dialog';
import { LoadingState, ErrorState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useBodyMetrics } from '@/hooks/use-body-metrics';
import { weightInputSchema } from '@/src/validators/forms';
import { getLocaleForLanguage, useI18n } from '../../src/i18n/index';
import { resolveScreenState } from '../../src/utils/screen-state';
import { isCheckinDirty } from '@/src/utils/checkin-dirty';
import { validateMonthlyCheckin, buildCheckinEntryData, getMonthlyCheckinDateRange, hasMonthlyCheckinContent } from '@/src/utils/checkin-validation';
import { isDisplayableBodyMetricValue } from '../../src/utils/body-metrics';
import { InlineEmptyState } from '../../components/EmptyState';
import { useToast } from '../../hooks/use-toast';
import { SectionHeader } from '../../components/SectionHeader';

type CheckinPhotos = {
  front: string | null;
  back: string | null;
  side: string | null;
};

export default function BioScreen() {
  const { t, language } = useI18n();
  const theme = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.checkin === 'open') {
      setModalVisible(true);
    }
  }, [params.checkin]);

  const {
    metrics,
    fetchMetrics,
    saveDailyWeight: hookSaveWeight,
    isLoading,
    hasError,
    errorMessage
  } = useBodyMetrics();

  const [todayWeight, setTodayWeight] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Estados para o Check-in Mensal
  const [monthlyData, setMonthlyData] = useState<Record<string, string>>({
      waist: '', armRight: '', thighRight: '', chest: '', calf: ''
  });
  const [photos, setPhotos] = useState<CheckinPhotos>({ front: null, back: null, side: null });
  const [photoNotes, setPhotoNotes] = useState<Record<string, string>>({ front: '', back: '', side: '' });
  const { toast, setToast } = useToast();
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

  const latestValidWeight = metrics.find(
    metric => isDisplayableBodyMetricValue(metric.weight) && metric.weight > 0,
  )?.weight ?? null;
  const latestMonthlyWithPhotos = metrics.find(
    metric => metric.type === 'monthly' && (metric.photoFront || metric.photoBack || metric.photoSide),
  );

  const saveMonthlyCheckin = useCallback(async () => {
      try {
          // Step 1: Validate — block save on failure
          const validation = validateMonthlyCheckin(monthlyData);
          if (!validation.success) {
              logger.warn('Monthly checkin validation blocked save:', validation.errors);
              const fields = validation.errors ? Object.keys(validation.errors).join(', ') : '';
              setToast({ visible: true, message: `${t('bio.validationError')}${fields ? ` (${fields})` : ''}`, type: 'error' });
              return;
          }

          if (!hasMonthlyCheckinContent({ validated: validation.data!, photos, photoNotes })) {
              setToast({ visible: true, message: t('bio.emptyCheckinError'), type: 'error' });
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

          // Step 3: Build entry data using validated values + fallbacks with precedence
          let finalWeight: number | null = null;
          const todayWeightNum = todayWeight.trim() !== '' ? Number(todayWeight) : NaN;
          if (!isNaN(todayWeightNum) && Number.isFinite(todayWeightNum) && todayWeightNum > 0) {
            finalWeight = todayWeightNum;
          } else if (isDisplayableBodyMetricValue(existingData?.weight) && existingData.weight > 0) {
            finalWeight = existingData.weight;
          } else {
            finalWeight = latestValidWeight;
          }

          const entryData = buildCheckinEntryData({
            validated: validation.data!,
            existingData,
            photos,
            photoNotes,
            weight: finalWeight ?? null,
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
  }, [monthlyData, t, todayWeight, photos, photoNotes, resetCheckinForm, fetchMetrics, setToast, latestValidWeight]);

  const { status } = resolveScreenState({
    isLoading: isLoading && !refreshing && metrics.length === 0,
    hasError,
    hasContent: metrics.length > 0,
    errorMessage
  });

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return <ErrorState message={errorMessage} onRetry={fetchMetrics} />;
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="px-4 pt-4 pb-4"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primaryText}
            colors={[theme.primaryText]}
          />
        }
      >
        {/* Card de Peso Diário */}
        <Card contentPadding={false}>
          <View className="p-3 gap-3">
            <SectionHeader label={t('bio.registerWeight')} />
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Input
                  keyboardType="numeric"
                  value={todayWeight}
                  onChangeText={setTodayWeight}
                  placeholder="00.0"
                  accessibilityLabel={t('bio.registerWeight')}
                  returnKeyType="done"
                  onSubmitEditing={saveDailyWeight}
                />
              </View>
              <Button
                title={t("bio.save")}
                onPress={saveDailyWeight}
                size="sm"
              />
            </View>
          </View>
        </Card>

        {/* Botões de Ação Rápida */}
        <Card contentPadding={false}>
          <View className="flex-col">
            {[
              { title: t("bioNav.goals"), route: '/bio/goals', icon: '🎯' },
              { title: t("bioNav.evolution"), route: '/bio/evolution', icon: '📈' },
              { title: t("bioNav.data"), route: '/bio/analytics', icon: '📊' },
              { title: t("drawer.supplements"), route: '/supplements', icon: '💊' },
              { title: t("reports.title"), route: '/reports/weekly', icon: '📝' }
            ].map((item, index, arr) => (
              <TouchableOpacity
                key={item.route}
                onPress={() => router.push(item.route as any)}
                className={`flex-row items-center px-4 min-h-[44px] active:opacity-75 ${
                  index < arr.length - 1 ? 'border-b border-border/50' : ''
                }`}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <Text className="text-lg mr-3">{item.icon}</Text>
                <Text className="text-sm text-text font-medium flex-1">
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Check-in Mensal */}
        <Card>
            <View className="flex-row justify-between items-center mb-4">
                <SectionHeader label={t("bio.monthlyCheckin")} />
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    className="bg-primary px-4 justify-center items-center min-h-[44px] min-w-[44px] rounded-lg active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel={t('bio.monthlyCheckin')}
                    accessibilityHint={t('bio.openMonthlyCheckinHint')}
                >
                    <Text className="text-onPrimary font-bold text-sm">{t("bio.open")}</Text>
                </TouchableOpacity>
            </View>

            {/* Show last check-in photos as read-only thumbnails */}
            {latestMonthlyWithPhotos ? (
                <View className="flex-row gap-2">
                    {(['photoFront', 'photoBack', 'photoSide'] as const).map((p) => {
                        const uri = latestMonthlyWithPhotos[p] ?? undefined;
                        const labelKey = p === 'photoFront' ? 'bio.front' : p === 'photoBack' ? 'bio.back' : 'bio.side';
                        return (
                            <View key={p} className="flex-1 min-w-0 aspect-[3/4] bg-background rounded-xl border border-border overflow-hidden">
                                {uri ? (
                                    <Image
                                      source={{ uri }}
                                      className="w-full h-full"
                                      resizeMode="cover"
                                      accessible
                                      accessibilityLabel={t(labelKey)}
                                    />
                                ) : (
                                    <View className="w-full h-full justify-center items-center">
                                        <Text className="text-subtext text-xs font-bold">{t(labelKey)}</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            ) : (
                <View className="items-center py-4">
                    <Text className="text-subtext text-xs font-bold">{t("bio.noCheckinYet")}</Text>
                </View>
            )}
        </Card>

        {/* Histórico Detalhado */}
        <View>
            <SectionHeader label={t("bio.history")} className="mb-3" />
            {metrics.length > 0 ? (
              <Card contentPadding={false} className="mb-8">
                  {metrics.slice(0, 10).map((item, index, arr) => (
                      <View
                        key={item.id}
                        className={`p-3 flex-row justify-between items-center ${
                          index < arr.length - 1 ? 'border-b border-border/50' : ''
                        }`}
                      >
                          <View className="flex-row items-center gap-3">
                              <View className={`w-2 h-2 rounded-full ${item.type === 'monthly' ? 'bg-secondary' : 'bg-primary'}`} />
                              <Text className="font-mono text-xs text-subtext">
                                  {new Date(item.date).toLocaleDateString(getLocaleForLanguage(language))}
                              </Text>
                          </View>

                          <View className="flex-row items-center gap-2">
                              {item.type === 'monthly' && (
                                  <Text className="text-xs bg-secondarySurface text-secondaryText px-2 py-0.5 rounded font-bold">{t("bio.checkin")}</Text>
                              )}
                              <Text className="text-text font-bold text-lg">
                                {isDisplayableBodyMetricValue(item.weight) && item.weight > 0 ? `${item.weight}kg` : '—'}
                              </Text>
                          </View>
                      </View>
                  ))}
              </Card>
            ) : (
              <InlineEmptyState
                icon="📋"
                title={t("bio.empty")}
              />
            )}
        </View>
      </ScrollView>

      {/* Modal de Check-in */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
          <View className="flex-1 bg-background" accessibilityViewIsModal>
              <View className="flex-row justify-between items-center p-5 border-b border-border bg-card">
                  <Text className="text-text text-xl font-bold uppercase tracking-widest">{t("bio.checkin")}</Text>
                  <Button
                    title={t("common.close")}
                    onPress={handleCloseModal}
                    variant="ghost"
                    size="sm"
                  />
              </View>

              <ScrollView
                className="p-5"
                automaticallyAdjustKeyboardInsets
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ gap: 24 }}
              >
                  <View>
                    <Text className="text-primaryText font-bold text-xs uppercase mb-4 tracking-widest">{t("bio.measurements")}</Text>
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
                    <Text className="text-primaryText font-bold text-xs uppercase mb-4 tracking-widest">{t("bio.photos")}</Text>
                    <View className="flex-row gap-2">
                        {(['front', 'back', 'side'] as const).map(side => (
                            <TouchableOpacity
                                key={side}
                                onPress={() => pickImage(side)}
                                accessibilityRole="button"
                                accessibilityLabel={t('bio.photoPickerLabel', { side: t(`bio.${side}`) })}
                                accessibilityHint={photos[side] ? t('bio.photoPickerSelectedHint') : t('bio.photoPickerHint', { side: t(`bio.${side}`) })}
                                accessibilityState={{ selected: !!photos[side] }}
                                className="flex-1 min-w-0 aspect-[3/4] bg-card border-2 border-border border-dashed rounded-xl justify-center items-center overflow-hidden active:opacity-70"
                            >
                                {photos[side] ? (
                                    <Image source={{ uri: photos[side] }} className="w-full h-full" />
                                ) : (
                                    <View className="items-center">
                                        <Text className="text-2xl mb-1">📷</Text>
                                        <Text className="text-subtext text-xs uppercase font-bold">{t(`bio.${side}`)}</Text>
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
