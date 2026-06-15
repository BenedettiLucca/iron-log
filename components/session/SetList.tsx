import { View, Text, FlatList } from 'react-native';
import SetCard from '../SetCard';
import { Set } from '../../src/types';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

interface SetListProps {
  sessionSets: Set[];
  t: TranslationFn;
  handleEditSet: (setId: number) => void;
  handleDeleteSet: (setId: number) => void;
}

export function SetList({
  sessionSets,
  t,
  handleEditSet,
  handleDeleteSet,
}: SetListProps) {
  return (
    <View className="flex-1 px-4">
      <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-2 mt-2">
        {t('exercise.registeredSetsCount', { count: sessionSets?.length || 0 })}
      </Text>
      <FlatList
        data={sessionSets}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item, index }) => (
          <SetCard
            key={item.id}
            index={index}
            setNumber={item.setNumber}
            weight={item.weightKg}
            reps={item.reps || undefined}
            duration={item.durationSeconds || undefined}
            rir={item.rir}
            isWarmup={item.isWarmup || false}
            isEdited={item.isEdited || false}
            onEdit={() => handleEditSet(item.id)}
            onDelete={() => handleDeleteSet(item.id)}
          />
        )}
        ListEmptyComponent={
          <View className="py-8">
            <Text className="text-subtext text-center">{t('exerciseSession.noSetsYet')}</Text>
          </View>
        }
      />
    </View>
  );
}
