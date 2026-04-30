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
import { useI18n } from '../../../src/i18n/index';

export default function RoutinesListScreen() {
  const router = useRouter();
  const { isLoading, folders, fetchRoutines, deleteRoutine, duplicateRoutine, getFilteredRoutines } = useRoutines();
  const [selectedFolder, setSelectedFolder] = useState<string>('Todos');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', onConfirm: () => {} });
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useI18n();
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
      title: t('routines.deleteRoutineTitle'),
      message: t('routines.deleteRoutineMessage', { name }),
      onConfirm: async () => {
        const success = await deleteRoutine(id);
        if (!success) {
          setToast({ visible: true, message: t('routines.deleteError'), type: 'error' });
        }
      }
    });
  };

  const handleDuplicate = async (id: number, name: string) => {
    const newName = `${name} (${t('routines.copy')})`;
    const success = await duplicateRoutine(id, newName);
    if (success) {
      setToast({ visible: true, message: t('routines.duplicateSuccess', { name: newName }), type: 'success' });
    } else {
      setToast({ visible: true, message: t('routines.duplicateError'), type: 'error' });
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
          return setToast({ visible: true, message: t('routines.invalidJson'), type: 'error' });
      }

      if (!data.name || !Array.isArray(data.exercises)) {
          return setToast({ visible: true, message: t('routines.invalidJsonStructure'), type: 'error' });
      }

      const existingRoutine = await db.select().from(routinesTable).where(eq(routinesTable.name, data.name));
      if (existingRoutine.length > 0) {
        return setToast({ visible: true, message: t('routines.duplicateName', { name: data.name }), type: 'error' });
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
                logger.error(t('common.createExerciseError'), err);
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
      setToast({ visible: true, message: t('routines.importedWithExercises', { name: data.name, count: order - 1 }), type: 'success' });

    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('routines.importError'), type: 'error' });
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pb-0 pt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-4">
          <Button
            title={`💾 ${t('routines.tabTemplates')}`}
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
                <Text className="text-primary font-bold mb-2 text-xs uppercase tracking-widest">{t('routines.jsonImportHint')}</Text>
                <Text className="text-subtext text-xs leading-5">
                    {t('routines.jsonFormatHint')}{"\n"}
                    <Text className="font-mono text-xs text-text">
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
            <Text className="text-subtext text-center mt-10">{t('home.noRoutines')}</Text>
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
                      <Text className="text-xs bg-background text-subtext px-2 py-0.5 rounded-full border border-border">
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
                  accessibilityLabel={t("routines.startRoutine")}
                  accessibilityRole="button"
                  className="bg-success/10 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                >
                  <Text className="text-success text-xs font-bold uppercase">{t("routines.start")}</Text>
                  <Text className="text-success text-sm">▶</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            <View className="flex-row gap-2 border-t border-border pt-3 mt-2">
              <Button 
                title={t("routines.duplicate")}
                onPress={() => handleDuplicate(item.id, item.name)}
                variant="ghost"
                size="sm"
                style={{ flex: 1 }}
              />
              <Button 
                title={t("routines.edit")}
                onPress={() => router.push({ pathname: '/routines/editor', params: { id: item.id } })}
                variant="ghost"
                size="sm"
                style={{ flex: 1 }}
              />
              <Button 
                title={t("common.delete")}
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
            title={t('routines.import')}
            onPress={handleImportFromClipboard}
            variant="secondary"
            fullWidth
            />
        </View>

        <View className="flex-[2]">
            <Button
            title={t('routines.createNewRoutine')}
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
