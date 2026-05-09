type TFunction = (key: string) => string;

export interface SummarySet {
  exerciseId: number;
  exerciseName: string | null;
  setNumber: number;
  weightKg: number;
  reps: number;
  durationSeconds: number | null;
  rir: number | null;
  deletedAt?: number | null;
}

export interface SummarySession {
  routineId: number | null;
  routineName: string | null;
  startTime: number;
  bodyWeight: number | null;
  sRpe: number | null;
  notes: string | null;
  durationMinutes: number | null;
}

interface ExerciseSummary {
  name: string;
  sets: SummarySet[];
  exId: number;
  target?: string;
}

export interface SessionStats {
  totalSets: number;
  totalVolume: number;
  bestSet: { weight: number; reps: number; exercise: string } | null;
  averageIntensity: number;
}

export interface BuildSessionSummaryInput {
  session: SummarySession;
  setsData: SummarySet[];
  targetsMap: Map<number, string>;
  t: TFunction;
}

export interface BuildSessionSummaryResult {
  report: string;
  stats: SessionStats;
}

export function buildSessionSummary({
  session,
  setsData,
  targetsMap,
  t,
}: BuildSessionSummaryInput): BuildSessionSummaryResult {
  const activeSets = setsData.filter(set => set.deletedAt == null);
  const exercisesMap = new Map<string, ExerciseSummary>();

  activeSets.forEach(set => {
    const exName = set.exerciseName || `${t('common.exercise')} ${set.exerciseId}`;
    if (!exercisesMap.has(exName)) {
      exercisesMap.set(exName, { sets: [], exId: set.exerciseId, name: exName });
    }
    exercisesMap.get(exName)!.sets.push(set);
  });

  exercisesMap.forEach((data) => {
    const target = targetsMap.get(data.exId);
    if (target) data.target = target;
  });

  let totalVolume = 0;
  let maxVolume = 0;
  let bestSet: SessionStats['bestSet'] = null;

  activeSets.forEach(set => {
    if (set.reps && set.weightKg) {
      const volume = set.reps * set.weightKg;
      totalVolume += volume;

      if (volume > maxVolume) {
        maxVolume = volume;
        bestSet = {
          weight: set.weightKg,
          reps: set.reps,
          exercise: set.exerciseName || 'Unknown',
        };
      }
    }
  });

  const stats: SessionStats = {
    totalSets: activeSets.length,
    totalVolume,
    bestSet,
    averageIntensity: activeSets.length > 0 ? totalVolume / activeSets.length : 0,
  };

  const dateObj = new Date(session.startTime);
  const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

  let report = `💪 TREINO ${session.routineName} - [${dateStr}]\n\n`;
  report += `⚖️ Peso: ${session.bodyWeight || 'N/A'} kg | ⏱️ Duração: ${session.durationMinutes} min | 🔥 sRPE: ${session.sRpe}\n\n`;

  exercisesMap.forEach((data) => {
    const { sets: setsList, target } = data;
    setsList.sort((a, b) => a.setNumber - b.setNumber);

    const setsStr = setsList.map(s => {
      let coreStr = '';
      if (s.durationSeconds) {
        coreStr = `${s.durationSeconds}s`;
        if (s.weightKg > 0) coreStr += `x${s.weightKg}kg`;
      } else {
        coreStr = `${s.reps}x${s.weightKg}kg`;
      }
      return `S${s.setNumber}: ${coreStr}${s.rir !== null ? `xRIR${s.rir}` : ''}`;
    }).join(' | ');

    const header = target ? `[${data.name}] (Meta: ${target})` : `[${data.name}]`;
    report += `${header}: ${setsStr}\n`;
  });

  if (session.notes) {
    report += `\n📝 Observações: ${session.notes}`;
  }

  return { report, stats };
}
