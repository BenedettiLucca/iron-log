import { useState, useCallback } from 'react';
import { View, Text, FlatList, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { db } from '../../../src/db/client';
import { routines, routineExercises, exercises } from '../../../src/db/schema';
import { eq, like } from 'drizzle-orm';
import * as Clipboard from 'expo-clipboard';
import { Toast } from '../../../components/Toast';
import { Dialog } from '../../../components/Dialog';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { RoutinePreview } from '../../../components/RoutinePreview';
import { SkeletonList } from '../../../components/Skeleton';

export default function RoutinesListScreen() {
  const router = useRouter();
  const [allRoutines, setAllRoutines] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('Todos');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', onConfirm: () => {} });
  const [refreshing, setRefreshing] = useState(false);
  const [previewRoutine, setPreviewRoutine] = useState<{ id: number; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchRoutines();
    }, [])
  );

  const fetchRoutines = async () => {
      try {
          setIsLoading(true);
          const data = await db.select().from(routines);
          setAllRoutines(data);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoutines();
    setRefreshing(false);
  }, []);

  const folders = ['Todos', ...Array.from(new Set(allRoutines?.map(r => r.folder || 'Geral') || []))];
  const filteredRoutines = selectedFolder === 'Todos' 
    ? allRoutines 
    : allRoutines?.filter(r => (r.folder || 'Geral') === selectedFolder);

  const handleDelete = (id: number, name: string) => {
    setDialog({
      visible: true,
      title: 'Excluir Rotina',
      message: `Tem certeza que deseja apagar "${name}"? O histórico de treinos passados será mantido.`,
      onConfirm: async () => {
        try {
          await db.delete(routineExercises).where(eq(routineExercises.routineId, id));
          await db.delete(routines).where(eq(routines.id, id));
          fetchRoutines();
        } catch {
          setToast({ visible: true, message: 'Não foi possível excluir.', type: 'error' });
        }
      }
    });
  };

  const handleDuplicate = async (id: number, name: string) => {
    try {
      // Get routine details
      const routineData = await db.select().from(routines).where(eq(routines.id, id));
      if (routineData.length === 0) return;

      const sourceRoutine = routineData[0];
      
      // Get exercises from source routine
      const exercisesData = await db.select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, id))
        .orderBy(routineExercises.orderIndex);

      // Create new routine with "(Cópia)" suffix
      const newRoutineName = `${name} (Cópia)`;
      const newRoutine = await db.insert(routines).values({
        name: newRoutineName,
        description: sourceRoutine.description,
        folder: sourceRoutine.folder,
      }).returning();

      const newRoutineId = newRoutine[0].id;

      // Copy exercises to new routine
      for (const ex of exercisesData) {
        await db.insert(routineExercises).values({
          routineId: newRoutineId,
          exerciseId: ex.exerciseId,
          orderIndex: ex.orderIndex,
          target: ex.target,
          notes: ex.notes,
          restSeconds: ex.restSeconds,
        });
      }

      fetchRoutines();
      setToast({ visible: true, message: `Rotina "${newRoutineName}" criada com sucesso!`, type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ visible: true, message: 'Falha ao duplicar rotina.', type: 'error' });
    }
  };

  const handleQuickStart = (routineId: number) => {
    router.push(`/session/${routineId}`);
  };

  const handleImportFromClipboard = async () => {
    try {
      const content = await Clipboard.getStringAsync();
      if (!content) return;

      let data;
      try {
          data = JSON.parse(content);
      } catch {
          return setToast({ visible: true, message: 'O texto copiado não é um JSON válido.', type: 'error' });
      }

      if (!data.name || !Array.isArray(data.exercises)) {
          return setToast({ visible: true, message: 'O JSON deve ter "name" e uma lista de "exercises".', type: 'error' });
      }

      // Verifica duplicidade
      const existingRoutine = await db.select().from(routines).where(eq(routines.name, data.name));
      if (existingRoutine.length > 0) {
        return setToast({ visible: true, message: `Já existe uma rotina com o nome "${data.name}".`, type: 'error' });
      }

      // 2. Criar Rotina
      const routineRes = await db.insert(routines).values({
          name: data.name,
          description: data.description || ''
      }).returning();
      const routineId = routineRes[0].id;

      // 3. Processar Exercícios
      let order = 1;
      for (const item of data.exercises) {
        if (!item.name) continue;

        const exName = item.name.trim();
        const type = item.type === 'duration' ? 'duration' : 'strength';

        // Buscar se já existe
        const existing = await db.select().from(exercises).where(like(exercises.name, exName));
        let exerciseId;

        if (existing.length > 0) {
            exerciseId = existing[0].id;
        } else {
            try {
                const newEx = await db.insert(exercises).values({ name: exName, type }).returning();
                exerciseId = newEx[0].id;
            } catch (err) {
                console.error("Erro ao criar exercício:", exName, err);
                continue;
            }
        }

        if (exerciseId) {
            await db.insert(routineExercises).values({
                routineId,
                exerciseId,
                orderIndex: order++,
                target: item.target || null,
                notes: item.notes || null,
                restSeconds: item.rest ? Number(item.rest) : null
            });
        }
      }

      fetchRoutines();
      setToast({ visible: true, message: `Rotina "${data.name}" importada com ${order-1} exercícios!`, type: 'success' });

    } catch (e) {
      console.error(e);
      setToast({ visible: true, message: 'Falha ao importar do clipboard.', type: 'error' });
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pb-0 pt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-4">
          {folders.map(folder => (
            <Button
              key={folder}
              title={folder}
              onPress={() => setSelectedFolder(folder)}
              size="sm"
              variant={selectedFolder === folder ? 'primary' : 'ghost'}
              style={{ borderRadius: 9999, borderWidth: 1, borderColor: selectedFolder === folder ? 'transparent' : 'rgba(156, 163, 175, 0.2)' }}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={isLoading ? [] : filteredRoutines}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E07A5F"
            colors={['#E07A5F']}
          />
        }
        ListHeaderComponent={
            isLoading ? null : (
            <Card className="mb-6 bg-card/50">
                <Text className="text-primary font-bold mb-2 text-xs uppercase tracking-widest">💡 Importação via JSON</Text>
                <Text className="text-subtext text-xs leading-5">
                    Peça para a IA gerar um JSON neste formato:{"\n"}
                    <Text className="font-mono text-[10px] text-text">
                        {`{ "name": "Treino A", "exercises": [ { "name": "Supino", "target": "4x10", "rest": 90 } ] }`}
                    </Text>
                </Text>
            </Card>
            )
        }
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={4} />
          ) : (
            <Text className="text-subtext text-center mt-10">Nenhuma rotina encontrada.</Text>
          )
        }
        renderItem={({ item }) => isLoading ? null : (
          <Card className="overflow-hidden">
            <TouchableOpacity 
              onPress={() => setPreviewRoutine({ id: item.id, name: item.name })}
              className="p-4 -m-4"
            >
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 mr-4">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-text text-lg font-bold">{item.name}</Text>
                    {item.folder && item.folder !== 'Geral' && (
                      <Text className="text-[10px] bg-background text-subtext px-2 py-0.5 rounded-full border border-border">
                          {item.folder}
                      </Text>
                    )}
                  </View>
                  <Text className="text-subtext text-sm" numberOfLines={1}>{item.description}</Text>
                </View>
                <TouchableOpacity 
                  onPress={(e) => {
                    e.stopPropagation();
                    handleQuickStart(item.id);
                  }}
                  className="bg-success/10 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                >
                  <Text className="text-success text-xs font-bold uppercase">Iniciar</Text>
                  <Text className="text-success text-sm">▶</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            <View className="flex-row gap-2 border-t border-border pt-3 mt-2">
              <Button 
                title="Duplicar"
                onPress={() => handleDuplicate(item.id, item.name)}
                variant="ghost"
                size="sm"
                style={{ flex: 1 }}
              />
              <Button 
                title="Editar"
                onPress={() => router.push({ pathname: '/routines/editor', params: { id: item.id } })}
                variant="ghost"
                size="sm"
                style={{ flex: 1 }}
              />
              <Button 
                title="Excluir"
                onPress={() => handleDelete(item.id, item.name)}
                variant="danger"
                size="sm"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}
      />

      <View className="p-4 border-t border-border flex-row gap-3 bg-card shadow-lg">
        <View className="flex-1">
            <Button 
            title="Importar"
            onPress={handleImportFromClipboard}
            variant="secondary"
            fullWidth
            />
        </View>

        <View className="flex-[2]">
            <Button
            title="Criar Nova Rotina"
            onPress={() => router.push('/routines/editor')}
            variant="primary"
            fullWidth
            />
        </View>
      </View>

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
          setDialog({ ...dialog, visible: false });
        }}
        onCancel={() => setDialog({ ...dialog, visible: false })}
      />

      <RoutinePreview
        visible={!!previewRoutine}
        routineId={previewRoutine?.id || null}
        routineName={previewRoutine?.name}
        onClose={() => setPreviewRoutine(null)}
        onStart={() => {
          if (previewRoutine) {
            handleQuickStart(previewRoutine.id);
          }
          setPreviewRoutine(null);
        }}
      />
    </View>
  );
}
