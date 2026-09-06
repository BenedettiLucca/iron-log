/**
 * Equipment filtering for the exercise library.
 *
 * Pure helpers used by the routine editor's picker. All matching is
 * case/accent-insensitive on the exercise name (mirrors migration 0023
 * heuristics) because the `equipment` column may still be NULL for
 * custom exercises created before the column existed.
 */

export type EquipmentKey =
  | 'barra'
  | 'halteres'
  | 'maquina'
  | 'peso_corporal'
  | 'elastico'
  | 'cabos'
  | 'kettlebell'
  | 'other';

/** Normalize for comparison: lowercase + strip common accents. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface ExerciseLike {
  name?: string | null;
  equipment?: string | null;
}

/** Derive the equipment key for an exercise (column first, name heuristics as fallback). */
export function deriveEquipmentKey(exercise: ExerciseLike): EquipmentKey | null {
  if (
    exercise.equipment === 'barra' ||
    exercise.equipment === 'halteres' ||
    exercise.equipment === 'maquina' ||
    exercise.equipment === 'peso_corporal' ||
    exercise.equipment === 'elastico' ||
    exercise.equipment === 'cabos' ||
    exercise.equipment === 'kettlebell'
  ) {
    return exercise.equipment;
  }

  const n = normalize(exercise.name ?? '');
  if (!n) return null;

  if (/(barra fixa|paralela|mergulho|flexao|prancha|peso corporal|bodyweight)/.test(n)) return 'peso_corporal';
  if (/(kettlebell|\bkb\b)/.test(n)) return 'kettlebell';
  if (/(elastico|band)/.test(n)) return 'elastico';
  if (/(crossover|cross over|face pull|pulley|pulldown|cabo|cabos|cable)/.test(n)) return 'cabos';
  if (/(maquina|machine|leg press|hack|smith|peck deck|pec deck|voador|extensor|flexora|abdutora|adutora)/.test(n)) return 'maquina';
  if (/(halter|dumbbell|dumbell)/.test(n)) return 'halteres';
  if (/(barra|barbell)/.test(n)) return 'barra';

  return null;
}

/** Distinct equipment keys present in the exercise list (stable order). */
export function getAvailableEquipments(exercises: ExerciseLike[]): EquipmentKey[] {
  const found = new Set<EquipmentKey>();
  for (const ex of exercises) {
    const key = deriveEquipmentKey(ex);
    if (key) found.add(key);
  }
  return Array.from(found);
}

/**
 * Filter exercises by an equipment chip ("all" disables equipment filtering)
 * plus a free-text search term matched against the exercise name.
 */
export function filterExercisesByEquipmentAndSearch<T extends ExerciseLike>(
  exercises: T[],
  equipmentKey: string,
  search: string
): T[] {
  const normalizedSearch = normalize(search.trim());

  return exercises.filter((ex) => {
    if (equipmentKey && equipmentKey !== 'all') {
      if (deriveEquipmentKey(ex) !== equipmentKey) return false;
    }
    if (normalizedSearch && !normalize(ex.name ?? '').includes(normalizedSearch)) {
      return false;
    }
    return true;
  });
}
