import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../../src/db/client';
import { routines, routineExercises, exercises } from '../../../src/db/schema';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Toast } from '../../../components/Toast';

type SelectedExercise = {
  id: number;
  name: string;
  target?: string;
  notes?: string;
  restSeconds?: number;
};

export default function RoutineEditorScreen() {
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

  useEffect(() => {
    if (isEditing) {
      loadRoutineData();
    }
  }, [id]);

  const loadRoutineData = async () => {
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
    } catch (e) {
      setToast({ visible: true, message: 'Falha ao carregar rotina.', type: 'error' });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setToast({ visible: true, message: 'Nome é obrigatório', type: 'error' });
      return;
    }
    if (selectedExercises.length === 0) {
      setToast({ visible: true, message: 'Adicione pelo menos um exercício', type: 'error' });
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
      console.error(e);
      setToast({ visible: true, message: 'Falha ao salvar.', type: 'error' });
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
          setToast({ visible: true, message: 'Exercício renomeado.', type: 'success' });
      } catch (e) {
          setToast({ visible: true, message: 'Falha ao renomear.', type: 'error' });
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
      >
        <Text className="text-subtext text-xs font-bold uppercase mb-1">Nome da Rotina</Text>
        <TextInput 
          className="bg-card text-text p-4 rounded-xl border border-border mb-4 text-lg"
          value={name}
          onChangeText={setName}
          placeholder="Ex: Treino C (Pernas)"
          placeholderTextColor="#9CA3AF"
        />

        <Text className="text-subtext text-xs font-bold uppercase mb-1">Descrição</Text>
        <TextInput 
          className="bg-card text-text p-4 rounded-xl border border-border mb-6"
          value={description}
          onChangeText={setDescription}
          placeholder="Foco em quadríceps..."
          placeholderTextColor="#9CA3AF"
        />

        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-subtext text-xs font-bold uppercase">Exercícios ({selectedExercises.length})</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Text className="text-primary font-bold">+ ADICIONAR</Text>
          </TouchableOpacity>
        </View>

        {selectedExercises.map((ex, index) => (
          <View key={`${ex.id}-${index}`} className="bg-card p-3 mb-3 rounded-lg border border-border shadow-sm">
            <View className="flex-row justify-between items-center mb-2">
                <TouchableOpacity 
                    onPress={() => {
                        setRenamingEx({ id: ex.id, name: ex.name });
                        setNewName(ex.name);
                    }}
                >
                    <Text className="text-text font-bold text-lg underline decoration-dashed decoration-subtext"><Text className="text-subtext mr-2 no-underline">#{index+1}</Text> {ex.name} ✎</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => removeExercise(index)} className="bg-background px-2 py-1 rounded">
                    <Text className="text-danger text-xs font-bold">X</Text>
                </TouchableOpacity>
            </View>

            <View className="flex-row gap-2">
                <TextInput 
                    className="flex-1 bg-background text-text p-2 rounded text-xs"
                    placeholder="Meta (ex: 4x10)"
                    placeholderTextColor="#9CA3AF"
                    value={ex.target}
                    onChangeText={(t) => updateExerciseField(index, 'target', t)}
                />
                <TextInput 
                    className="flex-[2] bg-background text-text p-2 rounded text-xs"
                    placeholder="Notas (ex: Banco 45°)"
                    placeholderTextColor="#9CA3AF"
                    value={ex.notes}
                    onChangeText={(t) => updateExerciseField(index, 'notes', t)}
                />
            </View>
            <View className="mt-2 flex-row items-center gap-2">
                <Text className="text-subtext text-xs font-bold uppercase">Descanso (s):</Text>
                <TextInput 
                    className="bg-background text-text p-2 rounded text-xs w-20 text-center"
                    placeholder="90"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                    value={ex.restSeconds?.toString()}
                    onChangeText={(t) => updateExerciseField(index, 'restSeconds', t)}
                />
            </View>
          </View>
        ))}

        <View className="h-20" />
      </ScrollView>

      <View className="p-4 border-t border-border bg-background absolute bottom-0 w-full">
        <TouchableOpacity 
          className="bg-success p-4 rounded-xl items-center"
          onPress={handleSave}
        >
          <Text className="text-white font-bold uppercase tracking-widest">SALVAR</Text>
        </TouchableOpacity>
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
          <View className="flex-1 bg-black/80 justify-center items-center p-4">
              <View className="bg-card p-6 rounded-xl w-full border border-primary">
                  <Text className="text-text font-bold text-lg mb-4 uppercase">Renomear</Text>
                  <Text className="text-subtext text-xs mb-4">Isso mudará o nome em TODAS as rotinas.</Text>
                  
                  <TextInput 
                      className="bg-background text-text p-4 rounded-lg border border-border mb-4 font-bold"
                      value={newName}
                      onChangeText={setNewName}
                      autoFocus
                  />

                  <View className="flex-row justify-end gap-4">
                      <TouchableOpacity onPress={() => setRenamingEx(null)}>
                          <Text className="text-subtext font-bold uppercase">CANCELAR</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleRename}>
                          <Text className="text-primary font-bold uppercase">SALVAR</Text>
                      </TouchableOpacity>
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
    } catch (e) {
      setToast({ visible: true, message: 'Falha ao criar exercício.', type: 'error' });
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
      } catch (e) {
          setToast({ visible: true, message: 'Falha ao atualizar.', type: 'error' });
      }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        <ScrollView
          className="p-4"
          keyboardShouldPersistTaps="handled"
        >
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-text text-xl font-bold uppercase">Selecionar</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-secondary font-bold uppercase">FECHAR</Text>
          </TouchableOpacity>
        </View>

        {editingEx ? (
            <View className="bg-card p-4 mb-4 rounded-lg border border-primary">
                <Text className="text-subtext text-xs mb-1">Editando: {editingEx.name}</Text>
                <View className="flex-row gap-2">
                    <TextInput 
                        className="flex-1 bg-background text-text p-2 rounded border border-border"
                        value={editName}
                        onChangeText={setEditName}
                        autoFocus
                    />
                    <TouchableOpacity onPress={handleUpdateName} className="bg-success px-4 justify-center rounded">
                        <Text className="text-white font-bold text-xs uppercase">OK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingEx(null)} className="bg-danger px-4 justify-center rounded">
                        <Text className="text-white font-bold text-xs uppercase">X</Text>
                    </TouchableOpacity>
                </View>
            </View>
        ) : (
            <TextInput 
            className="bg-card text-text p-3 rounded-lg border border-border mb-4"
            placeholder="Buscar ou Criar..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoFocus
            />
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            search ? (
              <View className="mt-4 bg-card p-4 rounded-xl border border-border">
                  <Text className="text-subtext text-center mb-2">Não encontrado.</Text>
                  <Text className="text-text font-bold text-lg text-center mb-4">CRIAR "{search}"</Text>
                  
                  <View className="flex-row gap-4 mb-4 justify-center">
                      <TouchableOpacity 
                        onPress={() => setNewType('strength')}
                        className={`px-4 py-2 rounded-lg border ${newType === 'strength' ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                      >
                          <Text className={newType === 'strength' ? 'text-white font-bold text-xs' : 'text-text font-bold text-xs'}>FORÇA</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => setNewType('duration')}
                        className={`px-4 py-2 rounded-lg border ${newType === 'duration' ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                      >
                          <Text className={newType === 'duration' ? 'text-white font-bold text-xs' : 'text-text font-bold text-xs'}>TEMPO</Text>
                      </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={createNewExercise} className="bg-success p-3 rounded-lg">
                    <Text className="text-white text-center font-bold uppercase text-xs">CONFIRMAR</Text>
                  </TouchableOpacity>
              </View>
            ) : <Text className="text-subtext text-center mt-4 uppercase text-xs font-bold">Digite para buscar</Text>
          }
          renderItem={({ item }) => (
            <View className="p-4 border-b border-border flex-row justify-between items-center">
                <TouchableOpacity 
                className="flex-1"
                onPress={() => onSelect({ id: item.id, name: item.name })}
                >
                    <Text className="text-text font-bold text-lg">{item.name}</Text>
                    {item.type === 'duration' && (
                        <Text className="text-xs bg-background text-subtext px-2 py-1 rounded self-start mt-1">Tempo</Text>
                    )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                    onPress={() => {
                        setEditingEx({ id: item.id, name: item.name });
                        setEditName(item.name);
                    }}
                    className="p-2"
                >
                    <Text className="text-primary text-xs font-bold uppercase">Editar</Text>
                </TouchableOpacity>
            </View>
          )}
        />
        </ScrollView>

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
