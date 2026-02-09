import { useState, useEffect } from 'react';
import { db } from '@/db/client';
import { sets, sessions } from '@/db/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
import { calculateVolume } from '@/utils/calculations';

export interface VolumeDataPoint {
  date: number; // epoch (start of day)
  volume: number;
  setsCount: number;
}

export interface VolumeStats {
  totalVolume: number;
  averageVolume: number;
  totalSets: number;
  totalSessions: number;
  volumePerSession: number;
}

/**
 * Hook for tracking training volume over time
 */
export function useVolumeTracking(days = 30) {
  const [volumeData, setVolumeData] = useState<VolumeDataPoint[]>([]);
  const [stats, setStats] = useState<VolumeStats>({
    totalVolume: 0,
    averageVolume: 0,
    totalSets: 0,
    totalSessions: 0,
    volumePerSession: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateVolumeData();
  }, [days]);

  const calculateVolumeData = async () => {
    try {
      setLoading(true);

      // Get sets within the date range using a join
      const now = Date.now();
      const startDate = now - days * 24 * 60 * 60 * 1000;

      const allSets = await db
        .select({
          sessionId: sets.sessionId,
          weightKg: sets.weightKg,
          reps: sets.reps,
          createdAt: sets.createdAt,
          sessionStartTime: sessions.startTime,
        })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(gte(sessions.startTime, startDate))
        .orderBy(desc(sets.createdAt));

      if (allSets.length === 0) {
        setVolumeData([]);
        setStats({
          totalVolume: 0,
          averageVolume: 0,
          totalSets: 0,
          totalSessions: 0,
          volumePerSession: 0,
        });
        setLoading(false);
        return;
      }

      // Group by date
      const volumeByDate = new Map<number, VolumeDataPoint>();

      allSets.forEach((set) => {
        const date = new Date(set.createdAt);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

        if (!volumeByDate.has(dayStart)) {
          volumeByDate.set(dayStart, {
            date: dayStart,
            volume: 0,
            setsCount: 0,
          });
        }

        const dayData = volumeByDate.get(dayStart)!;
        dayData.volume += calculateVolume(set.weightKg, set.reps);
        dayData.setsCount += 1;
      });

      // Convert to array and sort by date
      const sortedData = Array.from(volumeByDate.values()).sort((a, b) => a.date - b.date);
      setVolumeData(sortedData);

      // Get unique session count
      const uniqueSessions = new Set(allSets.map((s) => s.sessionId)).size;

      // Calculate stats
      const totalVolume = sortedData.reduce((sum, day) => sum + day.volume, 0);
      const totalSets = sortedData.reduce((sum, day) => sum + day.setsCount, 0);
      const averageVolume = sortedData.length > 0 ? totalVolume / sortedData.length : 0;
      const volumePerSession = uniqueSessions > 0 ? totalVolume / uniqueSessions : 0;

      setStats({
        totalVolume,
        averageVolume,
        totalSets,
        totalSessions: uniqueSessions,
        volumePerSession,
      });
    } catch (error) {
      console.error('Error calculating volume data:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    volumeData,
    stats,
    loading,
    refresh: calculateVolumeData,
  };
}

/**
 * Hook for exercise-specific volume tracking
 */
export function useExerciseVolume(exerciseId: number, days = 30) {
  const [volumeData, setVolumeData] = useState<VolumeDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateExerciseVolume();
  }, [exerciseId, days]);

  const calculateExerciseVolume = async () => {
    try {
      setLoading(true);

      const now = Date.now();
      const startDate = now - days * 24 * 60 * 60 * 1000;

      const exerciseSets = await db
        .select({
          sessionId: sets.sessionId,
          weightKg: sets.weightKg,
          reps: sets.reps,
          createdAt: sets.createdAt,
        })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(
          and(
            eq(sets.exerciseId, exerciseId),
            gte(sessions.startTime, startDate)
          )
        )
        .orderBy(desc(sets.createdAt));

      // Group by date
      const volumeByDate = new Map<number, VolumeDataPoint>();

      exerciseSets.forEach((set) => {
        const date = new Date(set.createdAt);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

        if (!volumeByDate.has(dayStart)) {
          volumeByDate.set(dayStart, {
            date: dayStart,
            volume: 0,
            setsCount: 0,
          });
        }

        const dayData = volumeByDate.get(dayStart)!;
        dayData.volume += calculateVolume(set.weightKg, set.reps);
        dayData.setsCount += 1;
      });

      const sortedData = Array.from(volumeByDate.values()).sort((a, b) => a.date - b.date);
      setVolumeData(sortedData);
    } catch (error) {
      console.error('Error calculating exercise volume:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    volumeData,
    loading,
    refresh: calculateExerciseVolume,
  };
}
