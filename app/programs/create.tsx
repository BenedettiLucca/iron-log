import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import type { NavigationAction } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from '../../components/Toast';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DatePicker } from '../../components/DatePicker';
import { Dialog } from '../../components/Dialog';
import { usePrograms } from '@/hooks/use-programs';
import { getLocaleForLanguage, useI18n } from '../../src/i18n/index';
import { useToast } from '../../hooks/use-toast';
import { SectionHeader } from '@/components/SectionHeader';
import { isFormDirty } from '@/src/utils/form-dirty';

const GOALS = ['hypertrophy', 'strength', 'endurance'] as const;
export default function CreateProgramScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const { createProgram } = usePrograms();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState<string>('hypertrophy');
  const [weeksDuration, setWeeksDuration] = useState('6');
  const [deloadWeek, setDeloadWeek] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [weeksError, setWeeksError] = useState('');
  const [deloadError, setDeloadError] = useState('');
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const { toast, setToast } = useToast();

  const nameInputRef = useRef<TextInput>(null);
  const weeksInputRef = useRef<TextInput>(null);
  const deloadInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const initialSnapshotRef = useRef<readonly unknown[]>(['', '', 'hypertrophy', '6', '', startDate.getTime()]);
  const bypassRef = useRef(false);
  const pendingActionRef = useRef<NavigationAction | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (bypassRef.current) return;
      if (!['GO_BACK', 'POP'].includes(e.data.action.type)) return;
      const currentSnapshot = [name, description, goal, weeksDuration, deloadWeek, startDate.getTime()];
      if (!isFormDirty(currentSnapshot, initialSnapshotRef.current)) return;
      e.preventDefault();
      if (!pendingActionRef.current) {
        pendingActionRef.current = e.data.action;
        setShowDiscardDialog(true);
      }
    });
    return unsubscribe;
  }, [navigation, name, description, goal, weeksDuration, deloadWeek, startDate]);

  const handleConfirmDiscard = () => {
    bypassRef.current = true;
    setShowDiscardDialog(false);
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      navigation.dispatch(action);
    }
  };

  const handleCancelDiscard = () => {
    setShowDiscardDialog(false);
    pendingActionRef.current = null;
  };

  // Auto-calculate end date
  const endDate = useMemo(() => {
    const parsedWeeksDuration = Number(weeksDuration);
    const safeWeeksDuration = Number.isFinite(parsedWeeksDuration) ? parsedWeeksDuration : 0;
    const date = new Date(startDate);
    date.setDate(date.getDate() + safeWeeksDuration * 7);
    return date;
  }, [startDate, weeksDuration]);

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    setNameError('');
    setWeeksError('');
    setDeloadError('');

    if (!name.trim()) {
      const message = t('programs.errors.nameRequired');
      setNameError(message);
      nameInputRef.current?.focus();
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      setToast({ visible: true, message, type: 'error' });
      return;
    }

    const weeks = Number(weeksDuration);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 16) {
      const message = t('programs.errors.invalidWeeks');
      setWeeksError(message);
      weeksInputRef.current?.focus();
      scrollViewRef.current?.scrollTo({ y: 100, animated: true });
      setToast({ visible: true, message, type: 'error' });
      return;
    }

    const deload = deloadWeek.trim() ? Number(deloadWeek) : undefined;
    if (deload !== undefined && (!Number.isInteger(deload) || deload < 1 || deload >= weeks)) {
      const message = t('programs.errors.invalidDeload');
      setDeloadError(message);
      deloadInputRef.current?.focus();
      scrollViewRef.current?.scrollTo({ y: 150, animated: true });
      setToast({ visible: true, message, type: 'error' });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const program = await createProgram({
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: startDate.getTime(),
        endDate: endDate.getTime(),
        weeksDuration: weeks,
        deloadWeek: deload,
        goal,
      });

      if (program) {
        router.replace(`/programs/detail?programId=${program.id}` as any);
      } else {
        setToast({ visible: true, message: t('programs.createError'), type: 'error' });
      }
    } catch {
      setToast({ visible: true, message: t('programs.createError'), type: 'error' });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [name, description, goal, weeksDuration, deloadWeek, startDate, endDate, createProgram, router, t, setToast]);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-6 pb-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-primaryText text-sm font-semibold">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-text text-xl font-bold flex-1">{t('programs.createTitle')}</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 100 + insets.bottom,
          gap: 20,
        }}
      >
        {/* Program Name */}
        <Input
          ref={nameInputRef}
          label={t('programs.form.nameLabel')}
          placeholder={t('programs.form.namePlaceholder')}
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (nameError) setNameError('');
          }}
          error={nameError}
          maxLength={60}
          showCharacterCount
        />

        {/* Description */}
        <Input
          label={t('programs.form.descriptionLabel')}
          placeholder={t('programs.form.descriptionPlaceholder')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={200}
          showCharacterCount
        />

        {/* Goal Picker */}
        <View>
          <SectionHeader label={t('programs.form.goalLabel')} className="mb-3" />
          <View className="flex-row gap-2">
            {GOALS.map(g => {
              const isActive = goal === g;
              return (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGoal(g)}
                  className={`flex-1 py-2.5 px-3 rounded-full items-center border-2 justify-center ${
                    isActive
                      ? 'bg-primary border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  <Text className={`text-xs font-bold uppercase tracking-wider ${
                    isActive ? 'text-onPrimary' : 'text-subtext'
                  }`}>
                    {t(`programs.goals.${g}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Duration in Weeks */}
        <Input
          ref={weeksInputRef}
          label={t('programs.form.durationLabel')}
          placeholder="6"
          value={weeksDuration}
          onChangeText={(text) => {
            setWeeksDuration(text);
            if (weeksError) setWeeksError('');
          }}
          error={weeksError}
          keyboardType="number-pad"
          maxLength={2}
        />

        {/* Deload Week */}
        <Input
          ref={deloadInputRef}
          label={t('programs.form.deloadLabel')}
          placeholder={t('programs.form.deloadPlaceholder')}
          value={deloadWeek}
          onChangeText={(text) => {
            setDeloadWeek(text);
            if (deloadError) setDeloadError('');
          }}
          error={deloadError}
          keyboardType="number-pad"
          maxLength={2}
        />

        {/* Start Date */}
        <DatePicker
          label={t('programs.form.startDateLabel')}
          value={startDate}
          onChange={setStartDate}
          minimumDate={new Date()}
        />

        {/* End Date (auto-calculated) */}
        <View className="bg-primary/5 rounded-xl p-3 flex-row justify-between items-center border border-primary/10">
          <SectionHeader label={t('programs.form.endDateLabel')} />
          <Text className="text-text text-sm font-semibold">
            {endDate.toLocaleDateString(getLocaleForLanguage(language))}
          </Text>
        </View>

        {/* Summary Preview */}
        <Card className="bg-primarySurface">
          <Text className="text-primaryText font-bold text-xs uppercase tracking-widest mb-2">
            {t('programs.form.preview')}
          </Text>
          <Text className="text-text text-sm leading-6">
            {name || t('programs.form.untitled')}{'\n'}
            {t('programs.form.startDateLabel')}: {startDate.toLocaleDateString(getLocaleForLanguage(language))} → {endDate.toLocaleDateString(getLocaleForLanguage(language))}{'\n'}
            {weeksDuration || '0'} {t('programs.weeksLabel')}
            {deloadWeek ? ` • ${t('programs.form.deloadWeek', { week: deloadWeek })}` : ''}
          </Text>
        </Card>
      </ScrollView>

      {/* Submit Button */}
      <View
        className="p-4 border-t border-border bg-card shadow-lg"
        style={{ paddingBottom: 16 + insets.bottom }}
      >
        <Button
          title={t('programs.form.submit')}
          onPress={handleSubmit}
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={isSubmitting}
        />
      </View>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <Dialog
        visible={showDiscardDialog}
        title={t('common.discardChangesTitle')}
        message={t('common.discardChangesMessage')}
        confirmText={t('common.discardChanges')}
        type="destructive"
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscard}
      />
    </View>
  );
}
