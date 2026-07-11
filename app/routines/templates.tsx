import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n } from '../../src/i18n/index';
import { db } from '../../src/db/client';
import { routines, routineExercises } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Toast } from '../../components/Toast';
import { logger } from '@/services/logger';
import { Colors } from '@/constants/colors';
import { SectionHeader } from '@/components/SectionHeader';

import { useToast } from '../../hooks/use-toast';
import { useConfirmDialog } from '../../hooks/use-confirm-dialog';
export default function TemplateLibraryScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [templates, setTemplates] = useState<{ id: number; name: string; description: string; exercises: { id: number; name: string; target: string; notes: string; restSeconds: number | null }[] }[]>([]);
  const { toast, setToast } = useToast();
  const { dialog, setDialog } = useConfirmDialog();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const routineData = await db.select().from(routines).where(eq(routines.isTemplate, true));
      
      const templatesWithExercises: any[] = [];

      for (const routine of routineData) {
        try {
          const exercisesData = await db.select()
            .from(routineExercises)
            .where(eq(routineExercises.routineId, routine.id))
            .orderBy(routineExercises.orderIndex);

          const exercisesList: any[] = exercisesData.map((ex: any) => {
            return {
              id: ex.exerciseId,
              name: typeof ex.name === 'string' ? ex.name : '',
              target: typeof ex.target === 'string' ? ex.target : '',
              notes: typeof ex.notes === 'string' ? ex.notes : '',
              restSeconds: typeof ex.restSeconds === 'number' ? ex.restSeconds : null,
            };
          }) || [];

          templatesWithExercises.push({
            id: routine.id,
            name: typeof routine.name === 'string' ? routine.name : '',
            description: typeof routine.description === 'string' ? routine.description : '',
            exercises: exercisesList,
          });
        } catch (e) {
          logger.error('Error loading exercises for template', e);
        }
      }

      setTemplates(templatesWithExercises);
    } catch (e) {
      logger.error('Error loading templates', e);
    }
  };

  const handleLoadFromTemplate = async (template: any) => {
    try {
      const newRoutine = await db.insert(routines).values({
        name: `${template.name} (Cópia)`,
        description: template.description || '',
        isTemplate: false,
      }).returning();

      const newRoutineId = newRoutine[0].id;

      for (let i = 0; i < template.exercises.length; i++) {
        const ex = template.exercises[i];
        await db.insert(routineExercises).values({
          routineId: newRoutineId,
          exerciseId: ex.id,
          orderIndex: i,
          target: typeof ex.target === 'string' ? ex.target : null,
          notes: typeof ex.notes === 'string' ? ex.notes : null,
          restSeconds: typeof ex.restSeconds === 'number' ? ex.restSeconds : null,
        });
      }

      setToast({ visible: true, message: t('routines.templateLoadedWithExercises', { name: template.name, count: template.exercises.length }), type: 'success' });
      router.back();
    } catch (e) {
      logger.error('Error loading from template', e);
      setToast({ visible: true, message: t('routines.loadTemplateError'), type: 'error' });
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

  const renderTemplateCard = ({ item }: { item: any }) => (
    <Card className="mx-4 mb-1">
      <View className="mb-3">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="text-text text-lg font-bold flex-1 mr-2">{item.name}</Text>
          <Text className="text-subtext text-xs font-bold bg-primary/10 px-2 py-1 rounded">
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
          {item.exercises.slice(0, 4).map((ex: any) => (
            <View key={ex.id} className="bg-primary/5 border border-border/50 rounded-full px-3 py-1">
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
          title={t('common.delete') || 'Excluir'}
          onPress={() => handleDeleteTemplate(item.id, item.name)}
          variant="ghost"
          textStyle={{ color: Colors.danger }}
          size="sm"
        />
        <Button
          title="Usar"
          onPress={() => handleLoadFromTemplate(item)}
          variant="primary"
          size="sm"
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

      <FlatList
        data={templates}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        ListEmptyComponent={
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

      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute top-4 left-4 bg-card p-2 rounded-lg border border-border shadow-md"
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
