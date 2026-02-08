import { View, Text, TextInput, TouchableOpacity, FlatList, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { db } from '../src/db/client';
import { exercises } from '../src/db/schema';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Toast } from './Toast';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (ex: { id: number; name: string }) => void;
};

export function ExercisePicker({ visible, onClose, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const { data: allExercises } = useLiveQuery(db.select().from(exercises));
  const [filtered, setFiltered] = useState<typeof allExercises>([]);
  const [newType, setNewType] = useState<'strength' | 'duration'>('strength');
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
      setToast({ visible: true, message: 'Falha ao criar exercício', type: 'error' });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background p-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-text text-xl font-bold">Selecionar Exercício</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-secondary font-bold">Fechar</Text>
          </TouchableOpacity>
        </View>

        <TextInput 
          className="bg-card text-text p-3 rounded-lg border border-border mb-4"
          placeholder="Buscar ou Criar..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoFocus
        />

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            search ? (
              <View className="mt-4 bg-card p-4 rounded-xl border border-border">
                  <Text className="text-subtext text-center mb-2">Exercício não encontrado.</Text>
                  <Text className="text-text font-bold text-lg text-center mb-4">Criar "{search}"</Text>
                  
                  <View className="flex-row gap-4 mb-4 justify-center">
                      <TouchableOpacity 
                        onPress={() => setNewType('strength')}
                        className={`px-4 py-2 rounded-lg border ${newType === 'strength' ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                      >
                          <Text className={newType === 'strength' ? 'text-white font-bold' : 'text-text font-bold'}>Força (Reps)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => setNewType('duration')}
                        className={`px-4 py-2 rounded-lg border ${newType === 'duration' ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                      >
                          <Text className={newType === 'duration' ? 'text-white font-bold' : 'text-text font-bold'}>Tempo (Segs)</Text>
                      </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={createNewExercise} className="bg-success p-3 rounded-lg">
                    <Text className="text-white text-center font-bold uppercase">Confirmar Criação</Text>
                  </TouchableOpacity>
              </View>
            ) : <Text className="text-subtext text-center mt-4">Digite para buscar</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              className="p-4 border-b border-border flex-row justify-between items-center"
              onPress={() => onSelect({ id: item.id, name: item.name })}
            >
              <Text className="text-text font-bold text-lg">{item.name}</Text>
              {item.type === 'duration' && (
                  <Text className="text-xs bg-background text-subtext px-2 py-1 rounded">Tempo</Text>
              )}
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
    </Modal>
  );
}
