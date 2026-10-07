import { db, sqlite } from '../fixtures/database';
import { exercises, routines, routineExercises } from '@/src/db/schema';
import {
  RoutineImportService,
} from '@/services/RoutineImportService';
import { eq } from 'drizzle-orm';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

beforeEach(() => {
  sqlite.exec(
    'DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM exercises; DELETE FROM sqlite_sequence;'
  );
});

afterAll(() => {
  sqlite.close();
});

describe('RoutineImportService', () => {
  describe('pre-write validation', () => {
    it('rejects empty or whitespace-only clipboard payload before DB interaction', async () => {
      await expect(RoutineImportService.importRoutine('', db)).rejects.toMatchObject({
        code: 'EMPTY_PAYLOAD',
      });
      await expect(RoutineImportService.importRoutine('   \n  \t ', db)).rejects.toMatchObject({
        code: 'EMPTY_PAYLOAD',
      });

      expect(db.select().from(routines).all()).toHaveLength(0);
      expect(db.select().from(exercises).all()).toHaveLength(0);
      expect(db.select().from(routineExercises).all()).toHaveLength(0);
    });

    it('rejects malformed JSON string before DB interaction', async () => {
      await expect(RoutineImportService.importRoutine('{ name: "bad json", ', db)).rejects.toMatchObject({
        code: 'INVALID_JSON',
      });

      expect(db.select().from(routines).all()).toHaveLength(0);
    });

    it('rejects payload missing routine name', async () => {
      await expect(
        RoutineImportService.importRoutine(
          JSON.stringify({
            exercises: [{ name: 'Supino' }],
          }),
          db
        )
      ).rejects.toMatchObject({
        code: 'INVALID_STRUCTURE',
      });

      await expect(
        RoutineImportService.importRoutine(
          {
            name: '   ',
            exercises: [{ name: 'Supino' }],
          },
          db
        )
      ).rejects.toMatchObject({
        code: 'INVALID_STRUCTURE',
      });

      expect(db.select().from(routines).all()).toHaveLength(0);
    });

    it('rejects payload when exercises is not an array', async () => {
      await expect(
        RoutineImportService.importRoutine(
          {
            name: 'Treino Inválido',
            exercises: 'Supino',
          },
          db
        )
      ).rejects.toMatchObject({
        code: 'INVALID_STRUCTURE',
      });

      expect(db.select().from(routines).all()).toHaveLength(0);
    });

    it('rejects payload when any exercise is missing a name', async () => {
      await expect(
        RoutineImportService.importRoutine(
          {
            name: 'Treino Sem Nome de Exercício',
            exercises: [
              { name: 'Supino', target: '4x10' },
              { target: '3x12' }, // missing name
            ],
          },
          db
        )
      ).rejects.toMatchObject({
        code: 'INVALID_STRUCTURE',
      });

      expect(db.select().from(routines).all()).toHaveLength(0);
      expect(db.select().from(exercises).all()).toHaveLength(0);
    });

    it('accepts a valid routine with zero exercises (empty routine)', async () => {
      const result = await RoutineImportService.importRoutine(
        {
          name: 'Rotina Vazia',
          description: 'Sem exercícios',
          exercises: [],
        },
        db
      );

      expect(result.success).toBe(true);
      expect(result.routineName).toBe('Rotina Vazia');
      expect(result.exercisesCount).toBe(0);

      const dbRoutines = db.select().from(routines).all();
      expect(dbRoutines).toHaveLength(1);
      expect(dbRoutines[0].name).toBe('Rotina Vazia');
    });
  });

  describe('exact normalized identity vs LIKE wildcard (% and _)', () => {
    it('does NOT match another exercise containing % or _ via wildcard matching', async () => {
      // Seed exercise with similar characters
      db.insert(exercises)
        .values([
          { name: '1000 Foco', type: 'strength' },
          { name: '100% Raw Bench', type: 'strength' },
          { name: 'Supino Reto', type: 'strength' },
        ])
        .run();

      // Payload contains % and _ literally
      const payload = {
        name: 'Treino Especial',
        exercises: [
          { name: '100%_Foco', target: '3x10' },
          { name: 'Supino_Reto', target: '4x8' },
        ],
      };

      const result = await RoutineImportService.importRoutine(payload, db);

      expect(result.success).toBe(true);
      // Both 100%_Foco and Supino_Reto must be created as new distinct exercises
      expect(result.customExercisesCreated).toBe(2);

      const allExercises = db.select().from(exercises).all();
      expect(allExercises).toHaveLength(5);

      const exactPercent = allExercises.find((e) => e.name === '100%_Foco');
      expect(exactPercent).toBeDefined();

      const exactUnderscore = allExercises.find((e) => e.name === 'Supino_Reto');
      expect(exactUnderscore).toBeDefined();

      // Verify routineExercises references the new exact ones, NOT the old ones
      const re = db.select().from(routineExercises).where(eq(routineExercises.routineId, result.routineId)).all();
      expect(re).toHaveLength(2);
      expect(re[0].exerciseId).toBe(exactPercent?.id);
      expect(re[1].exerciseId).toBe(exactUnderscore?.id);
    });

    it('preserves A/B/A exercise repetitions with independent order and targets', async () => {
      const payload = {
        name: 'Treino A/B/A',
        exercises: [
          { name: 'Supino Reto', target: '4x8', notes: 'Pesado', rest: 120 },
          { name: 'Barra Fixa', target: '3x10', notes: 'Com peso', rest: 90 },
          { name: 'Supino Reto', target: '3x12', notes: 'Backoff', rest: 60 },
        ],
      };

      const result = await RoutineImportService.importRoutine(payload, db);

      expect(result.success).toBe(true);
      expect(result.exercisesCount).toBe(3);
      // Supino Reto was created once, Barra Fixa created once = 2 unique custom exercises
      expect(result.customExercisesCreated).toBe(2);

      const allExercises = db.select().from(exercises).all();
      expect(allExercises).toHaveLength(2);

      const supino = allExercises.find((e) => e.name === 'Supino Reto');
      const barra = allExercises.find((e) => e.name === 'Barra Fixa');
      expect(supino).toBeDefined();
      expect(barra).toBeDefined();

      const re = db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, result.routineId))
        .orderBy(routineExercises.orderIndex)
        .all();

      expect(re).toHaveLength(3);
      expect(re[0].exerciseId).toBe(supino?.id);
      expect(re[0].orderIndex).toBe(1);
      expect(re[0].target).toBe('4x8');
      expect(re[0].notes).toBe('Pesado');
      expect(re[0].restSeconds).toBe(120);

      expect(re[1].exerciseId).toBe(barra?.id);
      expect(re[1].orderIndex).toBe(2);
      expect(re[1].target).toBe('3x10');
      expect(re[1].notes).toBe('Com peso');
      expect(re[1].restSeconds).toBe(90);

      expect(re[2].exerciseId).toBe(supino?.id);
      expect(re[2].orderIndex).toBe(3);
      expect(re[2].target).toBe('3x12');
      expect(re[2].notes).toBe('Backoff');
      expect(re[2].restSeconds).toBe(60);
    });

    it('reuses existing exercises case-insensitively and accent-insensitively', async () => {
      const existing = db
        .insert(exercises)
        .values({ name: 'Elevação Lateral', type: 'strength', defaultRestSeconds: 90 })
        .returning()
        .get();

      const payload = {
        name: 'Ombros',
        exercises: [
          { name: '  elevacao lateral  ', target: '4x15', rest: 60 },
        ],
      };

      const result = await RoutineImportService.importRoutine(payload, db);

      expect(result.customExercisesCreated).toBe(0);
      const allExercises = db.select().from(exercises).all();
      expect(allExercises).toHaveLength(1);

      const re = db.select().from(routineExercises).where(eq(routineExercises.routineId, result.routineId)).all();
      expect(re).toHaveLength(1);
      expect(re[0].exerciseId).toBe(existing.id);
      expect(re[0].target).toBe('4x15');
      expect(re[0].restSeconds).toBe(60);
    });
  });

  describe('atomic transaction and rollback on failure', () => {
    it('rolls back routine and any created exercises if failure occurs at exercise 12', async () => {
      // Create a payload with 20 exercises
      const exerciseList = Array.from({ length: 20 }, (_, i) => ({
        name: `Exercício ${i + 1}`,
        target: `${i + 1}x10`,
        rest: 60,
      }));

      const payload = {
        name: 'Treino Longo com Falha',
        exercises: exerciseList,
      };

      // Create a database proxy that throws during routine_exercises insertion
      const failingDb = {
        ...db,
        transaction: (callback: any) => {
          return db.transaction((tx: any) => {
            const originalInsert = tx.insert.bind(tx);
            tx.insert = (table: any) => {
              const builder = originalInsert(table);
              const originalValues = builder.values.bind(builder);
              builder.values = (vals: any) => {
                const inner = originalValues(vals);
                if (table === routineExercises) {
                  inner.run = () => {
                    // Inject failure simulating crash at exercise 12
                    throw new Error('Simulated crash at exercise 12');
                  };
                }
                return inner;
              };
              return builder;
            };
            return callback(tx);
          });
        },
      };

      await expect(RoutineImportService.importRoutine(payload, failingDb)).rejects.toMatchObject({
        code: 'DATABASE_ERROR',
      });

      // Assert complete rollback: nothing was persisted!
      expect(db.select().from(routines).all()).toHaveLength(0);
      expect(db.select().from(exercises).all()).toHaveLength(0);
      expect(db.select().from(routineExercises).all()).toHaveLength(0);
    });

    it('allows a safe retry after a failed import without leftovers', async () => {
      const payload = {
        name: 'Treino Retry',
        exercises: [{ name: 'Flexão', target: '3x20' }],
      };

      let failOnce = true;
      const flakyDb = {
        ...db,
        transaction: (callback: any) => {
          if (failOnce) {
            failOnce = false;
            throw new Error('Network / lock timeout');
          }
          return db.transaction(callback);
        },
      };

      // First attempt fails
      await expect(RoutineImportService.importRoutine(payload, flakyDb)).rejects.toThrow();
      expect(db.select().from(routines).all()).toHaveLength(0);

      // Retry succeeds cleanly
      const retryResult = await RoutineImportService.importRoutine(payload, db);
      expect(retryResult.success).toBe(true);
      expect(retryResult.routineName).toBe('Treino Retry');
      expect(db.select().from(routines).all()).toHaveLength(1);
    });
  });

  describe('C6 conflict policy: explicit conflict without overwrite', () => {
    it('fails with DUPLICATE_ROUTINE_NAME when routine name already exists, without overwriting', async () => {
      // Seed existing routine
      const existingRoutine = db
        .insert(routines)
        .values({
          name: 'Treino A',
          description: 'Original description',
          folder: 'Geral',
        })
        .returning()
        .get();

      const payload = {
        name: 'Treino A',
        description: 'New conflicting description',
        exercises: [{ name: 'Supino', target: '4x10' }],
      };

      await expect(RoutineImportService.importRoutine(payload, db)).rejects.toMatchObject({
        code: 'DUPLICATE_ROUTINE_NAME',
      });

      // Ensure original routine was NOT overwritten
      const routinesInDb = db.select().from(routines).all();
      expect(routinesInDb).toHaveLength(1);
      expect(routinesInDb[0].id).toBe(existingRoutine.id);
      expect(routinesInDb[0].description).toBe('Original description');
      expect(db.select().from(routineExercises).all()).toHaveLength(0);
    });

    it('handles trimmed name collision with existing routine', async () => {
      db.insert(routines)
        .values({ name: 'Push Day' })
        .run();

      const payload = {
        name: '  Push Day  ',
        exercises: [],
      };

      await expect(RoutineImportService.importRoutine(payload, db)).rejects.toMatchObject({
        code: 'DUPLICATE_ROUTINE_NAME',
      });
    });
    it('allows import when routine name exists but is archived', async () => {
      // Seed existing archived routine
      const archived = db.insert(routines)
        .values({ name: 'Treino X', folder: 'Geral' })
        .returning()
        .get();
      await db.update(routines).set({ isArchived: true }).where(eq(routines.id, archived.id)).run();

      const payload = {
        name: 'Treino X',
        description: 'New routine',
        exercises: [{ name: 'Supino', target: '3x10' }],
      };

      // Owner decision (2026-10-06): import succeeds with a suffix since only
      // an archived routine collides.
      const result = await RoutineImportService.importRoutine(payload, db);
      expect(result.success).toBe(true);
      expect(result.routineName).toBe('Treino X (2)');

      // Verify imported routine is active (not archived) under the suffixed name
      const imported = db.select().from(routines).where(eq(routines.name, 'Treino X (2)')).all().find(r => !r.isArchived);
      expect(imported).toBeDefined();
      expect(imported?.isArchived).toBe(false);
      expect(imported?.id).not.toBe(archived.id);
    });
  });

  describe('issue #64 regression: import conflict check filters by name AND active', () => {
    it('imports a distinct name successfully when active routines exist', async () => {
      // Regression lock for 7f5b92b: the old chained .where() calls silently
      // dropped the name filter, so the check degenerated to "any active
      // routine exists" and this distinct-name import would be wrongly
      // rejected with DUPLICATE_ROUTINE_NAME.
      db.insert(routines)
        .values({ name: 'Treino A', description: 'Seed active routine', folder: 'Geral' })
        .run();

      const payload = {
        name: 'Treino B',
        exercises: [{ name: 'Supino', target: '4x10' }],
      };

      const result = await RoutineImportService.importRoutine(payload, db);

      expect(result.success).toBe(true);
      expect(result.routineName).toBe('Treino B');

      const allRoutines = db.select().from(routines).all();
      expect(allRoutines).toHaveLength(2);
      const imported = allRoutines.find((r) => r.name === 'Treino B');
      expect(imported?.isArchived).toBe(false);
      const seed = allRoutines.find((r) => r.name === 'Treino A');
      expect(seed?.isArchived).toBe(false);
    });

    it('imports a routine reusing an archived name WITH a suffix', async () => {
      // Seed an archived 'Legacy' routine; no active routine uses that name.
      // Owner decision (2026-10-06): importing a routine whose name collides ONLY
      // with an archived routine must succeed with a suffix (e.g. "Legacy (2)").
      const legacy = db
        .insert(routines)
        .values({ name: 'Legacy', folder: 'Geral' })
        .returning()
        .get();
      await db.update(routines).set({ isArchived: true }).where(eq(routines.id, legacy.id)).run();

      const payload = {
        name: 'Legacy',
        description: 'New import',
        exercises: [{ name: 'Agachamento', target: '3x12' }],
      };

      const result = await RoutineImportService.importRoutine(payload, db);

      expect(result.success).toBe(true);
      expect(result.routineName).toBe('Legacy (2)');

      // The imported routine is active under the suffixed name; the archived
      // seed remains untouched.
      const allRoutines = db.select().from(routines).all();
      expect(allRoutines.filter((r) => r.name === 'Legacy')).toHaveLength(1);
      expect(allRoutines.filter((r) => r.name === 'Legacy (2)')).toHaveLength(1);
      const imported = allRoutines.find((r) => r.name === 'Legacy (2)' && !r.isArchived);
      expect(imported).toBeDefined();
      expect(imported?.id).not.toBe(legacy.id);
    });

    it('skips past an already-suffixed archived name to the next free suffix', async () => {
      // Seed archived 'Legacy' AND archived 'Legacy (2)' — the first free suffix is 'Legacy (3)'.
      const legacy = db
        .insert(routines)
        .values({ name: 'Legacy', folder: 'Geral' })
        .returning()
        .get();
      const legacy2 = db
        .insert(routines)
        .values({ name: 'Legacy (2)', folder: 'Geral' })
        .returning()
        .get();
      await db.update(routines).set({ isArchived: true }).where(eq(routines.id, legacy.id)).run();
      await db.update(routines).set({ isArchived: true }).where(eq(routines.id, legacy2.id)).run();

      const payload = {
        name: 'Legacy',
        description: 'New import',
        exercises: [{ name: 'Agachamento', target: '3x12' }],
      };

      const result = await RoutineImportService.importRoutine(payload, db);

      expect(result.success).toBe(true);
      expect(result.routineName).toBe('Legacy (3)');

      const allRoutines = db.select().from(routines).all();
      expect(allRoutines.filter((r) => r.name === 'Legacy')).toHaveLength(1);
      expect(allRoutines.filter((r) => r.name === 'Legacy (2)')).toHaveLength(1);
      expect(allRoutines.filter((r) => r.name === 'Legacy (3)')).toHaveLength(1);
      const imported = allRoutines.find((r) => r.name === 'Legacy (3)' && !r.isArchived);
      expect(imported).toBeDefined();
      expect(imported?.id).not.toBe(legacy.id);
      expect(imported?.id).not.toBe(legacy2.id);
    });

    it('still rejects an active duplicate with DUPLICATE_ROUTINE_NAME regardless of archived "Legacy (2)"', async () => {
      // An active 'Legacy' blocks the import outright even if 'Legacy (2)' exists
      // archived — the active collision takes precedence over suffixing.
      const active = db
        .insert(routines)
        .values({ name: 'Legacy', description: 'Original', folder: 'Geral' })
        .returning()
        .get();
      const archivedSuffix = db
        .insert(routines)
        .values({ name: 'Legacy (2)', folder: 'Geral' })
        .returning()
        .get();
      await db
        .update(routines)
        .set({ isArchived: true })
        .where(eq(routines.id, archivedSuffix.id))
        .run();

      const payload = {
        name: 'Legacy',
        description: 'Conflicting import',
        exercises: [{ name: 'Supino', target: '4x10' }],
      };

      await expect(RoutineImportService.importRoutine(payload, db)).rejects.toMatchObject({
        code: 'DUPLICATE_ROUTINE_NAME',
      });

      // Original active routine untouched, no new routine row, no exercise links.
      const routinesInDb = db.select().from(routines).all();
      expect(routinesInDb).toHaveLength(2);
      expect(routinesInDb[0].id).toBe(active.id);
      expect(routinesInDb[0].description).toBe('Original');
      expect(db.select().from(routineExercises).all()).toHaveLength(0);
    });

    it('still rejects an active duplicate with DUPLICATE_ROUTINE_NAME', async () => {
      const active = db
        .insert(routines)
        .values({ name: 'Treino A', description: 'Original', folder: 'Geral' })
        .returning()
        .get();

      const payload = {
        name: 'Treino A',
        description: 'Conflicting import',
        exercises: [{ name: 'Supino', target: '4x10' }],
      };

      await expect(RoutineImportService.importRoutine(payload, db)).rejects.toMatchObject({
        code: 'DUPLICATE_ROUTINE_NAME',
      });

      // Original routine untouched, no new routine row, no exercise links.
      const routinesInDb = db.select().from(routines).all();
      expect(routinesInDb).toHaveLength(1);
      expect(routinesInDb[0].id).toBe(active.id);
      expect(routinesInDb[0].description).toBe('Original');
      expect(db.select().from(routineExercises).all()).toHaveLength(0);
    });
  });
});
