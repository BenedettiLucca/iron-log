import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { Input } from '@/components/Input';
import { useI18n } from '@/src/i18n/index';
import { DEFAULT_FOLDER_NAME, isSameFolderName } from '@/src/utils/folders';
import { FolderError } from '@/services/FolderService';
import type { Folder } from '@/src/types';

interface FolderManagerModalProps {
  visible: boolean;
  folders: Folder[];
  onClose: () => void;
  onCreate: (name: string) => Promise<Folder>;
  onRename: (id: number, name: string) => Promise<Folder>;
  onDelete: (id: number) => Promise<void>;
}

function getFolderErrorMessage(error: unknown, t: (key: string) => string) {
  if (!(error instanceof FolderError)) return t('routines.folderOperationError');

  switch (error.code) {
    case 'empty':
      return t('routines.folderNameRequired');
    case 'tooLong':
      return t('routines.folderNameTooLong');
    case 'duplicate':
      return t('routines.folderAlreadyExists');
    case 'protected':
      return t('routines.folderCannotChangeDefault');
    case 'notFound':
      return t('routines.folderNotFound');
    default:
      return t('routines.folderOperationError');
  }
}

export function FolderManagerModal({
  visible,
  folders,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: FolderManagerModalProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingName, setEditingName] = useState('');
  const [formError, setFormError] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isSubmitting = isCreating || isRenaming || isDeleting;

  const resetForm = () => {
    setNewFolderName('');
    setEditingFolder(null);
    setEditingName('');
    setFormError('');
  };

  const handleClose = () => {
    resetForm();
    setFolderToDelete(null);
    onClose();
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setFormError('');
    try {
      await onCreate(newFolderName);
      setNewFolderName('');
    } catch (error) {
      setFormError(getFolderErrorMessage(error, t));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async () => {
    if (!editingFolder) return;
    setIsRenaming(true);
    setFormError('');
    try {
      await onRename(editingFolder.id, editingName);
      setEditingFolder(null);
      setEditingName('');
    } catch (error) {
      setFormError(getFolderErrorMessage(error, t));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    const folder = folderToDelete;
    setFolderToDelete(null);
    if (!folder) return;

    setIsDeleting(true);
    setFormError('');
    try {
      await onDelete(folder.id);
    } catch (error) {
      setFormError(getFolderErrorMessage(error, t));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        accessibilityViewIsModal
        onRequestClose={handleClose}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={handleClose}
            accessible={false}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ maxHeight: '92%' }}
          >
            <View
              className="bg-background rounded-t-3xl border-t border-border"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              <View className="px-4 py-4 border-b border-border flex-row items-center justify-between">
                <Text
                  className="text-text text-xl font-bold"
                  accessibilityRole="header"
                >
                  {t('routines.folderManager')}
                </Text>
                <Button
                  title={t('common.close')}
                  onPress={handleClose}
                  variant="secondary"
                  size="sm"
                />
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ padding: 16, gap: 16 }}
              >
                <Card>
                  <Text className="text-text text-base font-bold mb-1">
                    {t('routines.newFolder')}
                  </Text>
                  <Text className="text-subtext text-sm mb-4">
                    {t('routines.folderManagerDescription')}
                  </Text>
                  <Input
                    label={t('routines.folderName')}
                    placeholder={t('routines.folderNamePlaceholder')}
                    value={newFolderName}
                    onChangeText={(value) => {
                      setNewFolderName(value);
                      if (formError) setFormError('');
                    }}
                    maxLength={50}
                    showCharacterCount
                    error={editingFolder ? undefined : formError}
                    editable={!isSubmitting}
                  />
                  <Button
                    title={t('routines.createFolder')}
                    onPress={() => void handleCreate()}
                    variant="primary"
                    fullWidth
                    loading={isCreating}
                    disabled={isSubmitting || !!editingFolder}
                    style={{ marginTop: 12 }}
                  />
                </Card>

                <View>
                  <Text className="text-subtext text-xs font-bold uppercase tracking-wider mb-2">
                    {t('routines.folder')}
                  </Text>
                  <View className="gap-2">
                    {folders.map((folder) => {
                      const isDefault = isSameFolderName(folder.name, DEFAULT_FOLDER_NAME);
                      const isEditing = editingFolder?.id === folder.id;

                      return (
                        <View
                          key={folder.id}
                          className="bg-card border border-border rounded-2xl p-4"
                        >
                          {isEditing ? (
                            <>
                              <Input
                                label={t('routines.folderName')}
                                value={editingName}
                                onChangeText={(value) => {
                                  setEditingName(value);
                                  if (formError) setFormError('');
                                }}
                                maxLength={50}
                                showCharacterCount
                                error={formError}
                                editable={!isSubmitting}
                                autoFocus
                              />
                              <View className="flex-row gap-2 mt-3">
                                <Button
                                  title={t('common.cancel')}
                                  onPress={() => {
                                    setEditingFolder(null);
                                    setEditingName('');
                                    setFormError('');
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  style={{ flex: 1 }}
                                  disabled={isSubmitting}
                                />
                                <Button
                                  title={t('common.save')}
                                  onPress={() => void handleRename()}
                                  variant="primary"
                                  size="sm"
                                  style={{ flex: 1 }}
                                  loading={isRenaming}
                                  disabled={isSubmitting}
                                />
                              </View>
                            </>
                          ) : (
                            <>
                              <View className="flex-row items-center justify-between">
                                <Text className="text-text text-base font-bold flex-1 mr-3">
                                  {isDefault
                                    ? t('routines.tabGeneral')
                                    : folder.name}
                                </Text>
                                {isDefault && (
                                  <Text className="text-subtext text-xs font-bold uppercase">
                                    {t('routines.folderDefault')}
                                  </Text>
                                )}
                              </View>
                              {!isDefault && (
                                <View className="flex-row gap-2 mt-3 border-t border-border pt-3">
                                  <Button
                                    title={t('routines.renameFolder')}
                                    onPress={() => {
                                      setEditingFolder(folder);
                                      setEditingName(folder.name);
                                      setFormError('');
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    style={{ flex: 1 }}
                                    disabled={isSubmitting}
                                  />
                                  <Button
                                    title={t('routines.deleteFolder')}
                                    onPress={() => setFolderToDelete(folder)}
                                    variant="danger"
                                    size="sm"
                                    style={{ flex: 1 }}
                                    disabled={isSubmitting}
                                  />
                                </View>
                              )}
                            </>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Dialog
        visible={!!folderToDelete}
        title={t('routines.deleteFolderTitle')}
        message={t('routines.deleteFolderMessage', { name: folderToDelete?.name ?? '' })}
        type="destructive"
        onConfirm={() => void handleDelete()}
        onCancel={() => setFolderToDelete(null)}
      />
    </>
  );
}
