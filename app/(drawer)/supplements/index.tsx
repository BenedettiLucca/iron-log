import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Modal, Switch, Platform } from 'react-native';
import { useSupplements } from '@/hooks/use-supplements';
import { useI18n } from '@/src/i18n';
import { Colors } from '@/constants/colors';
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

export default function SupplementsScreen() {
  const { t } = useI18n();
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
  
  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [timing, setTiming] = useState('');
  const [frequency, setFrequency] = useState<SupplementFrequency>('daily');
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [isNighttime, setIsNighttime] = useState(false);
  const [emoji, setEmoji] = useState('💊');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', onConfirm: () => {} });

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
    await toggleSupplement(id);
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
      setToast({
        visible: true,
        message: !name ? t('supplements.nameRequired') : !dosage ? t('supplements.dosageRequired') : t('supplements.timingRequired'),
        type: 'error'
      });
      return;
    }

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

    if (editingSupplement) {
      await updateSupplement(editingSupplement.id, supplementData);
      setToast({ visible: true, message: t('common.saveSuccess'), type: 'success' });
    } else {
      await addSupplement(supplementData);
      setToast({ visible: true, message: t('common.saveSuccess'), type: 'success' });
    }
    setModalVisible(false);
  };

  const handleDelete = (item: Supplement) => {
    setDialog({
      visible: true,
      title: t('supplements.deleteConfirm', { name: item.name }),
      message: t('supplements.deleteMessage'),
      onConfirm: async () => {
        await deleteSupplement(item.id);
        setDialog({ ...dialog, visible: false });
        setToast({ visible: true, message: t('common.deleteSuccess'), type: 'success' });
      }
    });
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
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header Stats */}
        {items.length > 0 && (
          <Card className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-primary font-bold text-xs uppercase tracking-widest">
                {t('supplements.todayProgress')}
              </Text>
              <Text className="text-subtext text-xs font-bold">
                {t('supplements.completedCount', { taken: todayLogs.length, total: items.length })}
              </Text>
            </View>
            <View className="h-2 bg-border rounded-full overflow-hidden">
              <View 
                className="h-full bg-primary" 
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
              onAction={seedDefaultSupplements}
            />
          </View>
        ) : (
          <View className="gap-3">
            {items.map((item) => {
              const taken = isTaken(item.id);
              const statusLabel = taken ? t('supplements.taken') : t('supplements.notTaken');

              return (
                <Card key={item.id} className={`border-l-4 ${taken ? 'border-primary' : 'border-border'}`}>
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      onPress={() => handleToggle(item.id)}
                      onLongPress={() => openEditModal(item)}
                      activeOpacity={0.7}
                      className="flex-1 flex-row items-center"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: taken }}
                      accessibilityLabel={t('supplements.toggleLabel', {
                        name: item.name,
                        status: statusLabel,
                        dosage: item.dosage,
                        timing: item.timing,
                      })}
                      accessibilityHint={taken ? t('supplements.toggleTakenHint') : t('supplements.togglePendingHint')}
                      hapticType="selection"
                    >
                      <Text className="text-2xl mr-3">{item.emoji || '💊'}</Text>
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className={`text-lg font-bold ${taken ? 'text-subtext line-through opacity-60' : 'text-text'}`}>
                            {item.name}
                          </Text>
                          {item.isNighttime && <Text className="ml-2 text-xs">🌙</Text>}
                        </View>
                        <Text className="text-subtext text-xs">
                          {item.dosage} • {item.timing}
                        </Text>
                      </View>

                      <View className="items-end gap-1 ml-2">
                        <View className={`w-7 h-7 rounded-full border-2 items-center justify-center ${taken ? 'bg-primary border-primary' : 'border-border'}`}>
                          {taken && <Text className="text-white text-xs font-bold">✓</Text>}
                        </View>
                        {streaks[item.id] > 0 && (
                          <View className="flex-row items-center">
                            <Text className="text-xs">🔥</Text>
                            <Text className="text-primary font-bold text-xs ml-0.5">{streaks[item.id]}</Text>
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
      >
        <Text className="text-white text-3xl font-light">+</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="flex-row justify-between items-center p-5 border-b border-border bg-card">
            <Text className="text-text text-xl font-bold uppercase tracking-widest">
              {editingSupplement ? t('supplements.editSupplement') : t('supplements.addSupplement')}
            </Text>
            <Button 
              title={t('common.close')} 
              onPress={() => setModalVisible(false)} 
              variant="ghost" 
              size="sm" 
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
              <View className="flex-row bg-card rounded-xl p-1 border border-border">
                {(['daily', 'training_days', 'rest_days'] as SupplementFrequency[]).map((f) => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setFrequency(f)}
                    className={`flex-1 py-2 items-center rounded-lg ${frequency === f ? 'bg-primary' : ''}`}
                  >
                    <Text className={`text-2xs font-bold uppercase ${frequency === f ? 'text-white' : 'text-subtext'}`}>
                      {f === 'daily' ? t('supplements.daily') : f === 'training_days' ? t('supplements.trainingDays') : t('supplements.restDays')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
              <Text className="text-primary font-bold uppercase text-xs">{t('common.edit')}</Text>
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
              />
              
              {editingSupplement && (
                <Button 
                  title={t('supplements.deleteSupplement')} 
                  onPress={() => handleDelete(editingSupplement)} 
                  variant="ghost" 
                  size="sm"
                  fullWidth
                  textStyle={{ color: Colors.danger }}
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
