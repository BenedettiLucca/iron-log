export interface SetAnimationData {
  id: number;
  setNumber: number;
  weightKg: number;
  reps: number;
  durationSeconds: number | null;
  rir: number | null;
  isWarmup: boolean;
  isEdited: boolean;
}

export function buildSetAnimationSignatures(
  sets: readonly SetAnimationData[],
): ReadonlyMap<number, string> {
  const map = new Map<number, string>();
  for (const set of sets) {
    const signature = JSON.stringify([
      set.setNumber,
      set.weightKg,
      set.reps,
      set.durationSeconds,
      set.rir,
      set.isWarmup,
      set.isEdited,
    ]);
    map.set(set.id, signature);
  }
  return map;
}

export function getAnimatedSetIds(
  previous: ReadonlyMap<number, string>,
  current: ReadonlyMap<number, string>,
): ReadonlySet<number> {
  const animatedSetIds = new Set<number>();
  for (const [id, signature] of current.entries()) {
    if (!previous.has(id) || previous.get(id) !== signature) {
      animatedSetIds.add(id);
    }
  }
  return animatedSetIds;
}
