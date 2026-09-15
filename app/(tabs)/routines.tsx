import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, FlatList, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { RoutineImportService, RoutineImportError } from '@/services/RoutineImportService';
import * as Clipboard from 'expo-clipboard';
import { Toast } from '../../components/Toast';
import { Dialog } from '../../components/Dialog';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { RoutinePreview } from '../../components/RoutinePreview';
import { SkeletonList } from '../../components/Skeleton';
import { logger } from '@/services/logger';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useRoutines } from '@/hooks/use-routines';
import { useFolders } from '@/hooks/use-folders';
import { useI18n } from '../../src/i18n/index';
import {
  DEFAULT_FOLDER_NAME,
  getFolderChipNames,
  isSameFolderName,
} from '@/src/utils/folders';
import { buildSessionStartRoute } from '../../src/utils/session-start';
import { useToast } from '../../hooks/use-toast';
import { useConfirmDialog } from '../../hooks/use-confirm-dialog';
import { SectionHeader } from '@/components/SectionHeader';
import { consumePendingToast } from '@/src/utils/flash-toast';
import { FolderManagerModal } from '@/components/FolderManagerModal';
import Svg, { Path } from 'react-native-svg';
export default function RoutinesListScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const {
    isLoading,
    folders: routineFolders,
    fetchRoutines,
    deleteRoutine,
    duplicateRoutine,
    getFilteredRoutines,
  } = useRoutines();
  const {
    folders: persistedFolders,
    fetchFolders,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useFolders();
  const [selectedFolder, setSelectedFolder] = useState<string>('Todos');
  const [folderManagerVisible, setFolderManagerVisible] = useState(false);

  const folderChips = useMemo(() => getFolderChipNames(
    persistedFolders.length > 0
      ? persistedFolders.map((folder) => folder.name)
      : routineFolders.filter((folder) => folder !== 'Todos'),
  ), [persistedFolders, routineFolders]);

  useEffect(() => {
    if (!folderChips.includes(selectedFolder)) {
      setSelectedFolder('Todos');
    }
  }, [folderChips, selectedFolder]);

  const { toast, setToast } = useToast();
  const { dialog, setDialog } = useConfirmDialog();
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useI18n();
  const [previewRoutine, setPreviewRoutine] = useState<{ id: number; name: string } | null>(null);
  // #144 — navigation request parked until the preview modal has unmounted.
  const [pendingQuickStart, setPendingQuickStart] = useState<{ id: number; name: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const isImportingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      fetchRoutines();
      fetchFolders();
      const pendingToast = consumePendingToast();
      if (pendingToast) {
        setToast({ visible: true, ...pendingToast });
      } else {
        setToast({ visible: false, message: '', type: 'success' });
      }
    }, [fetchFolders, fetchRoutines, setToast])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRoutines(), fetchFolders()]);
    setRefreshing(false);
  }, [fetchFolders, fetchRoutines]);

  const filteredRoutines = getFilteredRoutines(selectedFolder);

  const handleRenameFolder = useCallback(async (id: number, name: string) => {
    const renamed = await renameFolder(id, name);
    await fetchRoutines();
    return renamed;
  }, [fetchRoutines, renameFolder]);

  const handleDeleteFolder = useCallback(async (id: number) => {
    await deleteFolder(id);
    await fetchRoutines();
  }, [deleteFolder, fetchRoutines]);

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

  const handleQuickStart = (routineId: number, routineName: string) => {
    router.push(buildSessionStartRoute({ id: routineId, name: routineName }));
  };

  // #144 — navigate only after React committed the modal unmount (previewRoutine is null).
  useEffect(() => {
    if (pendingQuickStart) {
      handleQuickStart(pendingQuickStart.id, pendingQuickStart.name);
      setPendingQuickStart(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuickStart]);

  const handleImportFromClipboard = async () => {
    if (isImportingRef.current) return;
    isImportingRef.current = true;
    setIsImporting(true);

    try {
      const content = await Clipboard.getStringAsync();
      if (!content || !content.trim()) {
        setToast({ visible: true, message: t('routines.emptyClipboard'), type: 'error' });
        return;
      }

      const result = await RoutineImportService.importRoutine(content);
      await fetchRoutines();
      setToast({
        visible: true,
        message: t('routines.importedWithExercises', {
          name: result.routineName,
          count: result.exercisesCount,
        }),
        type: 'success',
      });
    } catch (e) {
      if (e instanceof RoutineImportError) {
        switch (e.code) {
          case 'EMPTY_PAYLOAD':
            setToast({ visible: true, message: t('routines.emptyClipboard'), type: 'error' });
            break;
          case 'INVALID_JSON':
            setToast({ visible: true, message: t('routines.invalidJson'), type: 'error' });
            break;
          case 'INVALID_STRUCTURE':
            setToast({ visible: true, message: t('routines.invalidJsonStructure'), type: 'error' });
            break;
          case 'DUPLICATE_ROUTINE_NAME':
            setToast({
              visible: true,
              message: t('routines.duplicateName', { name: e.routineName || '' }),
              type: 'error',
            });
            break;
          default:
            logger.error(t('common.operationError'), e);
            setToast({ visible: true, message: t('routines.importError'), type: 'error' });
            break;
        }
      } else {
        logger.error(t('common.operationError'), e);
        setToast({ visible: true, message: t('routines.importError'), type: 'error' });
      }
    } finally {
      isImportingRef.current = false;
      setIsImporting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pb-3 pt-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 16 }}
        >
          <TouchableOpacity
            onPress={() => router.push('/programs')}
            activeOpacity={0.7}
            className="bg-card border border-border rounded-full py-1.5 px-3.5 min-h-[44px] items-center justify-center shrink-0"
          >
            <Text className="text-subtext text-sm font-semibold uppercase">{t('programs.title')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/routines/templates')}
            activeOpacity={0.7}
            className="bg-card border border-border rounded-full py-1.5 px-3.5 min-h-[44px] items-center justify-center shrink-0"
          >
            <Text className="text-subtext text-sm font-semibold uppercase">{t('routines.tabTemplates')}</Text>
          </TouchableOpacity>
          {folderChips.map((folder) => {
            const displayFolder = folder === 'Todos' ? t('routines.tabAll')
              : isSameFolderName(folder, DEFAULT_FOLDER_NAME) ? t('routines.tabGeneral')
              : folder;
            const isActive = selectedFolder === folder;
            return (
              <TouchableOpacity
                key={folder}
                onPress={() => setSelectedFolder(folder)}
                activeOpacity={0.7}
                className={`rounded-full py-1.5 px-3.5 border min-h-[44px] items-center justify-center shrink-0 ${
                  isActive ? 'bg-primary border-transparent' : 'bg-card border-border'
                }`}
              >
                <Text className={`text-sm font-semibold uppercase ${isActive ? 'text-onPrimary' : 'text-subtext'}`}>
                  {displayFolder}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => {
              setFolderManagerVisible(true);
              fetchFolders();
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            className="bg-card border border-border rounded-full py-1.5 px-3.5 min-h-[44px] items-center justify-center shrink-0"
          >
            <Text className="text-subtext text-sm font-semibold uppercase">{`+ ${t('routines.newFolder')}`}</Text>
          </TouchableOpacity>
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
            tintColor={theme.primaryText}
            colors={[theme.primaryText]}
          />
        }
        ListHeaderComponent={
            isLoading ? null : (
            <Card contentPadding={false} className="mb-6" style={{ backgroundColor: 'rgba(224,122,95,0.03)' }}>
              <View className="p-3 gap-2">
                <SectionHeader label={t('routines.jsonImportHint')} />
                <Text className="text-subtext text-xs leading-5" numberOfLines={3}>
                    {t('routines.jsonFormatHint')}{"\n"}
                    <Text className="font-mono text-xs text-text">
                        {`{ "name": "Treino A", "exercises": [ { "name": "Supino", "target": "4x10", "rest": 90 } ] }`}
                    </Text>
                </Text>
              </View>
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
              accessibilityRole="button"
              accessibilityLabel={t('routines.previewRoutineLabel', { name: item.name })}
              accessibilityHint={t('routines.previewRoutineHint')}
            >
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 mr-4">
                  <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                    <Text className="text-text text-lg font-bold">{item.name}</Text>
                    {item.folder && !isSameFolderName(item.folder, DEFAULT_FOLDER_NAME) && (
                      <View className="bg-background px-2.5 py-0.5 rounded-full border border-border">
                        <Text className="text-2xs text-subtext font-semibold">{item.folder}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-subtext text-sm" numberOfLines={1}>{item.description}</Text>
                </View>
                <TouchableOpacity 
                  onPress={(e) => {
                    e.stopPropagation();
                    handleQuickStart(item.id, item.name);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={t("routines.quickStartLabel", { name: item.name })}
                  accessibilityHint={t("routines.quickStartHint")}
                  accessibilityRole="button"
                  className="bg-successSurface px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                >
                  <Text className="text-successText text-xs font-bold uppercase">{t("routines.start")}</Text>
                  <Svg width="10" height="10" viewBox="0 0 24 24" accessible={false}>
                    <Path d="M8 5v14l11-7z" fill={theme.successText} />
                  </Svg>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            <View className="flex-row gap-2 border-t border-border/50 pt-3 mt-2">
              <Button 
                title={t("routines.duplicate")}
                onPress={() => handleDuplicate(item.id, item.name)}
                variant="ghost"
                size="sm"
                style={{ flex: 1 }}
              />
              <Button 
                title={t("common.edit")}
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

      <View className="p-4 border-t border-border bg-card shadow-lg">
        <View className="flex-row gap-3">
            <Button 
              title={t('routines.import')}
              onPress={handleImportFromClipboard}
              variant="secondary"
              size="sm"
              disabled={isImporting}
              loading={isImporting}
              style={{ flex: 1, minHeight: 44 }}
            />
            <Button
            title={t('routines.createNewRoutine')}
            onPress={() => router.push('/routines/editor')}
            variant="primary"
            size="sm"
            style={{ flex: 2, minHeight: 44 }}
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
            // #144 — stash the request and close the modal. Navigation happens
            // in the effect after React has committed the modal unmount; a
            // synchronous push here gets cancelled by the native stack while
            // the Modal is dismissing, orphaning the session row it creates.
            setPendingQuickStart({
              id: previewRoutine.id,
              name: previewRoutine.name,
            });
            setPreviewRoutine(null);
          }
        }}
      />

      <FolderManagerModal
        visible={folderManagerVisible}
        folders={persistedFolders}
        onClose={() => setFolderManagerVisible(false)}
        onCreate={createFolder}
        onRename={handleRenameFolder}
        onDelete={handleDeleteFolder}
      />
    </View>
  );
}
