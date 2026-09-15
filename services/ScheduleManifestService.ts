import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { db as defaultDb } from '@/src/db/client';
import {
  routines,
  routineExercises,
  exercises,
  folders,
  programs,
  programWeeks,
  programExerciseTargets,
  notificationSettings,
  userSettings,
} from '@/src/db/schema';
import { eq, asc } from 'drizzle-orm';
import { logger } from '@/services/logger';

// ---------------------------------------------------------------------------
// TypeScript interfaces (Contract for Hermes/Obsidian lane)
// ---------------------------------------------------------------------------

export interface ManifestRoutineExercise {
  id: number;
  exerciseId: number;
  name: string;
  type: string;
  orderIndex: number;
  target: string | null;
  notes: string | null;
  restSeconds: number | null;
}

export interface ManifestRoutine {
  id: number;
  name: string;
  folder: string;
  description: string | null;
  isTemplate: boolean;
  exercises: ManifestRoutineExercise[];
}

export interface ManifestProgramWeek {
  id: number;
  weekNumber: number;
  routineId: number | null;
  routineName: string | null;
  phase: string;
  rirTarget: number;
  intensityMod: number;
}

export interface ManifestProgramTarget {
  id: number;
  exerciseId: number;
  exerciseName: string | null;
  targetRepsMin: number;
  targetRepsMax: number;
  targetSets: number;
}

export interface ManifestProgram {
  id: number;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  weeksDuration: number;
  deloadWeek: number | null;
  goal: string;
  isActive: boolean;
  createdAt: string | null;
  currentWeek: number;
  currentPhase: string;
  weeks: ManifestProgramWeek[];
  targets: ManifestProgramTarget[];
}

export interface ManifestFolder {
  id: number;
  name: string;
}

export interface ManifestNotificationSettings {
  checkinDay: number;
  checkinHour: number;
  enabled: boolean;
  lastNotificationDate: string | null;
}

export interface ManifestUserSettings {
  defaultWeight: number | null;
  height: number | null;
  sex: string | null;
}

export interface ManifestSettings {
  notifications: ManifestNotificationSettings | null;
  user: ManifestUserSettings | null;
}

export interface ScheduleManifest {
  manifestVersion: number;
  exportedAt?: string;
  folders: ManifestFolder[];
  routines: ManifestRoutine[];
  activeProgram: ManifestProgram | null;
  settings: ManifestSettings;
}

