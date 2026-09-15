import { db, sqlite } from '../fixtures/database';
import { exercises, routines, routineExercises } from '@/src/db/schema';
import {
  RoutineShareService,
  exportRoutine,
  exportRoutineJson,
  importRoutine,
  type RoutineSharePayload,
} from '@/services/RoutineShareService';
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

describe('RoutineShareService', () => {
  describe('exportRoutine', () => {
    it('exports a seeded routine into a versioned payload with full exercise graph', async () => {
      // Seed exercise definitions
      const bench = db
        .insert(exercises)
        .values({
          name: 'Supino Reto',
          type: 'strength',
          muscleGroup: 'Peito',
          defaultRestSeconds: 120,
        })
        .returning()
        .get();

      const plank = db
        .insert(exercises)
        .values({
          name: 'Prancha Frontal',
          type: 'duration',
          muscleGroup: 'Core',
          defaultRestSeconds: 60,
        })
        .returning()
        .get();

      // Seed routine
      const routineRow = db
        .insert(routines)
        .values({
          name: 'Treino A (Push)',
          description: 'Foco no peito e triceps',
          folder: 'Hipertrofia',
          isTemplate: false,
        })
        .returning()
        .get();

      // Seed routine exercises with targets, notes, rest seconds, orderIndex
      db.insert(routineExercises)
        .values([
          {
            routineId: routineRow.id,
            exerciseId: bench.id,
            orderIndex: 1,
            target: '4x8-10',
            notes: 'Pausa de 1s embaixo',
            restSeconds: 120,
          },
          {
            routineId: routineRow.id,
            exerciseId: plank.id,
            orderIndex: 2,
            target: '3x60s',
            notes: 'Contrair abdomen',
            restSeconds: 60,
          },
        ])
        .run();

      const payload = await exportRoutine(routineRow.id, db);

      expect(payload).toEqual({
        version: 1,
        name: 'Treino A (Push)',
        description: 'Foco no peito e triceps',
        folder: 'Hipertrofia',
        exercises: [
          {
            orderIndex: 1,
            name: 'Supino Reto',
            target: '4x8-10',
            notes: 'Pausa de 1s embaixo',
            restSeconds: 120,
            type: 'strength',
            muscleGroup: 'Peito',
          },
          {
            orderIndex: 2,
            name: 'Prancha Frontal',
            target: '3x60s',
            notes: 'Contrair abdomen',
            restSeconds: 60,
            type: 'duration',
            muscleGroup: 'Core',
          },
        ],
      });
    });

    it('throws when exporting a non-existent routine ID', async () => {
      await expect(exportRoutine(999, db)).rejects.toThrow(/not found/i);
    });

    it('exportRoutineJson serializes to valid JSON string matching exportRoutine', async () => {
      const ex = db
        .insert(exercises)
        .values({ name: 'Agachamento Livre', type: 'strength' })
        .returning()
        .get();

      const routine = db
        .insert(routines)
        .values({ name: 'Leg Day', description: 'Pernas pesadas' })
        .returning()
        .get();

      db.insert(routineExercises)
        .values({
          routineId: routine.id,
          exerciseId: ex.id,
          orderIndex: 1,
          target: '5x5',
        })
        .run();

      const json = await exportRoutineJson(routine.id, db);
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.name).toBe('Leg Day');
      expect(parsed.exercises).toHaveLength(1);
      expect(parsed.exercises[0].name).toBe('Agachamento Livre');
    });
  });

  describe('importRoutine (non-destructive merge and name suffixing)', () => {
    it('imports as a new routine when no routine with the same name exists', async () => {
      const payload: RoutineSharePayload = {
        version: 1,
        name: 'Upper Hypertrophy',
        description: 'Upper body focus',
        folder: 'Upper/Lower',
        exercises: [
          {
            name: 'Supino Inclinado',
            orderIndex: 1,
            target: '3x10',
            notes: 'Halteres de 30kg',
            restSeconds: 90,
            type: 'strength',
          },
        ],
      };

      const result = await importRoutine(payload, db);

      expect(result.success).toBe(true);
      expect(result.name).toBe('Upper Hypertrophy');
      expect(result.exercisesCount).toBe(1);
      expect(result.customExercisesCreated).toBe(1);

      const dbRoutines = db.select().from(routines).all();
      expect(dbRoutines).toHaveLength(1);
      expect(dbRoutines[0].name).toBe('Upper Hypertrophy');
      expect(dbRoutines[0].description).toBe('Upper body focus');

      const dbRoutineExercises = db.select().from(routineExercises).all();
      expect(dbRoutineExercises).toHaveLength(1);
      expect(dbRoutineExercises[0].routineId).toBe(result.id);
      expect(dbRoutineExercises[0].target).toBe('3x10');
    });

    it('suffixes the routine name (e.g. "Treino A (2)") without overwriting or deleting existing routines', async () => {
      // Seed existing routine with same name
      const originalRoutine = db
        .insert(routines)
        .values({
          name: 'Treino A',
          description: 'Original routine',
          folder: 'Geral',
        })
        .returning()
        .get();

      const payload: RoutineSharePayload = {
        version: 1,
        name: 'Treino A',
        description: 'Imported routine',
        folder: 'Geral',
        exercises: [],
      };

      const result = await importRoutine(payload, db);

      expect(result.success).toBe(true);
      expect(result.name).toBe('Treino A (2)');
      expect(result.id).not.toBe(originalRoutine.id);

      // Verify original routine is untouched
      const originalInDb = db
        .select()
        .from(routines)
        .where(eq(routines.id, originalRoutine.id))
        .get();
      expect(originalInDb?.name).toBe('Treino A');
      expect(originalInDb?.description).toBe('Original routine');

      // Verify all routines in DB
      const allRoutines = db.select().from(routines).all();
      expect(allRoutines).toHaveLength(2);
      expect(allRoutines.map((r) => r.name).sort()).toEqual(['Treino A', 'Treino A (2)']);
    });

    it('increments suffix counter when "(2)" already exists', async () => {
      db.insert(routines)
        .values([
          { name: 'Full Body' },
          { name: 'Full Body (2)' },
        ])
        .run();

      const payload: RoutineSharePayload = {
        version: 1,
        name: 'Full Body',
        exercises: [],
      };

      const result = await importRoutine(payload, db);

      expect(result.name).toBe('Full Body (3)');
      const allRoutines = db.select().from(routines).all();
      expect(allRoutines).toHaveLength(3);
    });
  });

  describe('importRoutine (exercise mapping and custom exercises)', () => {
    it('creates custom exercises dynamically for unrecognized exercise names', async () => {
      const payload: RoutineSharePayload = {
        version: 1,
        name: 'Custom Workout',
        exercises: [
          {
            name: 'Kettlebell Windmill',
            type: 'strength',
            muscleGroup: 'Core',
            target: '3x8',
            restSeconds: 60,
          },
          {
            name: 'Farmer Walk Timed',
            type: 'duration',
            muscleGroup: 'Grip',
            target: '3x45s',
            restSeconds: 90,
          },
        ],
      };

      const result = await importRoutine(payload, db);

      expect(result.customExercisesCreated).toBe(2);

      const allExercises = db.select().from(exercises).all();
      expect(allExercises).toHaveLength(2);

      const windmill = allExercises.find((e) => e.name === 'Kettlebell Windmill');
      expect(windmill).toBeDefined();
      expect(windmill?.type).toBe('strength');
      expect(windmill?.muscleGroup).toBe('Core');

      const farmer = allExercises.find((e) => e.name === 'Farmer Walk Timed');
      expect(farmer).toBeDefined();
      expect(farmer?.type).toBe('duration');
    });

    it('reuses existing exercises case-insensitively and accent-insensitively without creating duplicates', async () => {
      // Seed pre-existing exercise with accents
      const existingEx = db
        .insert(exercises)
        .values({
          name: 'Elevação Lateral',
          type: 'strength',
          defaultRestSeconds: 90,
        })
        .returning()
        .get();

      // Payload references the same exercise in lowercase without accents
      const payload = {
        version: 1,
        name: 'Delts Day',
        exercises: [
          {
            name: '  elevacao lateral  ',
            target: '4x15',
            notes: 'Drop set na última',
            rest: 60,
          },
        ],
      };

      const result = await importRoutine(payload, db);

      expect(result.customExercisesCreated).toBe(0);

      // Verify no duplicate exercise created
      const allExercises = db.select().from(exercises).all();
      expect(allExercises).toHaveLength(1);
      expect(allExercises[0].id).toBe(existingEx.id);

      // Verify routineExercises references existing exercise id
      const re = db.select().from(routineExercises).where(eq(routineExercises.routineId, result.id)).get();
      expect(re?.exerciseId).toBe(existingEx.id);
      expect(re?.restSeconds).toBe(60);
      expect(re?.target).toBe('4x15');
    });

    it('accepts JSON string as input payload', async () => {
      const jsonString = JSON.stringify({
        version: 1,
        name: 'Clipboard Workout',
        description: 'Imported from string',
        exercises: [
          {
            name: 'Triceps Corda',
            target: '3x12',
            restSeconds: 60,
          },
        ],
      });

      const result = await RoutineShareService.importRoutine(jsonString, db);

      expect(result.success).toBe(true);
      expect(result.name).toBe('Clipboard Workout');
      expect(result.exercisesCount).toBe(1);
    });
  });

  describe('importRoutine (pre-write validation)', () => {
    it('rejects invalid payload before any DB write and leaves database untouched', async () => {
      // 1. Missing name
      await expect(
        importRoutine(
          {
            version: 1,
            name: '',
            exercises: [],
          },
          db
        )
      ).rejects.toThrow();

      // 2. Unsupported version
      await expect(
        importRoutine(
          {
            version: 2,
            name: 'Future Version Routine',
            exercises: [],
          },
          db
        )
      ).rejects.toThrow();

      // 3. Invalid exercise structure (missing exercise name)
      await expect(
        importRoutine(
          {
            version: 1,
            name: 'Broken Routine',
            exercises: [{ target: '3x10' }],
          },
          db
        )
      ).rejects.toThrow();

      // 4. Malformed JSON string
      await expect(importRoutine('{ invalid json ...', db)).rejects.toThrow(/invalid json/i);

      // Verify database remains completely empty
      const routinesCount = db.select().from(routines).all();
      const exercisesCount = db.select().from(exercises).all();
      const routineExercisesCount = db.select().from(routineExercises).all();

      expect(routinesCount).toHaveLength(0);
      expect(exercisesCount).toHaveLength(0);
      expect(routineExercisesCount).toHaveLength(0);
    });
  });
});
