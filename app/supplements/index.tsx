import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Modal, Switch, Platform } from 'react-native';
import { useSupplements } from '@/hooks/use-supplements';
import { useI18n } from '@/src/i18n';
import { Colors } from '@/constants/colors';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { Input } from '@/components/Input';
import { Toast } from '@/components/Toast';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState, ErrorState } from '@/components/ScreenState';
import { resolveScreenState } from '@/src/utils/screen-state';
import { Supplement, SupplementFrequency } from '@/src/types';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useToast } from '../../hooks/use-toast';
import { useConfirmDialog } from '../../hooks/use-confirm-dialog';
import Svg, { Path, Polyline, Line } from 'react-native-svg';
import { SectionHeader } from '@/components/SectionHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
const MoonIcon = ({ color }: { color: string }) => (
  <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Svg>
);

const CheckIcon = ({ color }: { color: string }) => (
  <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

const FlameIcon = ({ color }: { color: string }) => (
  <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </Svg>
);

const PlusIcon = ({ color = Colors.onPrimary }: { color?: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export default function SupplementsScreen() {
  const { t, language } = useI18n();
  const theme = useThemeColors();
  const listLabel = useMemo(() => {
    switch (language) {
      case 'pt':
        return 'Seus Suplementos';
      case 'es':
        return 'Sus Suplementos';
      case 'zh':
        return '您的补充剂';
      default:
        return 'Your Supplements';
    }
  }, [language]);
  const {
    items,
    todayLogs,
    isLoading,
    hasError,
    errorMessage,
    fetchSupplements,
    fetchTodayLogs,
    toggleSupplement,
    addSupplement,
    updateSupplement,
    deleteSupplement,
    getAllStreaks,
    seedDefaultSupplements,
  } = useSupplements();

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);
  const [streaks, setStreaks] = useState<Record<number, number>>({});

  // Operation state
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const operationLockRef = useRef(false);
  const togglingIdsRef = useRef<Set<number>>(new Set());

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [timing, setTiming] = useState('');
  const [frequency, setFrequency] = useState<SupplementFrequency>('daily');
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [isNighttime, setIsNighttime] = useState(false);
  const [emoji, setEmoji] = useState('💊');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const { toast, showToast, setToast } = useToast();
  const { dialog, setDialog } = useConfirmDialog();

  const loadData = useCallback(async () => {
    await Promise.all([fetchSupplements(), fetchTodayLogs()]);
  }, [fetchSupplements, fetchTodayLogs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const fetchStats = async () => {
      const newStreaks = await getAllStreaks(items.map(item => item.id));
      setStreaks(newStreaks);
    };
    if (items.length > 0) {
      fetchStats();
    }
  }, [items, getAllStreaks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleToggle = async (id: number) => {
    if (togglingIdsRef.current.has(id)) return;
    togglingIdsRef.current.add(id);
    setTogglingIds(prev => new Set(prev).add(id));
    try {
      const ok = await toggleSupplement(id);
      if (!ok) showToast(t('common.operationError'), 'error');
    } finally {
      togglingIdsRef.current.delete(id);
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openAddModal = () => {
    setEditingSupplement(null);
    setName('');
    setDosage('');
    setTiming('');
    setFrequency('daily');
    setReminderTime(null);
    setIsNighttime(false);
    setEmoji('💊');
    setModalVisible(true);
  };

  const openEditModal = (item: Supplement) => {
    setEditingSupplement(item);
    setName(item.name);
    setDosage(item.dosage);
    setTiming(item.timing);
    setFrequency(item.frequency);
    setReminderTime(item.reminderTime);
    setIsNighttime(item.isNighttime);
    setEmoji(item.emoji || '💊');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !dosage || !timing) {
      showToast(
        !name ? t('supplements.nameRequired') : !dosage ? t('supplements.dosageRequired') : t('supplements.timingRequired'),
        'error'
      );
      return;
    }

    if (operationLockRef.current || isSaving) return;
    const supplementData = {
      name,
      dosage,
      timing,
      frequency,
      reminderTime,
      isNighttime,
      emoji,
      orderIndex: editingSupplement ? editingSupplement.orderIndex : items.length,
      isActive: true,
    };

    operationLockRef.current = true;
    setIsSaving(true);
    try {
      const ok = editingSupplement
        ? await updateSupplement(editingSupplement.id, supplementData)
        : await addSupplement(supplementData);

      if (ok) {
        showToast(t('common.saveSuccess'), 'success');
        setModalVisible(false);
      } else {
        showToast(t('common.operationError'), 'error');
      }
    } finally {
      operationLockRef.current = false;
      setIsSaving(false);
    }
  };

  const handleDelete = (item: Supplement) => {
    setDialog({
      visible: true,
      title: t('supplements.deleteConfirm', { name: item.name }),
      message: t('supplements.deleteMessage'),
      onConfirm: async () => {
        if (operationLockRef.current || isDeleting) return;
        operationLockRef.current = true;
        setIsDeleting(true);
        try {
          const ok = await deleteSupplement(item.id);
          if (ok) {
            showToast(t('common.deleteSuccess'), 'success');
            setModalVisible(false);
          } else {
            showToast(t('common.operationError'), 'error');
          }
        } finally {
          operationLockRef.current = false;
          setDialog(prev => ({ ...prev, visible: false }));
          setIsDeleting(false);
        }
      }
    });
  };

  const handleSeedStack = async () => {
    if (operationLockRef.current || isSeeding) return;
    operationLockRef.current = true;
    setIsSeeding(true);
    try {
      const ok = await seedDefaultSupplements();
      if (!ok) showToast(t('common.operationError'), 'error');
    } finally {
      operationLockRef.current = false;
      setIsSeeding(false);
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      setReminderTime(`${hours}:${minutes}`);
    }
  };

  const todayProgress = useMemo(() => {
    if (items.length === 0) return 0;
    const takenCount = todayLogs.length;
    return Math.round((takenCount / items.length) * 100);
  }, [items, todayLogs]);

  const { status } = resolveScreenState({
    isLoading: isLoading && !refreshing && items.length === 0,
    hasError,
    hasContent: items.length > 0,
    errorMessage
  });

  if (status === 'loading') {
    return <LoadingState type="list" title={t('supplements.title')} />;
  }

  if (status === 'error') {
    return <ErrorState message={errorMessage} onRetry={loadData} />;
  }

  const isTaken = (id: number) => todayLogs.some(log => log.supplementId === id);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primaryText}
            colors={[theme.primaryText]}
          />
        }
      >
        {/* Header Stats */}
        {items.length > 0 && (
          <Card className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <SectionHeader label={t('supplements.todayProgress')} />
              <Text className="text-subtext text-xs font-bold">
                {t('supplements.completedCount', { taken: todayLogs.length, total: items.length })}
              </Text>
            </View>
            <View className="h-2 bg-primary/5 rounded-full overflow-hidden">
              <View 
                className="h-full bg-primary rounded-full"
                style={{ width: `${todayProgress}%` }} 
              />
            </View>
          </Card>
        )}

        {/* Supplements List */}
        {items.length === 0 && !isLoading ? (
          <View className="mt-10">
            <EmptyState
              title={t('supplements.empty')}
              description={t('supplements.emptyDesc')}
              actionLabel={t('supplements.seedStack')}
              onAction={handleSeedStack}
            />
          </View>
        ) : (
          <View className="gap-3">
            <SectionHeader label={listLabel} className="mb-1" />
            {items.map((item) => {
              const taken = isTaken(item.id);
              const toggling = togglingIds.has(item.id);
              const statusLabel = taken ? t('supplements.taken') : t('supplements.notTaken');

              return (
                <Card key={item.id} className={`border-l-4 ${taken ? 'border-primary' : 'border-border'}`}>
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      onPress={() => handleToggle(item.id)}
                      onLongPress={() => openEditModal(item)}
                      activeOpacity={0.7}
                      disabled={toggling}
                      className="flex-1 flex-row items-center"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: taken, busy: toggling }}
                      accessibilityLabel={t('supplements.toggleLabel', {
                        name: item.name,
                        status: statusLabel,
                        dosage: item.dosage,
                        timing: item.timing,
                      })}
                      accessibilityHint={taken ? t('supplements.toggleTakenHint') : t('supplements.togglePendingHint')}
                      hapticType="selection"
                    >
                      <View className="w-10 h-10 rounded-full bg-primary/8 justify-center items-center mr-3">
                        <Text className="text-xl">{item.emoji || '💊'}</Text>
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className={`text-base font-bold ${taken ? 'text-subtext line-through opacity-60' : 'text-text'}`}>
                            {item.name}
                          </Text>
                          {item.isNighttime && (
                            <View className="ml-2">
                              <MoonIcon color={theme.secondaryText} />
                            </View>
                          )}
                        </View>
                        <Text className="text-xs text-subtext mt-0.5">
                          {item.dosage} • {item.timing}
                        </Text>
                      </View>

                      <View className="items-end gap-1.5 ml-2">
                        <View className={`w-7 h-7 rounded-full border-2 items-center justify-center ${taken ? 'bg-primary border-primary' : 'border-border'}`}>
                          {taken && <CheckIcon color={Colors.onPrimary} />}
                        </View>
                        {streaks[item.id] > 0 && (
                          <View className="flex-row items-center bg-primarySurface rounded-full px-2 py-0.5 gap-1">
                            <FlameIcon color={theme.primaryText} />
                            <Text className="text-primaryText font-bold text-xs">{streaks[item.id]}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>

                    <TouchableOpacity
                      onPress={() => openEditModal(item)}
                      className="w-11 h-11 rounded-full bg-background border border-border items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel={t('supplements.editActionLabel', { name: item.name })}
                      accessibilityHint={t('supplements.editActionHint')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text className="text-text text-2xl font-bold leading-6">⋯</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={openAddModal}
        className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg shadow-black/30"
        accessibilityRole="button"
        accessibilityLabel={editingSupplement ? t('supplements.editSupplement') : t('supplements.addSupplement')}
      >
        <PlusIcon />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="flex-row justify-between items-center p-5 border-b border-border bg-card">
            <SectionHeader label={editingSupplement ? t('supplements.editSupplement') : t('supplements.addSupplement')} />
            <Button 
              title={t('common.close')} 
              onPress={() => setModalVisible(false)} 
              variant="ghost" 
              size="sm" 
              disabled={isSaving || isDeleting}
            />
          </View>

          <ScrollView className="p-5" contentContainerStyle={{ gap: 20 }}>
            <View className="flex-row gap-4">
              <View className="w-16">
                <Input
                  label={t('supplements.emoji')}
                  value={emoji}
                  onChangeText={setEmoji}
                  maxLength={2}
                />
              </View>
              <View className="flex-1">
                <Input
                  label={t('supplements.name')}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('supplements.name')}
                />
              </View>
            </View>

            <Input
              label={t('supplements.dosage')}
              value={dosage}
              onChangeText={setDosage}
              placeholder={t('supplements.dosagePlaceholder')}
            />

            <Input
              label={t('supplements.timing')}
              value={timing}
              onChangeText={setTiming}
              placeholder={t('supplements.timingPlaceholder')}
            />

            <View>
              <Text className="text-subtext font-bold uppercase text-2xs mb-2 tracking-widest ml-1">
                {t('supplements.frequency')}
              </Text>
              <SegmentedControl
                segments={[
                  { key: 'daily', label: t('supplements.daily') },
                  { key: 'training_days', label: t('supplements.trainingDays') },
                  { key: 'rest_days', label: t('supplements.restDays') },
                ]}
                activeKey={frequency}
                onSelect={(key) => setFrequency(key as SupplementFrequency)}
              />
            </View>

            <View className="flex-row items-center justify-between bg-card p-4 rounded-2xl border border-border">
              <View>
                <Text className="text-text font-bold">{t('supplements.nighttime')}</Text>
                <Text className="text-subtext text-xs">🌙 {t('supplements.nighttime')}</Text>
              </View>
              <Switch
                value={isNighttime}
                onValueChange={setIsNighttime}
                trackColor={{ false: Colors.lightBorder, true: Colors.primary }}
              />
            </View>

            <TouchableOpacity 
              onPress={() => setShowTimePicker(true)}
              className="bg-card p-4 rounded-2xl border border-border flex-row justify-between items-center"
            >
              <View>
                <Text className="text-text font-bold">{t('supplements.reminderTime')}</Text>
                <Text className="text-subtext text-xs">{reminderTime || '--:--'}</Text>
              </View>
              <Text className="text-primaryText font-bold uppercase text-xs">{t('common.edit')}</Text>
            </TouchableOpacity>

            {showTimePicker && (
              <DateTimePicker
                value={reminderTime ? new Date(new Date().setHours(parseInt(reminderTime.split(':')[0]), parseInt(reminderTime.split(':')[1]))) : new Date()}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleTimeChange}
              />
            )}

            <View className="mt-4 gap-3">
              <Button 
                title={t('common.save')} 
                onPress={handleSave} 
                variant="primary" 
                size="lg"
                fullWidth
                loading={isSaving}
                disabled={isSaving || isDeleting}
              />
              
              {editingSupplement && (
                <Button 
                  title={t('supplements.deleteSupplement')} 
                  onPress={() => handleDelete(editingSupplement)} 
                  variant="ghost" 
                  size="sm"
                  fullWidth
                  loading={isDeleting}
                  disabled={isSaving || isDeleting}
                  textStyle={{ color: theme.dangerText }}
                />
              )}
            </View>
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
        onConfirm={dialog.onConfirm}
        onCancel={() => setDialog({ ...dialog, visible: false })}
      />
    </View>
  );
}