export interface BuildManifestOptions {
  db?: unknown;
  now?: number | Date;
  exportedAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyDb = any;

function resolveDb(dbOrOptions?: unknown, maybeOptions?: BuildManifestOptions): {
  database: AnyDb;
  options?: BuildManifestOptions;
} {
  if (dbOrOptions && typeof (dbOrOptions as AnyDb).select === 'function') {
    return { database: dbOrOptions as AnyDb, options: maybeOptions };
  }
  if (dbOrOptions && typeof dbOrOptions === 'object' && 'db' in dbOrOptions && (dbOrOptions as BuildManifestOptions).db) {
    const opts = dbOrOptions as BuildManifestOptions;
    return { database: opts.db as AnyDb, options: opts };
  }
  return { database: defaultDb as AnyDb, options: dbOrOptions as BuildManifestOptions | undefined };
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

export const ScheduleManifestService = {
  /**
   * Builds a deterministic JSON manifest of the training schedule.
   * Same DB state -> byte-identical output with stable key order and sorted arrays.
   */
  async buildManifest(
    dbOrOptions?: unknown,
    maybeOptions?: BuildManifestOptions
  ): Promise<ScheduleManifest> {
    const { database, options } = resolveDb(dbOrOptions, maybeOptions);

    // 1. Folders
    const rawFolders = (await database.select().from(folders).orderBy(asc(folders.id))) as {
      id: number;
      name: string;
    }[];

    const manifestFolders: ManifestFolder[] = rawFolders
      .map((f) => ({
        id: f.id,
        name: f.name,
      }))
      .sort((a, b) => a.id - b.id);

    // 2. Exercises (for mapping names and types)
    const rawExercises = (await database.select().from(exercises).orderBy(asc(exercises.id))) as {
      id: number;
      name: string;
      type: string;
      defaultRestSeconds: number | null;
    }[];

    const exerciseMap = new Map<number, { id: number; name: string; type: string; defaultRestSeconds: number | null }>();
    for (const ex of rawExercises) {
      exerciseMap.set(ex.id, {
        id: ex.id,
        name: ex.name,
        type: ex.type,
        defaultRestSeconds: ex.defaultRestSeconds ?? null,
      });
    }

    // 3. Routines and Routine Exercises
    const rawRoutines = (await database.select().from(routines).orderBy(asc(routines.id))) as {
      id: number;
      name: string;
      description: string | null;
      folder: string | null;
      isTemplate: boolean | number;
    }[];

    const rawRoutineExercises = (await database
      .select()
      .from(routineExercises)
      .orderBy(asc(routineExercises.routineId), asc(routineExercises.orderIndex), asc(routineExercises.id))) as {
      id: number;
      routineId: number | null;
      exerciseId: number | null;
      orderIndex: number | null;
      target: string | null;
      notes: string | null;
      restSeconds: number | null;
    }[];

    const routineExByRoutine = new Map<number, ManifestRoutineExercise[]>();
    for (const re of rawRoutineExercises) {
      if (re.routineId == null || re.exerciseId == null) continue;
      const ex = exerciseMap.get(re.exerciseId);
      const item: ManifestRoutineExercise = {
        id: re.id,
        exerciseId: re.exerciseId,
        name: ex ? ex.name : `Exercise #${re.exerciseId}`,
        type: ex ? ex.type : 'strength',
        orderIndex: re.orderIndex ?? 0,
        target: re.target ?? null,
        notes: re.notes ?? null,
        restSeconds: re.restSeconds ?? (ex?.defaultRestSeconds ?? null),
      };
      const list = routineExByRoutine.get(re.routineId) || [];
      list.push(item);
      routineExByRoutine.set(re.routineId, list);
    }

    const manifestRoutines: ManifestRoutine[] = rawRoutines
      .map((r) => {
        const exs = routineExByRoutine.get(r.id) || [];
        exs.sort((a, b) => (a.orderIndex - b.orderIndex) || (a.id - b.id));
        return {
          id: r.id,
          name: r.name,
          folder: r.folder || 'Geral',
          description: r.description ?? null,
          isTemplate: Boolean(r.isTemplate),
          exercises: exs,
        };
      })
      .sort((a, b) => a.id - b.id);

    // 4. Active Program
    const activeProgramRows = (await database
      .select()
      .from(programs)
      .where(eq(programs.isActive, true))
      .orderBy(asc(programs.id))) as {
      id: number;
      name: string;
      description: string | null;
      startDate: number;
      endDate: number;
      weeksDuration: number;
      deloadWeek: number | null;
      goal: string;
      isActive: boolean | number;
      createdAt: number | null;
    }[];

    let activeProgram: ManifestProgram | null = null;
    if (activeProgramRows.length > 0) {
      const p = activeProgramRows[0];

      const rawProgramWeeks = (await database
        .select()
        .from(programWeeks)
        .where(eq(programWeeks.programId, p.id))
        .orderBy(asc(programWeeks.weekNumber), asc(programWeeks.id))) as {
        id: number;
        programId: number;
        weekNumber: number;
        routineId: number | null;
        phase: string;
        rirTarget: number | null;
        intensityMod: number | null;
      }[];

      const rawTargets = (await database
        .select()
        .from(programExerciseTargets)
        .where(eq(programExerciseTargets.programId, p.id))
        .orderBy(asc(programExerciseTargets.id))) as {
        id: number;
        programId: number;
        exerciseId: number;
        targetRepsMin: number;
        targetRepsMax: number;
        targetSets: number;
      }[];

      const routineNameMap = new Map<number, string>(rawRoutines.map((r) => [r.id, r.name]));

      const weeks: ManifestProgramWeek[] = rawProgramWeeks
        .map((w) => ({
          id: w.id,
          weekNumber: w.weekNumber,
          routineId: w.routineId ?? null,
          routineName: w.routineId ? (routineNameMap.get(w.routineId) ?? null) : null,
          phase: w.phase || 'accumulation',
          rirTarget: w.rirTarget ?? 0,
          intensityMod: w.intensityMod ?? 1.0,
        }))
        .sort((a, b) => (a.weekNumber - b.weekNumber) || (a.id - b.id));

      const targets: ManifestProgramTarget[] = rawTargets
        .map((t) => ({
          id: t.id,
          exerciseId: t.exerciseId,
          exerciseName: exerciseMap.get(t.exerciseId)?.name ?? null,
          targetRepsMin: t.targetRepsMin,
          targetRepsMax: t.targetRepsMax,
          targetSets: t.targetSets,
        }))
        .sort((a, b) => a.id - b.id);

      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const nowMs = typeof options?.now === 'number'
        ? options.now
        : (options?.now instanceof Date ? options.now.getTime() : Date.now());
      const elapsed = nowMs - p.startDate;
      const currentWeek = Math.min(Math.max(1, Math.floor(elapsed / msPerWeek) + 1), p.weeksDuration);

      let currentPhase = 'accumulation';
      if (p.deloadWeek && currentWeek >= p.deloadWeek) {
        currentPhase = 'deload';
      } else {
        const firstHalf = Math.floor(p.weeksDuration / 2);
        if (currentWeek <= firstHalf) {
          currentPhase = 'accumulation';
        } else {
          currentPhase = 'intensification';
        }
      }

      activeProgram = {
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        startDate: new Date(p.startDate).toISOString(),
        endDate: new Date(p.endDate).toISOString(),
        weeksDuration: p.weeksDuration,
        deloadWeek: p.deloadWeek ?? null,
        goal: p.goal || 'hypertrophy',
        isActive: Boolean(p.isActive),
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
        currentWeek,
        currentPhase,
        weeks,
        targets,
      };
    }

    // 5. Settings
    const rawNotif = (await database.select().from(notificationSettings).limit(1)) as {
      id: number;
      checkinDay: number;
      checkinHour: number;
      enabled: boolean | number;
      lastNotificationDate: number | null;
    }[];

    const rawUser = (await database.select().from(userSettings).limit(1)) as {
      id: number;
      defaultWeight: number | null;
      height: number | null;
      sex: string | null;
    }[];

    const notif = rawNotif[0];
    const user = rawUser[0];

    const manifestSettings: ManifestSettings = {
      notifications: notif
        ? {
            checkinDay: notif.checkinDay,
            checkinHour: notif.checkinHour,
            enabled: Boolean(notif.enabled),
            lastNotificationDate: notif.lastNotificationDate
              ? new Date(notif.lastNotificationDate).toISOString()
              : null,
          }
        : null,
      user: user
        ? {
            defaultWeight: user.defaultWeight ?? null,
            height: user.height ?? null,
            sex: user.sex ?? null,
          }
        : null,
    };

    // Explicit key construction for deterministic JSON serialization
    const manifest: ScheduleManifest = {
      manifestVersion: 1,
      ...(options?.exportedAt ? { exportedAt: options.exportedAt } : {}),
      folders: manifestFolders,
      routines: manifestRoutines,
      activeProgram,
      settings: manifestSettings,
    };

    return manifest;
  },

  /**
   * Generates a deterministic JSON string representation of the manifest.
   */
  async exportManifestJson(
    dbOrOptions?: unknown,
    maybeOptions?: BuildManifestOptions
  ): Promise<string> {
    const manifest = await this.buildManifest(dbOrOptions, maybeOptions);
    return JSON.stringify(manifest, null, 2);
  },

  /**
   * Saves the manifest to expo-file-system documentDirectory.
   */
  async saveManifest(
    dbOrOptions?: unknown,
    maybeOptions?: BuildManifestOptions
  ): Promise<string> {
    try {
      const json = await this.exportManifestJson(dbOrOptions, maybeOptions);
      const filePath = `${FileSystem.documentDirectory}schedule_manifest.json`;

      await FileSystem.writeAsStringAsync(filePath, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      logger.info('Schedule manifest saved to documentDirectory:', filePath);
      return filePath;
    } catch (e) {
      logger.error('Failed to save schedule manifest', e);
      throw e;
    }
  },

  /**
   * Exports the manifest and opens the sharing sheet if available.
   */
  async exportAndShare(
    dbOrOptions?: unknown,
    maybeOptions?: BuildManifestOptions
  ): Promise<string> {
    try {
      const filePath = await this.saveManifest(dbOrOptions, maybeOptions);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          dialogTitle: 'Exportar Manifest de Treino',
          mimeType: 'application/json',
          UTI: 'public.json',
        });
      }

      return filePath;
    } catch (e) {
      logger.error('Failed to export and share schedule manifest', e);
      throw e;
    }
  },
};
