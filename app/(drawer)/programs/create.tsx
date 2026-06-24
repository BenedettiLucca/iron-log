import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from '../../../components/Toast';
import { Input } from '../../../components/Input';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { DatePicker } from '../../../components/DatePicker';
import { usePrograms } from '@/hooks/use-programs';
import { getLocaleForLanguage, useI18n } from '../../../src/i18n/index';

const GOALS = ['hypertrophy', 'strength', 'endurance'] as const;

import { useToast } from '../../../hooks/use-toast';
export default function CreateProgramScreen() {
  const router = useRouter();
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
  const { toast, setToast } = useToast();

  // Auto-calculate end date
  const endDate = useMemo(() => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + parseInt(weeksDuration || '0', 10) * 7);
    return date;
  }, [startDate, weeksDuration]);

  const getGoalEmoji = (g: string) => {
    switch (g) {
      case 'hypertrophy': return '💪';
      case 'strength': return '🏋️';
      case 'endurance': return '🏃';
      default: return '🎯';
    }
  };

  const validate = useCallback((): boolean => {
    if (!name.trim()) {
      setNameError(t('programs.errors.nameRequired'));
      return false;
    }
    setNameError('');
    return true;
  }, [name, t]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const weeks = parseInt(weeksDuration, 10);
      const deload = deloadWeek ? parseInt(deloadWeek, 10) : undefined;

      if (isNaN(weeks) || weeks < 1) {
        setToast({ visible: true, message: t('programs.errors.invalidWeeks'), type: 'error' });
        setIsSubmitting(false);
        return;
      }

      if (deload !== undefined && (deload < 1 || deload > weeks)) {
        setToast({ visible: true, message: t('programs.errors.invalidDeload'), type: 'error' });
        setIsSubmitting(false);
        return;
      }

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
        setToast({ visible: true, message: t('programs.createSuccess'), type: 'success' });
        setTimeout(() => {
          router.push(`/programs/detail?programId=${program.id}` as any);
        }, 500);
      } else {
        setToast({ visible: true, message: t('programs.createError'), type: 'error' });
      }
    } catch {
      setToast({ visible: true, message: t('programs.createError'), type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [name, description, goal, weeksDuration, deloadWeek, startDate, endDate, createProgram, router, t, validate]);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-6 pb-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-primary text-sm font-semibold">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-text text-xl font-bold flex-1">{t('programs.createTitle')}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 100 + insets.bottom,
          gap: 20,
        }}
      >
        {/* Program Name */}
        <Input
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
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">
            {t('programs.form.goalLabel')}
          </Text>
          <View className="flex-row gap-2">
            {GOALS.map(g => (
              <TouchableOpacity
                key={g}
                onPress={() => setGoal(g)}
                className={`flex-1 py-3 px-2 rounded-xl items-center border-2 ${
                  goal === g
                    ? 'bg-primary/10 border-primary'
                    : 'bg-card border-border'
                }`}
              >
                <Text className="text-lg mb-1">{getGoalEmoji(g)}</Text>
                <Text className={`text-xs font-semibold ${
                  goal === g ? 'text-primary' : 'text-subtext'
                }`}>
                  {t(`programs.goals.${g}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Duration in Weeks */}
        <Input
          label={t('programs.form.durationLabel')}
          placeholder="6"
          value={weeksDuration}
          onChangeText={setWeeksDuration}
          keyboardType="number-pad"
          maxLength={2}
        />

        {/* Deload Week */}
        <Input
          label={t('programs.form.deloadLabel')}
          placeholder={t('programs.form.deloadPlaceholder')}
          value={deloadWeek}
          onChangeText={setDeloadWeek}
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
        <Card variant="bordered">
          <View className="flex-row justify-between items-center">
            <Text className="text-subtext text-xs font-bold uppercase tracking-widest">
              {t('programs.form.endDateLabel')}
            </Text>
            <Text className="text-text text-sm font-semibold">
              {endDate.toLocaleDateString(getLocaleForLanguage(language))}
            </Text>
          </View>
        </Card>

        {/* Summary Preview */}
        <Card className="bg-primary/5">
          <Text className="text-primary font-bold text-xs uppercase tracking-widest mb-2">
            {t('programs.form.preview')}
          </Text>
          <Text className="text-text text-sm leading-6">
            {getGoalEmoji(goal)} {name || t('programs.form.untitled')}{'\n'}
            📅 {startDate.toLocaleDateString(getLocaleForLanguage(language))} → {endDate.toLocaleDateString(getLocaleForLanguage(language))}{'\n'}
            📊 {weeksDuration || '0'} {t('programs.weeksLabel')}
            {deloadWeek ? ` • 💚 ${t('programs.form.deloadWeek', { week: deloadWeek })}` : ''}
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
          disabled={!name.trim() || isSubmitting}
        />
      </View>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}
