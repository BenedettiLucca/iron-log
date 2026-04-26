import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../../src/db/client';
import { routines, routineExercises } from '../../../src/db/schema';
import { eq } from 'drizzle-orm';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { Dialog } from '../../../components/Dialog';
import { Toast } from '../../../components/Toast';
import { logger } from '@/services/logger';

export default function TemplateLibraryScreen() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', onConfirm: () => {} });

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
          logger.error('Operation failed', 'Error loading exercises for template:', e);
        }
      }

      setTemplates(templatesWithExercises);
    } catch (e) {
      logger.error('Operation failed', 'Error loading templates:', e);
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

      const exercisesData = await db.select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, template.id))
        .orderBy(routineExercises.orderIndex);

      for (const ex of template.exercises) {
        await db.insert(routineExercises).values({
          routineId: newRoutineId,
          exerciseId: ex.id,
          orderIndex: exercisesData.findIndex((e: any) => e.id === ex.id) || 0,
          target: typeof ex.target === 'string' ? ex.target : null,
          notes: typeof ex.notes === 'string' ? ex.notes : null,
          restSeconds: typeof ex.restSeconds === 'number' ? ex.restSeconds : null,
        });
      }

      setToast({ visible: true, message: `Rotina "${template.name}" carregada com ${template.exercises.length} exercícios!`, type: 'success' });
      router.back();
    } catch (e) {
      logger.error('Operation failed', 'Error loading from template:', e);
      setToast({ visible: true, message: 'Falha ao carregar template.', type: 'error' });
    }
  };

  const handleDeleteTemplate = (id: number, name: string) => {
    setDialog({
      visible: true,
      title: 'Excluir Template',
      message: `Tem certeza que deseja excluir o template "${name}"?`,
      onConfirm: async () => {
        try {
          await db.update(routines).set({ isTemplate: false }).where(eq(routines.id, id));
          await loadTemplates();
          setToast({ visible: true, message: 'Template removido.', type: 'success' });
        } catch (e) {
          logger.error('Operation failed', e);
          setToast({ visible: true, message: 'Falha ao excluir template.', type: 'error' });
        }
      },
    });
  };

  const renderTemplateCard = ({ item }: { item: any }) => (
    <Card className="overflow-hidden">
      <TouchableOpacity
        onPress={() => {
          handleLoadFromTemplate(item);
        }}
        activeOpacity={0.8}
        className="p-4"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 mr-4">
            <Text className="text-text text-lg font-bold">{item.name}</Text>
            {item.description && (
              <Text className="text-subtext text-sm" numberOfLines={1}>{item.description}</Text>
            )}
          </View>
          <Text className="text-subtext text-xs font-bold bg-primary/10 px-2 py-1 rounded">
            {item.exercises.length} ex
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteTemplate(item.id, item.name)}
          className="text-danger font-bold text-xs uppercase"
        >
          ✕
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Exercise Summary */}
      <View className="border-t border-border pt-2 mt-2">
        <Text className="text-subtext text-[10px] font-bold uppercase mb-1">Exercícios:</Text>
        <View className="flex-row flex-wrap gap-1">
          {item.exercises.slice(0, 4).map((ex: any, idx: number) => (
            <View key={ex.id} className="bg-background border border-border rounded px-2 py-1">
              <Text className="text-text text-xs font-medium">{ex.name}</Text>
              {ex.target && (
                <Text className="text-primary text-[10px]">• {ex.target}</Text>
              )}
            </View>
          ))}
          {item.exercises.length > 4 && (
            <Text className="text-subtext text-[10px] italic">+{item.exercises.length - 4} mais...</Text>
          )}
        </View>
      </View>
    </Card>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 py-4">
        <Text className="text-text text-2xl font-bold uppercase tracking-wider">Biblioteca de Templates</Text>
        <Text className="text-subtext text-sm mb-4">
          Seus templates salvos para criar rotinas rapidamente.
        </Text>
      </View>

      <FlatList
        data={templates}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ gap: 12 }}
        ListEmptyComponent={
          <EmptyState
            icon="💾"
            title="Nenhum template encontrado"
            description="Salve rotinas como templates para usar depois."
            actionLabel="Criar Template"
            onAction={() => router.back()}
          />
        }
        renderItem={renderTemplateCard}
      />

      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute top-4 left-4 bg-card p-2 rounded-lg border border-border shadow-md"
      >
        <Text className="text-text font-bold">← Voltar</Text>
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
