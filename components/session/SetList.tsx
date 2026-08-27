import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, FlatList } from 'react-native';
import { SectionHeader } from '@/components/SectionHeader';
import SetCard from '../SetCard';
import type { Set } from '../../src/types';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';
import {
  buildSetAnimationSignatures,
  getAnimatedSetIds,
} from '../../src/utils/set-card-animation';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

interface SetListProps {
  sessionSets: Set[];
  hasLoadedSessionSets: boolean;
  t: TranslationFn;
  handleEditSet: (setId: number) => void;
  handleDeleteSet: (setId: number) => void;
}

export function SetList({
  sessionSets,
  hasLoadedSessionSets,
  t,
  handleEditSet,
  handleDeleteSet,
}: SetListProps) {
  const reducedMotion = useReactiveReducedMotion();

  const currentSignatures = useMemo(
    () => buildSetAnimationSignatures(sessionSets),
    [sessionSets]
  );

  const previousSignaturesRef = useRef<ReadonlyMap<number, string>>(new Map());
  const wasLoadedRef = useRef<boolean>(false);

  const animatedSetIds = useMemo(() => {
    if (!wasLoadedRef.current || !hasLoadedSessionSets) {
      return new Set<number>();
    }
    return getAnimatedSetIds(previousSignaturesRef.current, currentSignatures);
  }, [currentSignatures, hasLoadedSessionSets]);

  useEffect(() => {
    previousSignaturesRef.current = currentSignatures;
    wasLoadedRef.current = hasLoadedSessionSets;
  }, [currentSignatures, hasLoadedSessionSets]);

  const extraData = useMemo(
    () => ({ currentSignatures, reducedMotion, animatedSetIds }),
    [currentSignatures, reducedMotion, animatedSetIds]
  );

  return (
    <View className="flex-1 px-4">
      <SectionHeader
        label={t('exercise.registeredSetsCount', { count: sessionSets?.length || 0 })}
        className="mb-2 mt-2"
      />
      <FlatList
        data={sessionSets}
        keyExtractor={(item) => `${item.id}-${currentSignatures.get(item.id) ?? ''}`}
        extraData={extraData}
        renderItem={({ item }) => {
          const signature = currentSignatures.get(item.id);
          const signatureAlreadyCommitted = previousSignaturesRef.current.get(item.id) === signature;
          return (
            <SetCard
              setNumber={item.setNumber}
              weight={item.weightKg}
              reps={item.reps || undefined}
              duration={item.durationSeconds || undefined}
              rir={item.rir}
              isWarmup={item.isWarmup || false}
              isEdited={item.isEdited || false}
              animateEntry={animatedSetIds.has(item.id) && !signatureAlreadyCommitted && !reducedMotion}
              onEdit={() => handleEditSet(item.id)}
              onDelete={() => handleDeleteSet(item.id)}
            />
          );
        }}
        ListEmptyComponent={
          <View className="py-8">
            <Text className="text-subtext text-center">{t('exerciseSession.noSetsYet')}</Text>
          </View>
        }
      />
    </View>
  );
}
