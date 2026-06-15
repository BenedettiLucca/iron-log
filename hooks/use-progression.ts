import { useState, useEffect } from 'react';
import { usePrograms } from './use-programs';
import type { DoubleProgressionStatus } from '../src/types';

export function useProgression(exerciseId: number, exerciseName: string) {
  const { activeProgram, fetchActiveProgram, getDoubleProgressionStatus } = usePrograms();
  const [progressionStatus, setProgressionStatus] = useState<DoubleProgressionStatus | null>(null);

  useEffect(() => {
    fetchActiveProgram();
  }, [fetchActiveProgram]);

  useEffect(() => {
    if (activeProgram && exerciseId) {
      getDoubleProgressionStatus(activeProgram.id, exerciseId, exerciseName).then(setProgressionStatus);
    } else {
      setProgressionStatus(null);
    }
  }, [activeProgram, exerciseId, exerciseName, getDoubleProgressionStatus]);

  return { activeProgram, progressionStatus };
}
