import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n } from '../../src/i18n/index';
import { db } from '../../src/db/client';
import { routines, routineExercises, exercises } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Toast } from '../../components/Toast';
import { logger } from '@/services/logger';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { SectionHeader } from '@/components/SectionHeader';
import { LoadingState, ErrorState } from '@/components/ScreenState';

import { useToast } from '../../hooks/use-toast';
import { useConfirmDialog } from '../../hooks/use-confirm-dialog';
import {
  buildRoutineRowsFromTemplate,
  mapTemplateExercise,
  type TemplateExercise,
} from '@/src/utils/routine-template-integrity';
import {
  hasRoutineNameConflict,
  isRoutineNameUniqueConstraintError,
} from '@/src/utils/routine-name';
import { setPendingToast } from '@/src/utils/flash-toast';

type Template = {
  id: number;
  name: string;
  description: string;
  exercises: TemplateExercise[];
};

type LoadState = 'loading' | 'error' | 'empty' | 'content';

export default function TemplateLibraryScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, setToast } = useToast();
  const { dialog, setDialog } = useConfirmDialog();
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);

  const loadTemplates = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const routineData = await db.select().from(routines).where(eq(routines.isTemplate, true));

      const templatesWithExercises: Template[] = [];

      for (const routine of routineData) {
        // Any per-template exercise query failure fails the whole load
        const exercisesData = await db
          .select({
            exerciseId: exercises.id,
            name: exercises.name,
            target: routineExercises.target,
            notes: routineExercises.notes,
            restSeconds: routineExercises.restSeconds,
            orderIndex: routineExercises.orderIndex,
          })
          .from(routineExercises)
          .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
          .where(eq(routineExercises.routineId, routine.id))
          .orderBy(routineExercises.orderIndex);

        const exercisesList = exercisesData.map(mapTemplateExercise);

        templatesWithExercises.push({
          id: routine.id,
          name: typeof routine.name === 'string' ? routine.name : '',
          description: typeof routine.description === 'string' ? routine.description : '',
          exercises: exercisesList,
        });
      }

      setTemplates(templatesWithExercises);
      setLoadState(templatesWithExercises.length === 0 ? 'empty' : 'content');
    } catch (e) {
      logger.error('Error loading templates', e);
      setLoadError(t('states.errorBody'));
      setLoadState('error');
    }
  }, [t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleLoadFromTemplate = async (template: Template) => {
    if (isCreatingRef.current) return;

    isCreatingRef.current = true;
    setIsCreating(true);
    const copyName = t('routines.templateCopy', { name: template.name });

    try {
      const sameName = await db
        .select({ id: routines.id })
        .from(routines)
        .where(eq(routines.name, copyName));

      if (hasRoutineNameConflict(sameName)) {
        setToast({
          visible: true,
          message: t('routines.duplicateName', { name: copyName }),
          type: 'error',
        });
        return;
      }

      db.transaction((tx) => {
        const newRoutine = tx
          .insert(routines)
          .values({
            name: copyName,
            description: template.description || '',
            isTemplate: false,
          })
          .returning({ id: routines.id })
          .get();
        if (!newRoutine) throw new Error('Failed to create routine from template');

        const rows = buildRoutineRowsFromTemplate(newRoutine.id, template.exercises);
        if (rows.length > 0) {
          tx.insert(routineExercises).values(rows).run();
        }
      });

      setPendingToast({
        message: t('routines.templateLoadedWithExercises', {
          name: template.name,
          count: template.exercises.length,
        }),
        type: 'success',
      });
      router.back();
    } catch (e) {
      if (isRoutineNameUniqueConstraintError(e)) {
        setToast({
          visible: true,
          message: t('routines.duplicateName', { name: copyName }),
          type: 'error',
        });
      } else {
        logger.error('Error loading from template', e);
        setToast({ visible: true, message: t('routines.loadTemplateError'), type: 'error' });
      }
    } finally {
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  };

  const handleDeleteTemplate = (id: number, name: string) => {
    setDialog({
      visible: true,
      title: t('routines.deleteTemplateTitle'),
      message: t('routines.deleteTemplateMessage', { name }),
      onConfirm: async () => {
        try {
          await db.update(routines).set({ isTemplate: false }).where(eq(routines.id, id));
          await loadTemplates();
          setToast({ visible: true, message: t('routines.templateRemoved'), type: 'success' });
        } catch (e) {
          logger.error(t('common.operationError'), e);
          setToast({ visible: true, message: t('routines.deleteTemplateError'), type: 'error' });
        }
      },
    });
  };

  const renderTemplateCard = ({ item }: { item: Template }) => (
    <Card className="mx-4 mb-1">
      <View className="mb-3">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="text-text text-lg font-bold flex-1 mr-2">{item.name}</Text>
          <Text className="text-subtext text-xs font-bold bg-primarySurface px-2 py-1 rounded">
            {t('routines.exerciseCount', { count: item.exercises.length })}
          </Text>
        </View>
        {item.description && (
          <Text className="text-subtext text-sm" numberOfLines={2}>{item.description}</Text>
        )}
      </View>

      {/* Exercise Summary */}
      <View className="border-t border-border pt-3 mt-1 mb-4">
        <Text className="text-subtext text-2xs font-bold uppercase mb-2 tracking-wider">{t('routines.exercises')}:</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {item.exercises.slice(0, 4).map((ex) => (
            <View key={ex.exerciseId} className="bg-primary/5 border border-border/50 rounded-full px-3 py-1">
              <Text className="text-text text-xs font-medium">
                {ex.name}{ex.target ? ` • ${ex.target}` : ''}
              </Text>
            </View>
          ))}
          {item.exercises.length > 4 && (
            <Text className="text-subtext text-xs italic self-center pl-1">
              {t('routines.moreExercises', { count: item.exercises.length - 4 })}
            </Text>
          )}
        </View>
      </View>

      {/* Card Actions */}
      <View className="flex-row justify-between items-center mt-auto pt-2 border-t border-border/50">
        <Button
          title={t('common.delete')}
          onPress={() => handleDeleteTemplate(item.id, item.name)}
          variant="ghost"
          textStyle={{ color: theme.dangerText }}
          size="sm"
        />
        <Button
          title={t('common.use')}
          onPress={() => handleLoadFromTemplate(item)}
          variant="primary"
          size="sm"
          loading={isCreating}
          disabled={isCreating}
        />
      </View>
    </Card>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-16 pb-4">
        <SectionHeader label={t('routines.templateLibrary')} className="mb-1" />
        <Text className="text-subtext text-sm mb-4">{t('routines.templateLibraryDesc')}</Text>
      </View>

      {loadState === 'loading' && <LoadingState />}

      {loadState === 'error' && (
        <ErrorState message={loadError ?? undefined} onRetry={loadTemplates} />
      )}

      {(loadState === 'empty' || loadState === 'content') && (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            /* True zero-template empty state */
            <View className="border border-dashed border-border rounded-2xl p-6 bg-card items-center justify-center mx-4 my-8">
              <Text className="text-4xl mb-3">💾</Text>
              <Text className="text-text text-base font-bold text-center mb-1">{t('routines.noTemplates')}</Text>
              <Text className="text-subtext text-xs text-center mb-4">{t('routines.noTemplatesDesc')}</Text>
              <Button
                title={t('routines.createTemplate')}
                onPress={() => router.back()}
                variant="primary"
                size="sm"
              />
            </View>
          }
          renderItem={renderTemplateCard}
        />
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute top-4 left-4 bg-card p-2 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border shadow-md"
        accessibilityRole="button"
        accessibilityLabel={t('routines.back')}
      >
        <Text className="text-text font-bold">{t('routines.back')}</Text>
      </TouchableOpacity>

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
          setDialog({ visible: false, title: '', message: '', onConfirm: () => {} });
        }}
      />
    </View>
  );
}
