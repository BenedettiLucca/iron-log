import { db, sqlite } from '../fixtures/database';
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
  sessions,
  sets,
} from '@/src/db/schema';
import {
  ScheduleManifestService,
  ScheduleManifest,
} from '@/services/ScheduleManifestService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-documents/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('ScheduleManifestService', () => {
  beforeEach(() => {
    sqlite.exec(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM sets;
      DELETE FROM sessions;
      DELETE FROM program_exercise_targets;
      DELETE FROM program_weeks;
      DELETE FROM programs;
      DELETE FROM routine_exercises;
      DELETE FROM routines;
      DELETE FROM exercises;
      DELETE FROM folders;
      DELETE FROM notification_settings;
      DELETE FROM user_settings;
      DELETE FROM sqlite_sequence;
      PRAGMA foreign_keys = ON;
    `);
    jest.clearAllMocks();
  });

  it('builds a valid manifest from empty DB state', async () => {
    const manifest = await ScheduleManifestService.buildManifest();

    expect(manifest).toBeDefined();
    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.folders).toEqual([]);
    expect(manifest.routines).toEqual([]);
    expect(manifest.activeProgram).toBeNull();
    expect(manifest.settings).toEqual({
      notifications: null,
      user: null,
    });
  });

  it('seeds routines, folders and exercises and builds structured manifest', async () => {
    // 1. Folders (insert out of id order to test deterministic sorting)
    db.insert(folders).values({ id: 2, name: 'Pernas' }).run();
    db.insert(folders).values({ id: 1, name: 'Superiores' }).run();

    // 2. Exercises
    db.insert(exercises).values({ id: 1, name: 'Supino Reto', type: 'strength', defaultRestSeconds: 120 }).run();
    db.insert(exercises).values({ id: 2, name: 'Crucifixo Inclinado', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(exercises).values({ id: 3, name: 'Prancha', type: 'duration', defaultRestSeconds: 60 }).run();

    // 3. Routines
    db.insert(routines).values({
      id: 10,
      name: 'Treino A - Peito e Abdômen',
      folder: 'Superiores',
      description: 'Foco em peitoral maior',
      isTemplate: true,
    }).run();

    // Insert routine exercises out of orderIndex order
    db.insert(routineExercises).values({
      id: 102,
      routineId: 10,
      exerciseId: 2,
      orderIndex: 1,
      target: '3x10-12',
      notes: 'Halteres de 20kg',
      restSeconds: 90,
    }).run();

    db.insert(routineExercises).values({
      id: 101,
      routineId: 10,
      exerciseId: 1,
      orderIndex: 0,
      target: '4x6-8',
      notes: 'Barra olímpica',
      restSeconds: 120,
    }).run();

    db.insert(routineExercises).values({
      id: 103,
      routineId: 10,
      exerciseId: 3,
      orderIndex: 2,
      target: '3x60s',
      notes: null,
      restSeconds: null, // should fall back to exercise defaultRestSeconds (60)
    }).run();

    const manifest = await ScheduleManifestService.buildManifest();

    expect(manifest.folders).toEqual([
      { id: 1, name: 'Superiores' },
      { id: 2, name: 'Pernas' },
    ]);

    expect(manifest.routines).toHaveLength(1);
    const r = manifest.routines[0];
    expect(r.id).toBe(10);
    expect(r.name).toBe('Treino A - Peito e Abdômen');
    expect(r.folder).toBe('Superiores');
    expect(r.description).toBe('Foco em peitoral maior');
    expect(r.isTemplate).toBe(true);

    // Assert routine exercises are sorted by orderIndex
    expect(r.exercises).toHaveLength(3);
    expect(r.exercises[0]).toEqual({
      id: 101,
      exerciseId: 1,
      name: 'Supino Reto',
      type: 'strength',
      orderIndex: 0,
      target: '4x6-8',
      notes: 'Barra olímpica',
      restSeconds: 120,
    });
    expect(r.exercises[1]).toEqual({
      id: 102,
      exerciseId: 2,
      name: 'Crucifixo Inclinado',
      type: 'strength',
      orderIndex: 1,
      target: '3x10-12',
      notes: 'Halteres de 20kg',
      restSeconds: 90,
    });
    expect(r.exercises[2]).toEqual({
      id: 103,
      exerciseId: 3,
      name: 'Prancha',
      type: 'duration',
      orderIndex: 2,
      target: '3x60s',
      notes: null,
      restSeconds: 60,
    });
  });

  it('includes active program state, current week, and periodization weeks/targets', async () => {
    db.insert(routines).values({ id: 1, name: 'Upper A', folder: 'Geral', isTemplate: false }).run();
    db.insert(routines).values({ id: 2, name: 'Lower A', folder: 'Geral', isTemplate: false }).run();
    db.insert(exercises).values({ id: 10, name: 'Agachamento', type: 'strength', defaultRestSeconds: 180 }).run();

    const startTime = new Date('2026-03-01T00:00:00.000Z').getTime();
    const endTime = new Date('2026-04-26T00:00:00.000Z').getTime();
    const createdTime = new Date('2026-02-28T12:00:00.000Z').getTime();

    // Active program (8 weeks, deload on week 4)
    db.insert(programs).values({
      id: 5,
      name: 'Hipertrofia 8 Semanas',
      description: 'Periodização ondulatória',
      startDate: startTime,
      endDate: endTime,
      weeksDuration: 8,
      deloadWeek: 4,
      goal: 'hypertrophy',
      isActive: true,
      createdAt: createdTime,
    }).run();

    // Inactive program (should be ignored)
    db.insert(programs).values({
      id: 1,
      name: 'Programa Antigo',
      startDate: startTime - 10000000,
      endDate: startTime - 1000,
      weeksDuration: 4,
      goal: 'strength',
      isActive: false,
    }).run();

    // Program weeks
    db.insert(programWeeks).values({
      id: 52,
      programId: 5,
      weekNumber: 2,
      routineId: 2,
      phase: 'accumulation',
      rirTarget: 2,
      intensityMod: 1.0,
    }).run();

    db.insert(programWeeks).values({
      id: 51,
      programId: 5,
      weekNumber: 1,
      routineId: 1,
      phase: 'accumulation',
      rirTarget: 3,
      intensityMod: 0.95,
    }).run();

    // Program targets
    db.insert(programExerciseTargets).values({
      id: 501,
      programId: 5,
      exerciseId: 10,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetSets: 4,
    }).run();

    // Test with now = week 2 (10 days after start date)
    const mockNow = startTime + 10 * 24 * 60 * 60 * 1000;
    const manifest = await ScheduleManifestService.buildManifest({ now: mockNow });

    expect(manifest.activeProgram).not.toBeNull();
    const ap = manifest.activeProgram!;
    expect(ap.id).toBe(5);
    expect(ap.name).toBe('Hipertrofia 8 Semanas');
    expect(ap.startDate).toBe('2026-03-01T00:00:00.000Z');
    expect(ap.endDate).toBe('2026-04-26T00:00:00.000Z');
    expect(ap.createdAt).toBe('2026-02-28T12:00:00.000Z');
    expect(ap.currentWeek).toBe(2);
    expect(ap.currentPhase).toBe('accumulation');
    expect(ap.weeksDuration).toBe(8);
    expect(ap.deloadWeek).toBe(4);

    // Weeks sorted by weekNumber
    expect(ap.weeks).toHaveLength(2);
    expect(ap.weeks[0]).toEqual({
      id: 51,
      weekNumber: 1,
      routineId: 1,
      routineName: 'Upper A',
      phase: 'accumulation',
      rirTarget: 3,
      intensityMod: 0.95,
    });
    expect(ap.weeks[1]).toEqual({
      id: 52,
      weekNumber: 2,
      routineId: 2,
      routineName: 'Lower A',
      phase: 'accumulation',
      rirTarget: 2,
      intensityMod: 1.0,
    });

    // Exercise targets
    expect(ap.targets).toEqual([
      {
        id: 501,
        exerciseId: 10,
        exerciseName: 'Agachamento',
        targetRepsMin: 6,
        targetRepsMax: 8,
        targetSets: 4,
      },
    ]);
  });

  it('includes notification and user settings', async () => {
    const notifDate = new Date('2026-03-15T09:00:00.000Z').getTime();
    db.insert(notificationSettings).values({
      id: 1,
      checkinDay: 1,
      checkinHour: 9,
      enabled: true,
      lastNotificationDate: notifDate,
    }).run();

    db.insert(userSettings).values({
      id: 1,
      defaultWeight: 78.5,
      height: 178,
      sex: 'M',
    }).run();

    const manifest = await ScheduleManifestService.buildManifest();

    expect(manifest.settings).toEqual({
      notifications: {
        checkinDay: 1,
        checkinHour: 9,
        enabled: true,
        lastNotificationDate: '2026-03-15T09:00:00.000Z',
      },
      user: {
        defaultWeight: 78.5,
        height: 178,
        sex: 'M',
      },
    });
  });

  it('produces strictly deterministic output (deep equal and string equal across builds)', async () => {
    // Seed multi-entity database
    db.insert(folders).values({ id: 1, name: 'A' }).run();
    db.insert(folders).values({ id: 2, name: 'B' }).run();
    db.insert(exercises).values({ id: 1, name: 'Ex 1', type: 'strength', defaultRestSeconds: 60 }).run();
    db.insert(exercises).values({ id: 2, name: 'Ex 2', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(routines).values({ id: 1, name: 'Routine 1', folder: 'A', isTemplate: false }).run();
    db.insert(routineExercises).values({ id: 1, routineId: 1, exerciseId: 1, orderIndex: 0 }).run();
    db.insert(routineExercises).values({ id: 2, routineId: 1, exerciseId: 2, orderIndex: 1 }).run();

    const fixedTime = new Date('2026-03-20T12:00:00.000Z').getTime();

    const build1: ScheduleManifest = await ScheduleManifestService.buildManifest({ now: fixedTime });
    const build2: ScheduleManifest = await ScheduleManifestService.buildManifest({ now: fixedTime });

    expect(build1).toEqual(build2);

    const json1 = await ScheduleManifestService.exportManifestJson({ now: fixedTime });
    const json2 = await ScheduleManifestService.exportManifestJson({ now: fixedTime });

    expect(json1).toBe(json2);

    // Verify key ordering
    const parsedKeys = Object.keys(JSON.parse(json1));
    expect(parsedKeys).toEqual(['manifestVersion', 'folders', 'routines', 'activeProgram', 'settings']);
  });

  it('ensures soft-deleted content (sessions and sets) is excluded and does not pollute the schedule manifest', async () => {
    db.insert(exercises).values({ id: 1, name: 'Bench Press', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(routines).values({ id: 1, name: 'Chest Day', folder: 'Geral', isTemplate: true }).run();
    db.insert(routineExercises).values({ id: 1, routineId: 1, exerciseId: 1, orderIndex: 0 }).run();

    // Add active and soft-deleted sessions/sets
    db.insert(sessions).values({
      id: 100,
      routineId: 1,
      routineName: 'Chest Day',
      startTime: 1000,
      endTime: 2000,
      deletedAt: null,
    }).run();

    db.insert(sessions).values({
      id: 101,
      routineId: 1,
      routineName: 'Chest Day (Deleted)',
      startTime: 1000,
      endTime: 2000,
      deletedAt: Date.now(), // Soft-deleted
    }).run();

    db.insert(sets).values({
      id: 200,
      sessionId: 100,
      exerciseId: 1,
      setNumber: 1,
      weightKg: 100,
      reps: 8,
      deletedAt: null,
    }).run();

    db.insert(sets).values({
      id: 201,
      sessionId: 100,
      exerciseId: 1,
      setNumber: 2,
      weightKg: 100,
      reps: 8,
      deletedAt: Date.now(), // Soft-deleted
    }).run();

    const manifest = await ScheduleManifestService.buildManifest();

    // Manifest contains purely active schedule structure
    expect(manifest.routines).toHaveLength(1);
    expect(manifest.routines[0].id).toBe(1);
    expect(manifest.routines[0].name).toBe('Chest Day');

    // Confirm neither soft-deleted session nor soft-deleted set alters the manifest shape
    const json = JSON.stringify(manifest);
    expect(json).not.toContain('Chest Day (Deleted)');
  });

  it('saves manifest to FileSystem.documentDirectory and supports sharing', async () => {
    const savePath = await ScheduleManifestService.saveManifest();
    expect(savePath).toBe('file:///mock-documents/schedule_manifest.json');
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-documents/schedule_manifest.json',
      expect.any(String),
      { encoding: 'utf8' }
    );

    const sharePath = await ScheduleManifestService.exportAndShare();
    expect(sharePath).toBe('file:///mock-documents/schedule_manifest.json');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///mock-documents/schedule_manifest.json',
      expect.objectContaining({
        mimeType: 'application/json',
        UTI: 'public.json',
      })
    );
  });
});
