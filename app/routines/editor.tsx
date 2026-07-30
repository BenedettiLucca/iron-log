import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import type { NavigationAction } from '@react-navigation/native';
import { db } from '../../src/db/client';
import { routines, routineExercises, exercises } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Toast } from '../../components/Toast';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Dialog } from '../../components/Dialog';
import { ErrorState, LoadingState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { routineNameSchema } from '@/src/validators/forms';
import { useI18n } from '../../src/i18n/index';
import { useToast } from '../../hooks/use-toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionHeader } from '@/components/SectionHeader';
import { isFormDirty } from '@/src/utils/form-dirty';
import {
  buildRoutineExerciseRows,
  buildSaveAsTemplateValues,
} from '@/src/utils/routine-template-integrity';
import {
  hasRoutineNameConflict,
  isRoutineNameUniqueConstraintError,
  normalizeRoutineName,
} from '@/src/utils/routine-name';
import { setPendingToast } from '@/src/utils/flash-toast';

type SelectedExercise = {
  id: number;
  name: string;
  target?: string;
  notes?: string;
  restSeconds?: number;
};

export default function RoutineEditorScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [renamingEx, setRenamingEx] = useState<{id: number, name: string} | null>(null);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const { toast, setToast } = useToast();
  const insets = useSafeAreaInsets();

  const [nameError, setNameError] = useState('');
  const [exerciseError, setExerciseError] = useState('');
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isHydrating, setIsHydrating] = useState(isEditing);
  const [hydrationFailed, setHydrationFailed] = useState(false);

  const nameInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const initialSnapshotRef = useRef<readonly unknown[]>(['', '', '[]']);
  const bypassRef = useRef(false);
  const pendingActionRef = useRef<NavigationAction | null>(null);
  const hydrationGenerationRef = useRef(0);

  const loadRoutineData = useCallback(async (generation: number) => {
    try {
      const routineData = await db.select().from(routines).where(eq(routines.id, Number(id)));
      const loadedRoutine = routineData[0];
      if (!loadedRoutine) throw new Error('Routine not found');

      const joins = await db.select({
        id: exercises.id,
        name: exercises.name,
        order: routineExercises.orderIndex,
        target: routineExercises.target,
        notes: routineExercises.notes,
        restSeconds: routineExercises.restSeconds
      })
      .from(routineExercises)
      .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
      .where(eq(routineExercises.routineId, Number(id)))
      .orderBy(routineExercises.orderIndex);

      const loadedExercises = joins.map(j => ({
          id: j.id,
          name: j.name,
          target: j.target || '',
          notes: j.notes || '',
          restSeconds: j.restSeconds || undefined
      }));

      if (generation !== hydrationGenerationRef.current) return;
      const loadedName = loadedRoutine.name;
      const loadedDescription = loadedRoutine.description || '';
      setName(loadedName);
      setDescription(loadedDescription);
      setSelectedExercises(loadedExercises);
      initialSnapshotRef.current = [loadedName, loadedDescription, JSON.stringify(loadedExercises)];
      setHydrationFailed(false);
    } catch (error) {
      if (generation !== hydrationGenerationRef.current) return;
      logger.error('Failed to load routine editor', error);
      setHydrationFailed(true);
      setToast({ visible: true, message: t('routines.loadError'), type: 'error' });
    } finally {
      if (generation === hydrationGenerationRef.current) {
        setIsHydrating(false);
      }
    }
  }, [id, t, setToast]);

  const startHydration = useCallback(() => {
    const generation = ++hydrationGenerationRef.current;
    setIsHydrating(true);
    setHydrationFailed(false);
    void loadRoutineData(generation);
  }, [loadRoutineData]);

  useEffect(() => {
    if (!isEditing) {
      setIsHydrating(false);
      setHydrationFailed(false);
      return;
    }

    startHydration();
    return () => {
      hydrationGenerationRef.current += 1;
    };
  }, [id, isEditing, startHydration]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (bypassRef.current) return;
      if (!['GO_BACK', 'POP'].includes(e.data.action.type)) return;
      const currentSnapshot = [name, description, JSON.stringify(selectedExercises)];
      if (!isFormDirty(currentSnapshot, initialSnapshotRef.current)) return;
      e.preventDefault();
      if (!pendingActionRef.current) {
        pendingActionRef.current = e.data.action;
        setShowDiscardDialog(true);
      }
    });
    return unsubscribe;
  }, [navigation, name, description, selectedExercises]);

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

  const validateForm = (): boolean => {
    setNameError('');
    setExerciseError('');
    const nameValidation = routineNameSchema.safeParse({ name: name.trim(), description });
    if (!nameValidation.success) {
      const msg = t('common.invalidName');
      setNameError(msg);
      nameInputRef.current?.focus();
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      setToast({ visible: true, message: msg, type: 'error' });
      return false;
    }
    if (selectedExercises.length === 0) {
      const msg = t('common.addAtLeastOneExercise');
      setExerciseError(msg);
      scrollViewRef.current?.scrollToEnd({ animated: true });
      setToast({ visible: true, message: msg, type: 'error' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (isSavingRef.current) return;
    if (!validateForm()) return;

    isSavingRef.current = true;
    setIsSaving(true);
    const normalizedName = normalizeRoutineName(name);
    const editingRoutineId = Number(id);

    try {
      const sameName = await db
        .select({ id: routines.id })
        .from(routines)
        .where(eq(routines.name, normalizedName));

      if (hasRoutineNameConflict(sameName, isEditing ? editingRoutineId : undefined)) {
        setToast({
          visible: true,
          message: t('routines.duplicateName', { name: normalizedName }),
          type: 'error',
        });
        return;
      }

      let routineId = editingRoutineId;
      db.transaction((tx) => {
        if (isEditing) {
          tx.update(routines)
            .set({ name: normalizedName, description })
            .where(eq(routines.id, routineId))
            .run();
          tx.delete(routineExercises).where(eq(routineExercises.routineId, routineId)).run();
        } else {
          const created = tx
            .insert(routines)
            .values({ name: normalizedName, description })
            .returning({ id: routines.id })
            .get();
          if (!created) throw new Error('Failed to create routine');
          routineId = created.id;
        }

        tx.insert(routineExercises)
          .values(buildRoutineExerciseRows(routineId, selectedExercises))
          .run();
      });

      bypassRef.current = true;
      router.back();
    } catch (e) {
      if (isRoutineNameUniqueConstraintError(e)) {
        setToast({
          visible: true,
          message: t('routines.duplicateName', { name: normalizedName }),
          type: 'error',
        });
      } else {
        logger.error('Erro inesperado', e);
        setToast({ visible: true, message: t('routines.saveError'), type: 'error' });
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleRename = async () => {
      if (!renamingEx || !newName.trim()) return;
      try {
          await db.update(exercises)
            .set({ name: newName })
            .where(eq(exercises.id, renamingEx.id));

          setSelectedExercises(prev => prev.map(ex =>
              ex.id === renamingEx.id ? { ...ex, name: newName } : ex
          ));

          setRenamingEx(null);
          setNewName('');
          setToast({ visible: true, message: t('common.exerciseRenamed'), type: 'success' });
      } catch {
          setToast({ visible: true, message: t('routines.renameError'), type: 'error' });
      }
  };

  const handleSaveAsTemplate = async () => {
    if (isSavingRef.current) return;

    const routineId = Number(id);
    if (!id || isNaN(routineId)) {
      setToast({ visible: true, message: t('routines.saveFirstForTemplate'), type: 'error' });
      return;
    }

    if (!validateForm()) return;

    isSavingRef.current = true;
    setIsSaving(true);
    const normalizedName = normalizeRoutineName(name);

    try {
      const sameName = await db
        .select({ id: routines.id })
        .from(routines)
        .where(eq(routines.name, normalizedName));

      if (hasRoutineNameConflict(sameName, routineId)) {
        setToast({
          visible: true,
          message: t('routines.duplicateName', { name: normalizedName }),
          type: 'error',
        });
        return;
      }

      db.transaction((tx) => {
        tx.update(routines)
          .set(buildSaveAsTemplateValues(normalizedName, description))
          .where(eq(routines.id, routineId))
          .run();
        tx.delete(routineExercises).where(eq(routineExercises.routineId, routineId)).run();
        tx.insert(routineExercises)
          .values(buildRoutineExerciseRows(routineId, selectedExercises))
          .run();
      });

      setPendingToast({ message: t('routines.savedAsTemplate'), type: 'success' });
      bypassRef.current = true;
      router.back();
    } catch (e) {
      if (isRoutineNameUniqueConstraintError(e)) {
        setToast({
          visible: true,
          message: t('routines.duplicateName', { name: normalizedName }),
          type: 'error',
        });
      } else {
        logger.error('Erro inesperado', e);
        setToast({ visible: true, message: t('routines.saveTemplateError'), type: 'error' });
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const removeExercise = (indexToRemove: number) => {
    setSelectedExercises(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const updateExerciseField = (index: number, field: keyof SelectedExercise, value: string) => {
      setSelectedExercises(prev => prev.map((item, i) => {
          if (i === index) {
              return { ...item, [field]: field === 'restSeconds' ? Number(value) : value };
          }
          return item;
      }));
  };

  if (isHydrating) {
    return <LoadingState />;
  }

  if (hydrationFailed) {
    return <ErrorState message={t('routines.loadError')} onRetry={startHydration} />;
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-4 pb-4"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ gap: 16 }}
      >
        <Input
            ref={nameInputRef}
            label={t("routines.routineName")}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError('');
            }}
            error={nameError}
            placeholder={t("routines.namePlaceholder")}
        />

        <Input 
            label={t("routines.description")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("routines.descriptionPlaceholder")}
        />

        <View className="flex-row justify-between items-center mt-2">
          <SectionHeader label={t("routines.exercisesCount", { count: selectedExercises.length })} />
          <Button 
            title={t("routines.addExercise")}
            onPress={() => setModalVisible(true)}
            variant="ghost"
            size="sm"
          />
        </View>
        {exerciseError ? (
          <Text className="text-dangerText text-xs -mt-2 mb-1" accessibilityLiveRegion="polite">
            {exerciseError}
          </Text>
        ) : null}

        {selectedExercises.map((ex, index) => (
          <Card key={`${ex.id}-${index}`}>
            <View className="flex-row justify-between items-center mb-3">
                <TouchableOpacity 
                    onPress={() => {
                        setRenamingEx({ id: ex.id, name: ex.name });
                        setNewName(ex.name);
                    }}
                >
                    <Text className="text-base font-bold text-text underline decoration-dashed decoration-subtext"><Text className="text-subtext mr-2 no-underline font-normal text-sm">#{index+1}</Text> {ex.name}</Text>
                </TouchableOpacity>
                
                <Button 
                    title="X"
                    accessibilityLabel={t('common.delete')}
                    onPress={() => removeExercise(index)}
                    variant="danger"
                    size="sm"
                    style={{ minWidth: 44 }}
                />
            </View>

            <View className="flex-row gap-3">
                <View className="flex-1">
                    <Input 
                        placeholder={t("routines.targetPlaceholder")}
                        value={ex.target}
                        onChangeText={(t) => updateExerciseField(index, 'target', t)}
                        style={{ fontSize: 12, paddingVertical: 8, minHeight: 36 }}
                    />
                </View>
                <View className="flex-[2]">
                    <Input 
                        placeholder={t("routines.notesPlaceholder")}
                        value={ex.notes}
                        onChangeText={(t) => updateExerciseField(index, 'notes', t)}
                        style={{ fontSize: 12, paddingVertical: 8, minHeight: 36 }}
                    />
                </View>
            </View>
            <View className="mt-3 flex-row items-center gap-3">
                <Text className="text-xs text-subtext font-bold uppercase">{t("routines.restSeconds")}</Text>
                <Input 
                    placeholder="90"
                    keyboardType="numeric"
                    value={ex.restSeconds?.toString()}
                    onChangeText={(t) => updateExerciseField(index, 'restSeconds', t)}
                    style={{ fontSize: 12, paddingVertical: 8, minHeight: 36, width: 60, textAlign: 'center' }}
                    containerStyle={{ flex: 0 }}
                />
            </View>
          </Card>
        ))}
      </ScrollView>

      <View
        className="p-4 border-t border-border bg-background shadow-lg gap-2"
        style={{ paddingBottom: 16 + insets.bottom }}
      >
        <Button 
          title={t("common.save")}
          onPress={handleSave}
          variant="primary"
          size="lg"
          fullWidth
          loading={isSaving}
          disabled={isSaving}
        />
        <Button 
          title={t("routines.saveAsTemplate")}
          onPress={handleSaveAsTemplate}
          variant="secondary"
          size="lg"
          fullWidth
          loading={isSaving}
          disabled={isSaving}
        />
      </View>

      <ExercisePickerModal 
        visible={isModalVisible} 
        onClose={() => setModalVisible(false)}
        onSelect={(ex) => {
          setSelectedExercises(prev => [...prev, ex]);
          setExerciseError('');
          setModalVisible(false);
        }}
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

      <Modal visible={!!renamingEx} transparent animationType="fade">
          <View className="flex-1 bg-black/60 justify-center items-center p-4">
              <View className="bg-card p-6 rounded-2xl w-full border border-border shadow-xl">
                  <Text className="text-text font-bold text-lg mb-2 uppercase tracking-wide">{t("common.rename")}</Text>
                  <Text className="text-subtext text-xs mb-6">{t("routines.renameWarning")}</Text>
                  
                  <Input 
                      value={newName}
                      onChangeText={setNewName}
                      autoFocus
                      containerStyle={{ marginBottom: 24 }}
                  />

                  <View className="flex-row justify-end gap-3">
                      <Button 
                        title={t("common.cancel")}
                        onPress={() => setRenamingEx(null)}
                        variant="ghost"
                      />
                      <Button 
                        title={t("common.save")}
                        onPress={handleRename}
                        variant="primary"
                      />
                  </View>
              </View>
          </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}

function ExercisePickerModal({ visible, onClose, onSelect }: { visible: boolean, onClose: () => void, onSelect: (ex: SelectedExercise) => void }) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const { data: allExercises } = useLiveQuery(db.select().from(exercises));
  const [filtered, setFiltered] = useState<typeof allExercises>([]);
  const [newType, setNewType] = useState<'strength' | 'duration'>('strength');
  const [editingEx, setEditingEx] = useState<{id: number, name: string} | null>(null);
  const [editName, setEditName] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  useEffect(() => {
    if (allExercises) {
      setFiltered(
        allExercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
      );
    }
  }, [search, allExercises]);

  const createNewExercise = async () => {
    if (!search.trim()) return;
    try {
      const res = await db.insert(exercises).values({
          name: search,
          type: newType
      }).returning();
      onSelect({ id: res[0].id, name: res[0].name });
    } catch {
      setToast({ visible: true, message: t('common.createExerciseFail'), type: 'error' });
    }
  };

  const handleUpdateName = async () => {
      if (!editingEx || !editName.trim()) return;
      try {
          await db.update(exercises)
            .set({ name: editName })
            .where(eq(exercises.id, editingEx.id));
          setEditingEx(null);
          setEditName('');
      } catch {
          setToast({ visible: true, message: t('routines.updateError'), type: 'error' });
      }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        <View className="p-4 border-b border-border flex-row justify-between items-center bg-card">
          <SectionHeader label={t("routines.selectExercise")} />
          <Button 
            title={t("common.close")}
            onPress={onClose}
            variant="ghost"
            size="sm"
          />
        </View>

        <View className="p-4">
            {editingEx ? (
                <Card className="mb-4 border-primary">
                    <Text className="text-subtext text-xs mb-2">{t('routines.editing', { name: editingEx.name })}</Text>
                    <View className="flex-row gap-2">
                        <View className="flex-1">
                            <Input 
                                value={editName}
                                onChangeText={setEditName}
                                autoFocus
                            />
                        </View>
                        <Button title="OK" onPress={handleUpdateName} size="sm" variant="success" />
                        <Button title="X" onPress={() => setEditingEx(null)} size="sm" variant="danger" />
                    </View>
                </Card>
            ) : (
                <Input 
                    placeholder={t("routines.searchOrCreate")}
                    value={search}
                    onChangeText={setSearch}
                    autoFocus
                    containerStyle={{ marginBottom: 16 }}
                />
            )}

            <FlatList
            data={filtered}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
                search ? (
                <Card className="mt-4 items-center p-6">
                    <Text className="text-subtext text-center mb-2">{t("routines.notFound")}</Text>
                    <Text className="text-text font-bold text-lg text-center mb-6">{t("routines.createExercise", { name: search })}</Text>
                    
                    <View className="flex-row gap-4 mb-6 justify-center">
                        <Button 
                            title={t("routines.strength")}
                            onPress={() => setNewType('strength')}
                            variant={newType === 'strength' ? 'primary' : 'ghost'}
                            size="sm"
                        />
                        <Button 
                            title={t("exerciseSession.time")}
                            onPress={() => setNewType('duration')}
                            variant={newType === 'duration' ? 'primary' : 'ghost'}
                            size="sm"
                        />
                    </View>

                    <Button 
                        title={t("routines.confirmCreate")}
                        onPress={createNewExercise}
                        variant="success"
                        fullWidth
                    />
                </Card>
                ) : <Text className="text-subtext text-center mt-10 uppercase text-xs font-bold tracking-widest">{t("routines.typeToSearch")}</Text>
            }
            renderItem={({ item }) => (
                <TouchableOpacity 
                    className="p-4 border-b border-border flex-row justify-between items-center active:bg-black/5"
                    onPress={() => onSelect({ id: item.id, name: item.name })}
                    accessibilityRole="button"
                    accessibilityLabel={t('routines.selectExerciseLabel', { name: item.name })}
                    accessibilityHint={t('routines.selectExerciseHint')}
                >
                    <View className="flex-1">
                        <Text className="text-text font-bold text-lg">{item.name}</Text>
                        {item.type === 'duration' && (
                            <Text className="text-xs bg-background text-subtext px-2 py-0.5 rounded border border-border self-start mt-1 uppercase">{t("routines.tempo")}</Text>
                        )}
                    </View>
                    
                    <TouchableOpacity 
                        onPress={(e) => {
                            e.stopPropagation();
                            setEditingEx({ id: item.id, name: item.name });
                            setEditName(item.name);
                        }}
                        className="p-2"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('routines.editExerciseLabel', { name: item.name })}
                        accessibilityHint={t('routines.editExerciseHint')}
                    >
                        <Text className="text-primaryText text-xs font-bold uppercase">{t("routines.editExercise")}</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            )}
            />
        </View>

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast({ ...toast, visible: false })}
        />
      </View>
    </Modal>
  );
}
