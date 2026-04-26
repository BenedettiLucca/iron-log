import { useState, useCallback } from 'react';
import { View, Text, FlatList, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { db } from '../../../src/db/client';
import { exercises, routines as routinesTable, routineExercises } from '../../../src/db/schema';
import { eq, like } from 'drizzle-orm';
import * as Clipboard from 'expo-clipboard';
import { Toast } from '../../../components/Toast';
import { Dialog } from '../../../components/Dialog';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { RoutinePreview } from '../../../components/RoutinePreview';
import { SkeletonList } from '../../../components/Skeleton';
import { logger } from '@/services/logger';
import { Colors } from '@/constants/colors';
import { useRoutines } from '@/hooks/use-routines';

export default function RoutinesListScreen() {
  const router = useRouter();
  const { isLoading, folders, fetchRoutines, deleteRoutine, duplicateRoutine, getFilteredRoutines } = useRoutines();
  const [selectedFolder, setSelectedFolder] = useState<string>('Todos');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', onConfirm: () => {} });
  const [refreshing, setRefreshing] = useState(false);
  const [previewRoutine, setPreviewRoutine] = useState<{ id: number; name: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchRoutines();
    }, [fetchRoutines])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoutines();
    setRefreshing(false);
  }, [fetchRoutines]);

  const filteredRoutines = getFilteredRoutines(selectedFolder);

  const handleDelete = (id: number, name: string) => {
    setDialog({
      visible: true,
      title: 'Excluir Rotina',
      message: `Tem certeza que deseja apagar "${name}"? O histórico de treinos passados será mantido.`,
      onConfirm: async () => {
        const success = await deleteRoutine(id);
        if (!success) {
          setToast({ visible: true, message: 'Não foi possível excluir.', type: 'error' });
        }
      }
    });
  };

  const handleDuplicate = async (id: number, name: string) => {
    const newName = `${name} (Cópia)`;
    const success = await duplicateRoutine(id, newName);
    if (success) {
      setToast({ visible: true, message: `Rotina "${newName}" criada com sucesso!`, type: 'success' });
    } else {
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

      const existingRoutine = await db.select().from(routinesTable).where(eq(routinesTable.name, data.name));
      if (existingRoutine.length > 0) {
        return setToast({ visible: true, message: `Já existe uma rotina com o nome "${data.name}".`, type: 'error' });
      }

      const routineRes = await db.insert(routinesTable).values({
          name: data.name,
          description: data.description || ''
      }).returning();
      const routineId = routineRes[0].id;

      let order = 1;
      for (const item of data.exercises) {
        if (!item.name) continue;

        const exName = item.name.trim();
        const type = item.type === 'duration' ? 'duration' : 'strength';

        const existing = await db.select().from(exercises).where(like(exercises.name, exName));
        let exerciseId;

        if (existing.length > 0) {
            exerciseId = existing[0].id;
        } else {
            try {
                const newEx = await db.insert(exercises).values({ name: exName, type }).returning();
                exerciseId = newEx[0].id;
            } catch (err) {
                logger.error('Operation failed', "Erro ao criar exercício:", exName, err);
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
      logger.error('Operation failed', e);
      setToast({ visible: true, message: 'Falha ao importar do clipboard.', type: 'error' });
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pb-0 pt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-4">
          <Button
            title="💾 Templates"
            onPress={() => router.push('/routines/templates')}
            size="sm"
            variant="secondary"
            style={{ borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(156, 163, 175, 0.2)' }}
          />
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
            tintColor={Colors.primary}
            colors={[Colors.primary]}
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
