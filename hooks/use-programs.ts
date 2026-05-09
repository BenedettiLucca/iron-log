import { useState, useCallback } from 'react';
import { ProgramService } from '@/services/ProgramService';
import { logger } from '@/services/logger';
import type { Program, ProgramWeek, ProgramExerciseTarget, DoubleProgressionStatus, KeyLift, WeekCompletionStatus } from '@/src/types';

export function usePrograms() {
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
  const [targets, setTargets] = useState<ProgramExerciseTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Dashboard state
  const [weeklyVolume, setWeeklyVolume] = useState(0);
  const [avgWeeklyVolume, setAvgWeeklyVolume] = useState(0);
  const [avgSRPE, setAvgSRPE] = useState<number | null>(null);
  const [keyLifts, setKeyLifts] = useState<KeyLift[]>([]);
  const [weekCompletionMap, setWeekCompletionMap] = useState<Map<number, WeekCompletionStatus>>(new Map());

  const fetchAllPrograms = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await ProgramService.getAllPrograms();
      setAllPrograms(data);
    } catch (e) {
      logger.error('Failed to fetch programs', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchActiveProgram = useCallback(async () => {
    try {
      setIsLoading(true);
      const program = await ProgramService.getActiveProgram();
      setActiveProgram(program);
      if (program) {
        const [w, t] = await Promise.all([
          ProgramService.getProgramWeeks(program.id),
          ProgramService.getExerciseTargets(program.id),
        ]);
        setWeeks(w);
        setTargets(t);
      }
    } catch (e) {
      logger.error('Failed to fetch active program', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProgramDetails = useCallback(async (programId: number) => {
    try {
      setIsLoading(true);
      setDetailError(null);
      const [program, w, t] = await Promise.all([
        ProgramService.getProgram(programId),
        ProgramService.getProgramWeeks(programId),
        ProgramService.getExerciseTargets(programId),
      ]);
      if (program) {
        setActiveProgram(program);
      } else {
        setActiveProgram(null);
      }
      setWeeks(w);
      setTargets(t);
    } catch (e) {
      logger.error('Failed to fetch program details', e);
      setActiveProgram(null);
      setDetailError(e instanceof Error ? e.message : 'Failed to load program');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProgram = useCallback(async (data: {
    name: string;
    description?: string;
    startDate: number;
    endDate: number;
    weeksDuration: number;
    deloadWeek?: number;
    goal: string;
  }): Promise<Program | null> => {
    const result = await ProgramService.createProgram(data);
    if (result) {
      await fetchAllPrograms();
      setActiveProgram(result);
    }
    return result;
  }, [fetchAllPrograms]);

  const updateProgram = useCallback(async (id: number, data: Partial<Program>): Promise<boolean> => {
    const success = await ProgramService.updateProgram(id, data);
    if (success) await fetchAllPrograms();
    return success;
  }, [fetchAllPrograms]);

  const deleteProgram = useCallback(async (id: number): Promise<boolean> => {
    const success = await ProgramService.deleteProgram(id);
    if (success) {
      await fetchAllPrograms();
      if (activeProgram?.id === id) {
        setActiveProgram(null);
        setWeeks([]);
        setTargets([]);
      }
    }
    return success;
  }, [fetchAllPrograms, activeProgram]);

  const archiveProgram = useCallback(async (id: number): Promise<boolean> => {
    const success = await ProgramService.archiveProgram(id);
    if (success) {
      await fetchAllPrograms();
      if (activeProgram?.id === id) {
        setActiveProgram(null);
        setWeeks([]);
        setTargets([]);
      }
    }
    return success;
  }, [fetchAllPrograms, activeProgram]);

  const setWeekRoutine = useCallback(async (
    programId: number,
    weekNumber: number,
    routineId: number | null,
    phase?: string,
    rirTarget?: number,
    intensityMod?: number
  ) => {
    const result = await ProgramService.setWeekRoutine(programId, weekNumber, routineId, phase, rirTarget, intensityMod);
    if (result) {
      setWeeks(prev => {
        const filtered = prev.filter(w => w.weekNumber !== weekNumber);
        return [...filtered, result].sort((a, b) => a.weekNumber - b.weekNumber);
      });
    }
    return result;
  }, []);

  const setAllWeeks = useCallback(async (
    programId: number,
    weekData: {
      weekNumber: number;
      routineId: number | null;
      phase: string;
      rirTarget: number;
      intensityMod: number;
    }[]
  ): Promise<boolean> => {
    const success = await ProgramService.setAllWeeks(programId, weekData);
    if (success) {
      const w = await ProgramService.getProgramWeeks(programId);
      setWeeks(w);
    }
    return success;
  }, []);

  const setExerciseTarget = useCallback(async (
    programId: number,
    exerciseId: number,
    targetRepsMin: number,
    targetRepsMax: number,
    targetSets: number
  ): Promise<boolean> => {
    const success = await ProgramService.setExerciseTarget(programId, exerciseId, targetRepsMin, targetRepsMax, targetSets);
    if (success) {
      const t = await ProgramService.getExerciseTargets(programId);
      setTargets(t);
    }
    return success;
  }, []);

  const removeExerciseTarget = useCallback(async (programId: number, exerciseId: number): Promise<boolean> => {
    const success = await ProgramService.removeExerciseTarget(programId, exerciseId);
    if (success) {
      setTargets(prev => prev.filter(t => t.exerciseId !== exerciseId));
    }
    return success;
  }, []);

  const getDoubleProgressionStatus = useCallback(async (
    programId: number,
    exerciseId: number,
    exerciseName: string
  ): Promise<DoubleProgressionStatus | null> => {
    return ProgramService.getDoubleProgressionStatus(programId, exerciseId, exerciseName);
  }, []);

  // Dashboard helpers (pure computations, no state)
  const getCurrentWeek = useCallback((): number | null => {
    if (!activeProgram) return null;
    return ProgramService.getCurrentWeek(activeProgram);
  }, [activeProgram]);

  const getWeeksUntilDeload = useCallback((): number | null => {
    if (!activeProgram) return null;
    return ProgramService.getWeeksUntilDeload(activeProgram);
  }, [activeProgram]);

  const getCurrentPhase = useCallback((): string | null => {
    if (!activeProgram) return null;
    return ProgramService.getCurrentPhase(activeProgram);
  }, [activeProgram]);

  const getWeeklyVolume = useCallback(async (): Promise<number> => {
    if (!activeProgram) return 0;
    return ProgramService.getWeeklyVolume(activeProgram);
  }, [activeProgram]);

  const fetchDashboardData = useCallback(async () => {
    if (!activeProgram) return;
    try {
      const [vol, avgVol, rpe, lifts, completion] = await Promise.all([
        ProgramService.getWeeklyVolume(activeProgram),
        ProgramService.getAverageWeeklyVolume(activeProgram),
        ProgramService.getAverageSRPE(activeProgram),
        ProgramService.getKeyLifts(activeProgram),
        ProgramService.getWeekCompletionMap(activeProgram),
      ]);
      setWeeklyVolume(vol);
      setAvgWeeklyVolume(avgVol);
      setAvgSRPE(rpe);
      setKeyLifts(lifts);
      setWeekCompletionMap(completion);
    } catch (e) {
      logger.error('Failed to fetch dashboard data', e);
    }
  }, [activeProgram]);

  const getSessionsForWeek = useCallback(async (weekNumber: number) => {
    if (!activeProgram) return [];
    return ProgramService.getSessionsForWeek(activeProgram, weekNumber);
  }, [activeProgram]);

  return {
    allPrograms,
    activeProgram,
    weeks,
    targets,
    isLoading,
    detailError,
    weeklyVolume,
    avgWeeklyVolume,
    avgSRPE,
    keyLifts,
    weekCompletionMap,
    fetchAllPrograms,
    fetchActiveProgram,
    fetchProgramDetails,
    createProgram,
    updateProgram,
    deleteProgram,
    archiveProgram,
    setWeekRoutine,
    setAllWeeks,
    setExerciseTarget,
    removeExerciseTarget,
    getDoubleProgressionStatus,
    getCurrentWeek,
    getWeeksUntilDeload,
    getCurrentPhase,
    getWeeklyVolume,
    fetchDashboardData,
    getSessionsForWeek,
  };
}
