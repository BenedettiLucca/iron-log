import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../../src/db/client';
import { routines, routineExercises, exercises } from '../../../src/db/schema';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Toast } from '../../../components/Toast';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { logger } from '@/services/logger';
import { routineNameSchema } from '@/src/validators/forms';
import { useI18n } from '../../../src/i18n/index';

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
  const { id } = useLocalSearchParams();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [renamingEx, setRenamingEx] = useState<{id: number, name: string} | null>(null);
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [showTemplateOptions, setShowTemplateOptions] = useState(false);

  const loadRoutineData = useCallback(async () => {
    try {
      const routineData = await db.select().from(routines).where(eq(routines.id, Number(id)));
      if (routineData.length > 0) {
        setName(routineData[0].name);
        setDescription(routineData[0].description || '');
      }

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

      setSelectedExercises(joins.map(j => ({
          id: j.id,
          name: j.name,
          target: j.target || '',
          notes: j.notes || '',
          restSeconds: j.restSeconds || undefined
      })));
    } catch {
      setToast({ visible: true, message: t('routines.loadError'), type: 'error' });
    }
  }, [id, t]);

  useEffect(() => {
    if (isEditing) {
      loadRoutineData();
    }
  }, [id, isEditing, loadRoutineData]);

  const handleSave = async () => {
    const nameValidation = routineNameSchema.safeParse({ name, description });
    if (!nameValidation.success) {
      setToast({ visible: true, message: nameValidation.error.issues[0]?.message || t('common.invalidName'), type: 'error' });
      return;
    }
    if (selectedExercises.length === 0) {
      setToast({ visible: true, message: t('common.addAtLeastOneExercise'), type: 'error' });
      return;
    }

    try {
      let routineId = Number(id);

      if (isEditing) {
        await db.update(routines)
          .set({ name, description })
          .where(eq(routines.id, routineId));
        await db.delete(routineExercises).where(eq(routineExercises.routineId, routineId));
      } else {
        const res = await db.insert(routines).values({ name, description }).returning();
        routineId = res[0].id;
      }

      if (selectedExercises.length > 0) {
        const rows = selectedExercises.map((ex, index) => ({
          routineId,
          exerciseId: ex.id,
          orderIndex: index + 1,
          target: ex.target,
          notes: ex.notes,
          restSeconds: ex.restSeconds
        }));
        await db.insert(routineExercises).values(rows);
      }

      router.back();
    } catch (e) {
      logger.error('Erro inesperado', e);
      setToast({ visible: true, message: t('routines.saveError'), type: 'error' });
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
    try {
      await db.update(routines)
        .set({ isTemplate: true })
        .where(eq(routines.id, Number(id)));

      setToast({ visible: true, message: t('routines.savedAsTemplate'), type: 'success' });
      router.back();
    } catch (e) {
      logger.error('Erro inesperado', e);
      setToast({ visible: true, message: t('routines.saveTemplateError'), type: 'error' });
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

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 16 }}
      >
        <Input
            label={t("routines.routineName")}
            value={name}
            onChangeText={setName}
            placeholder={t("routines.namePlaceholder")}
        />

        <Input 
            label={t("routines.description")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("routines.descriptionPlaceholder")}
        />

        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-subtext text-xs font-bold uppercase tracking-wider">{t("routines.exercisesCount", { count: selectedExercises.length })}</Text>
          <Button 
            title={t("routines.addExercise")}
            onPress={() => setModalVisible(true)}
            variant="ghost"
            size="sm"
          />
        </View>

        {selectedExercises.map((ex, index) => (
          <Card key={`${ex.id}-${index}`}>
            <View className="flex-row justify-between items-center mb-3">
                <TouchableOpacity 
                    onPress={() => {
                        setRenamingEx({ id: ex.id, name: ex.name });
                        setNewName(ex.name);
                    }}
                >
                    <Text className="text-text font-bold text-lg underline decoration-dashed decoration-subtext"><Text className="text-subtext mr-2 no-underline font-normal text-sm">#{index+1}</Text> {ex.name} ✎</Text>
                </TouchableOpacity>
                
                <Button 
                    title="X"
                    onPress={() => removeExercise(index)}
                    variant="danger"
                    size="sm"
                    style={{ minHeight: 32, paddingVertical: 4, paddingHorizontal: 12 }}
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
                <Text className="text-subtext text-xs font-bold uppercase">{t("routines.restSeconds")}</Text>
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

        <View className="h-24" />
      </ScrollView>

      {/* Save Options Menu */}
      {showTemplateOptions && (
        <View className="absolute bottom-20 left-4 right-4 z-10">
          <Card className="border-2 border-primary shadow-xl">
            <TouchableOpacity
              onPress={handleSave}
              onPressOut={() => setShowTemplateOptions(false)}
              className="p-4"
            >
              <Text className="text-text font-bold text-base">{t("common.save")}</Text>
              <Text className="text-subtext text-xs">{t("routines.saveNormal")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveAsTemplate}
              onPressOut={() => setShowTemplateOptions(false)}
              className="p-4 border-t border-border"
            >
              <Text className="text-primary font-bold text-base">{t("routines.saveAsTemplate")}</Text>
              <Text className="text-subtext text-xs">{t("routines.templateLibraryHint")}</Text>
            </TouchableOpacity>
          </Card>
        </View>
      )}

      <View className="p-4 border-t border-border bg-background absolute bottom-0 w-full shadow-lg">
        <Button 
          title={t("common.save")}
          onPress={() => setShowTemplateOptions(true)}
          variant="success"
          fullWidth
        />
      </View>

      <ExercisePickerModal 
        visible={isModalVisible} 
        onClose={() => setModalVisible(false)}
        onSelect={(ex) => {
          setSelectedExercises(prev => [...prev, ex]);
          setModalVisible(false);
        }}
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
          <Text className="text-text text-xl font-bold uppercase tracking-wide">{t("routines.selectExercise")}</Text>
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
                >
                    <View className="flex-1">
                        <Text className="text-text font-bold text-lg">{item.name}</Text>
                        {item.type === 'duration' && (
                            <Text className="text-xs bg-background text-subtext px-2 py-0.5 rounded border border-border self-start mt-1 uppercase">{t("routines.tempo")}</Text>
                        )}
                    </View>
                    
                    <TouchableOpacity 
                        onPress={() => {
                            setEditingEx({ id: item.id, name: item.name });
                            setEditName(item.name);
                        }}
                        className="p-2"
                    >
                        <Text className="text-primary text-xs font-bold uppercase">{t("routines.editExercise")}</Text>
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
