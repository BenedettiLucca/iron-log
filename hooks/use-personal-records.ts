import { useState, useEffect } from 'react';
import { db } from '@/db/client';
import { sets, sessions, exercises } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { calculate1RM, calculateVolume } from '@/utils/calculations';

export interface PersonalRecord {
  id: number;
  exerciseId: number;
  exerciseName: string;
  recordType: 'weight' | 'reps' | 'volume' | 'duration';
  value: number;
  date: number;
  sessionId: number;
  setDetails?: any;
}

/**
 * Hook for managing personal records (PRs)
 */
export function usePersonalRecords(exerciseId?: number) {
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, [exerciseId]);

  const loadRecords = async () => {
    try {
      setLoading(true);

      const query = db
        .select({
          id: sets.id,
          exerciseId: sets.exerciseId,
          exerciseName: exercises.name,
          weightKg: sets.weightKg,
          reps: sets.reps,
          durationSeconds: sets.durationSeconds,
          sessionId: sets.sessionId,
          date: sessions.startTime,
        })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .innerJoin(exercises, eq(sets.exerciseId, exercises.id))
        .orderBy(desc(sets.createdAt));

      const allSets = exerciseId
        ? await query.where(eq(sets.exerciseId, exerciseId))
        : await query;

      // Group by exercise and find records
      const exerciseGroups = new Map<number, any[]>();
      allSets.forEach((set: any) => {
        if (!exerciseGroups.has(set.exerciseId)) {
          exerciseGroups.set(set.exerciseId, []);
        }
        exerciseGroups.get(set.exerciseId)!.push(set);
      });

      const detectedPRs: PersonalRecord[] = [];

      exerciseGroups.forEach((exerciseSets, exId) => {
        const exerciseName = exerciseSets[0].exerciseName;

        // Find weight PR
        const weightPR = exerciseSets.reduce((best, set) =>
          set.weightKg > best.weightKg ? set : best
        , exerciseSets[0]);

        if (weightPR) {
          detectedPRs.push({
            id: weightPR.id,
            exerciseId: exId,
            exerciseName,
            recordType: 'weight',
            value: weightPR.weightKg,
            date: weightPR.date,
            sessionId: weightPR.sessionId,
            setDetails: { weightKg: weightPR.weightKg, reps: weightPR.reps },
          });
        }

        // Find reps PR
        const repsPR = exerciseSets.reduce((best, set) =>
          (set.reps || 0) > (best.reps || 0) ? set : best
        , exerciseSets[0]);

        if (repsPR && (repsPR.reps || 0) > 0) {
          detectedPRs.push({
            id: repsPR.id,
            exerciseId: exId,
            exerciseName,
            recordType: 'reps',
            value: repsPR.reps || 0,
            date: repsPR.date,
            sessionId: repsPR.sessionId,
            setDetails: { weightKg: repsPR.weightKg, reps: repsPR.reps },
          });
        }

        // Find volume PR
        const volumePR = exerciseSets.reduce((best, set) => {
          const setVolume = calculateVolume(set.weightKg, set.reps || 0);
          const bestVolume = calculateVolume(best.weightKg, best.reps || 0);
          return setVolume > bestVolume ? set : best;
        }, exerciseSets[0]);

        if (volumePR) {
          const volumeValue = calculateVolume(volumePR.weightKg, volumePR.reps || 0);
          detectedPRs.push({
            id: volumePR.id,
            exerciseId: exId,
            exerciseName,
            recordType: 'volume',
            value: volumeValue,
            date: volumePR.date,
            sessionId: volumePR.sessionId,
            setDetails: { weightKg: volumePR.weightKg, reps: volumePR.reps },
          });
        }
      });

      setRecords(detectedPRs);
    } catch (error) {
      console.error('Error loading PRs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecordForExercise = (exerciseId: number, recordType: 'weight' | 'reps' | 'volume') => {
    return records.find(
      (r) => r.exerciseId === exerciseId && r.recordType === recordType
    );
  };

  const isPersonalRecord = (
    exerciseId: number,
    weightKg: number,
    reps: number,
    recordType: 'weight' | 'reps' | 'volume' = 'weight'
  ): boolean => {
    const existing = getRecordForExercise(exerciseId, recordType);
    if (!existing) return true;

    switch (recordType) {
      case 'weight':
        return weightKg > existing.value;
      case 'reps':
        return reps > existing.value;
      case 'volume':
        const currentVolume = calculateVolume(weightKg, reps);
        return currentVolume > existing.value;
    }
  };

  return {
    records,
    loading,
    refresh: loadRecords,
    getRecordForExercise,
    isPersonalRecord,
  };
}
