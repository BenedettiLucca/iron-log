import type { AccessibilityProps } from 'react-native';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { Stopwatch } from '../Stopwatch';
import { ProgressBar } from '../ProgressBar';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

interface ExerciseHeaderProps {
  insetsTop: number;
  totalExercises: number;
  completedExercisesCount: number;
  t: TranslationFn;
  startTime: number;
  onOpenHistory: () => void;
  a11yHistory: AccessibilityProps;
  exerciseId: number;
  currentName: string;
  currentSetNumber: number;
  targetInfo: { sets: number; reps: string } | null;
  routineRest: number | null;
  target: string;
  notes: string;
}

export function ExerciseHeader({
  insetsTop,
  totalExercises,
  completedExercisesCount,
  t,
  startTime,
  onOpenHistory,
  a11yHistory,
  exerciseId,
  currentName,
  currentSetNumber,
  targetInfo,
  routineRest,
  target,
  notes,
}: ExerciseHeaderProps) {
  return (
    <View className="bg-card border-b border-border" style={{ paddingTop: insetsTop }}>
      <View className="p-4">
        {/* Progress Bar */}
        {totalExercises > 0 && (
          <View className="mb-4">
            <ProgressBar
              current={completedExercisesCount}
              total={totalExercises}
              variant="compact"
              showLabel={true}
            />
          </View>
        )}

        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-baseline gap-2 flex-1">
            <Text className="text-subtext text-2xs font-bold uppercase tracking-widest">{t("exerciseSession.time")}</Text>
            <Stopwatch startTime={startTime} />
          </View>
          <TouchableOpacity
            onPress={onOpenHistory}
            className="bg-background px-2 py-1 rounded-lg border border-border"
            {...a11yHistory}
          >
            <Text className="text-subtext text-2xs font-bold uppercase">{t("exerciseSession.history")}</Text>
          </TouchableOpacity>
        </View>

        <Animated.View 
          key={`header-${exerciseId}`} 
          entering={FadeInRight.duration(300)} 
          exiting={FadeOutLeft.duration(300)}
        >
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-3">
              <Text className="text-text text-xl font-bold" numberOfLines={2}>{currentName}</Text>
              <View className="flex-row items-center gap-2 mt-1.5">
                <Text className="text-primary text-xs font-semibold bg-primary/10 px-2 py-0.5 rounded-md">
                  S{currentSetNumber}{targetInfo ? `/${targetInfo.sets}` : ''}
                </Text>
                {routineRest && (
                  <Text className="text-subtext text-2xs bg-background px-2 py-0.5 rounded-md border border-border">
                    ⏱ {routineRest}s
                  </Text>
                )}
              </View>
            </View>
          </View>

          {(target || notes) && (
            <View className="mt-2 bg-background p-2 rounded-lg border border-border">
              {target && <Text className="text-primary font-semibold text-xs">🎯 {target}</Text>}
              {notes && <Text className="text-subtext text-2xs italic mt-0.5">📝 {notes}</Text>}
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
