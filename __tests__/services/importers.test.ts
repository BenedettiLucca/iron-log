import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets } from '@/src/db/schema';
import {
  detectTracker,
  FitNotesImporter,
  HevyImporter,
  parseCsv,
  StrongImporter,
  TrackerImportService,
} from '@/services/importers';
import { eq } from 'drizzle-orm';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

// Mock expo-document-picker and expo-file-system for TrackerImportService file tests
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8' },
}));
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

beforeEach(() => {
  sqlite.exec('DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;');
});

afterAll(() => {
  sqlite.close();
});

describe('CSV Parser and Detector', () => {
  it('parses CSV with quotes, escaped quotes, and commas correctly', () => {
    const csv = `Date,Workout Name,Notes\n"2023-05-10 18:00:00","Leg Day, Heavy","Felt ""great"" today"`;
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(['Date', 'Workout Name', 'Notes']);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Workout Name']).toBe('Leg Day, Heavy');
    expect(rows[0]['Notes']).toBe('Felt "great" today');
  });

  it('detects Strong, Hevy, and FitNotes headers properly', () => {
    const strongHeader = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';
    const hevyHeader = 'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';
    const fitNotesHeader = 'Date,Exercise,Category,Weight (kgs),Reps,Distance,Distance Unit,Time,Comment';

    expect(detectTracker(strongHeader)).toBe('strong');
    expect(detectTracker(hevyHeader)).toBe('hevy');
    expect(detectTracker(fitNotesHeader)).toBe('fitnotes');
    expect(detectTracker('random,columns,here')).toBeNull();
  });
});

describe('StrongImporter', () => {
  const strongCsvFixture = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-01-10 18:00:00","Chest & Core","45m","Bench Press (Barbell)",1,80,10,0,0,"First set","Felt strong",8
"2024-01-10 18:00:00","Chest & Core","45m","Bench Press (Barbell)",2,85,8,0,0,"",,8.5
"2024-01-10 18:00:00","Chest & Core","45m","Bench Press (Barbell)",3,90,5,0,0,"Heavy",,9
"2024-01-10 18:00:00","Chest & Core","45m","Custom Cable Fly",1,15,12,0,0,"Unknown exercise",,7.5
"2024-01-10 18:00:00","Chest & Core","45m","Plank",1,0,0,0,60,"Core isometric",,
"2024-01-12 10:00:00","Leg Day","1h 10m","Squat (Barbell)",1,100,5,0,0,"",,9`;

  it('imports sessions, sets, custom exercises and duration sets faithfully', () => {
    // Seed an existing exercise
    db.insert(exercises).values({ id: 1, name: 'Bench Press (Barbell)', type: 'strength', defaultRestSeconds: 90 }).run();

    const result = StrongImporter.importCsv(strongCsvFixture, db);

    expect(result.success).toBe(true);
    expect(result.sessionsCreated).toBe(2);
    expect(result.setsImported).toBe(6);
    expect(result.customExercisesCreated).toBe(3); // Custom Cable Fly, Plank, Squat (Barbell)

    const allSessions = db.select().from(sessions).all();
    expect(allSessions).toHaveLength(2);
    expect(allSessions[0].routineName).toBe('Chest & Core');
    expect(allSessions[0].durationMinutes).toBe(45);

    const allSets = db.select().from(sets).all();
    expect(allSets).toHaveLength(6);

    // Verify duration set
    const plankSet = allSets.find((s) => s.exerciseName === 'Plank');
    expect(plankSet).toBeDefined();
    expect(plankSet?.durationSeconds).toBe(60);

    // Verify custom exercise created in exercises table
    const customEx = db.select().from(exercises).where(eq(exercises.name, 'Custom Cable Fly')).get();
    expect(customEx).toBeDefined();
    expect(customEx?.name).toBe('Custom Cable Fly');
  });

  it('enforces idempotency: importing the same file twice does not duplicate sessions', () => {
    const res1 = StrongImporter.importCsv(strongCsvFixture, db);
    expect(res1.sessionsCreated).toBe(2);
    expect(res1.setsImported).toBe(6);

    const res2 = StrongImporter.importCsv(strongCsvFixture, db);
    expect(res2.sessionsCreated).toBe(0);
    expect(res2.skippedSessions).toBe(2);
    expect(res2.setsImported).toBe(0);

    const allSessions = db.select().from(sessions).all();
    expect(allSessions).toHaveLength(2);
    const allSets = db.select().from(sets).all();
    expect(allSets).toHaveLength(6);
  });

  it('converts Strong lbs to kg when Weight (lbs) is in header', () => {
    const strongLbsFixture = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight (lbs),Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-01-15 18:00:00","Chest Day","45m","Bench Press (Barbell)",1,100,10,0,0,"",,8`;

    const result = StrongImporter.importCsv(strongLbsFixture, db);
    expect(result.success).toBe(true);

    const setRow = db.select().from(sets).where(eq(sets.exerciseName, 'Bench Press (Barbell)')).get();
    expect(setRow?.weightKg).toBeCloseTo(45.36, 1);
  });

  it('converts Strong lbs to kg when Weight Unit column specifies lbs', () => {
    const strongUnitFixture = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Weight Unit,Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-01-16 18:00:00","Chest Day","45m","Bench Press (Barbell)",1,100,lbs,10,0,0,"",,8`;

    const result = StrongImporter.importCsv(strongUnitFixture, db);
    expect(result.success).toBe(true);

    const setRow = db.select().from(sets).where(eq(sets.exerciseName, 'Bench Press (Barbell)')).get();
    expect(setRow?.weightKg).toBeCloseTo(45.36, 1);
  });

  it('preserves Strong kg when Weight (kg) or Weight Unit kg is specified', () => {
    const strongKgFixture = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight (kg),Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-01-17 18:00:00","Chest Day","45m","Bench Press (Barbell)",1,80,10,0,0,"",,8`;

    const result = StrongImporter.importCsv(strongKgFixture, db);
    expect(result.success).toBe(true);

    const setRow = db.select().from(sets).where(eq(sets.exerciseName, 'Bench Press (Barbell)')).get();
    expect(setRow?.weightKg).toBe(80);
  });
});

describe('HevyImporter', () => {
  const hevyCsvFixture = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
"Push Day","15 Feb 2024, 09:00","15 Feb 2024, 10:00","Great push session","Incline Dumbbell Press",,"Warmup set",0,"warmup",20,12,,0,6
"Push Day","15 Feb 2024, 09:00","15 Feb 2024, 10:00","Great push session","Incline Dumbbell Press",,"Working set",1,"normal",32,8,,0,9
"Push Day","15 Feb 2024, 09:00","15 Feb 2024, 10:00","Great push session","Hevy Secret Lift",,,0,"normal",45,10,,0,8
"Push Day","15 Feb 2024, 09:00","15 Feb 2024, 10:00","Great push session","Timed Plank",,,0,"normal",0,0,,45,
"Pull Day","16 Feb 2024, 18:00","16 Feb 2024, 19:15","Evening pull","Barbell Row",,,0,"normal",70,8,,0,8`;

  it('imports Hevy workouts mapping warmup, RPE->RIR, duration sets and custom exercises', () => {
    const result = HevyImporter.importCsv(hevyCsvFixture, db);

    expect(result.success).toBe(true);
    expect(result.sessionsCreated).toBe(2);
    expect(result.setsImported).toBe(5);
    expect(result.customExercisesCreated).toBe(4); // Incline Dumbbell Press, Hevy Secret Lift, Timed Plank, Barbell Row

    const allSets = db.select().from(sets).all();
    expect(allSets).toHaveLength(5);

    // Warmup verification
    const warmupSet = allSets.find((s) => s.weightKg === 20 && s.reps === 12);
    expect(warmupSet?.isWarmup).toBe(true);

    // RPE to RIR verification (RPE 9 -> RIR 1)
    const workingSet = allSets.find((s) => s.weightKg === 32);
    expect(workingSet?.rir).toBe(1);

    // Duration verification
    const plankSet = allSets.find((s) => s.exerciseName === 'Timed Plank');
    expect(plankSet?.durationSeconds).toBe(45);
  });

  it('enforces idempotency on re-import', () => {
    HevyImporter.importCsv(hevyCsvFixture, db);
    const retryResult = HevyImporter.importCsv(hevyCsvFixture, db);

    expect(retryResult.sessionsCreated).toBe(0);
    expect(retryResult.skippedSessions).toBe(2);

    const allSessions = db.select().from(sessions).all();
    expect(allSessions).toHaveLength(2);
  });
});

describe('FitNotesImporter', () => {
  const fitNotesCsvFixture = `Date,Exercise,Category,Weight (kgs),Reps,Distance,Distance Unit,Time,Comment
"2024-03-01","Flat Barbell Bench Press","Chest",80,10,,,,"Felt smooth"
"2024-03-01","Flat Barbell Bench Press","Chest",85,8,,,,
"2024-03-01","FitNotes Special Press","Shoulders",40,10,,,,"Brand new exercise"
"2024-03-01","Static Hold","Core",0,0,,,90,"Duration hold"
"2024-03-02","Deadlift","Back",140,5,,,,`;

  it('imports FitNotes workouts with custom exercise creation and duration', () => {
    const result = FitNotesImporter.importCsv(fitNotesCsvFixture, db);

    expect(result.success).toBe(true);
    expect(result.sessionsCreated).toBe(2);
    expect(result.setsImported).toBe(5);
    expect(result.customExercisesCreated).toBe(4);

    const allSessions = db.select().from(sessions).all();
    expect(allSessions).toHaveLength(2);

    const staticHold = db.select().from(sets).where(eq(sets.exerciseName, 'Static Hold')).get();
    expect(staticHold?.durationSeconds).toBe(90);
  });

  it('converts lbs to kg when Weight (lbs) is in header', () => {
    const fitNotesLbsFixture = `Date,Exercise,Category,Weight (lbs),Reps,Distance,Distance Unit,Time,Comment
"2024-03-05","Barbell Curl","Arms",100,10,,,,`;

    const result = FitNotesImporter.importCsv(fitNotesLbsFixture, db);
    expect(result.success).toBe(true);

    const curlSet = db.select().from(sets).where(eq(sets.exerciseName, 'Barbell Curl')).get();
    expect(curlSet?.weightKg).toBeCloseTo(45.36, 1);
  });

  it('enforces idempotency on repeated import', () => {
    FitNotesImporter.importCsv(fitNotesCsvFixture, db);
    const retryResult = FitNotesImporter.importCsv(fitNotesCsvFixture, db);

    expect(retryResult.sessionsCreated).toBe(0);
    expect(retryResult.skippedSessions).toBe(2);
  });
});

describe('TrackerImportService', () => {
  it('auto-detects tracker and imports correctly via importFromCsv', () => {
    const strongCsv = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-04-01 10:00:00","Morning Lift","30m","Push Up",1,0,20,0,0,"",,`;

    const result = TrackerImportService.importFromCsv(strongCsv, undefined, db);
    expect(result.success).toBe(true);
    expect(result.tracker).toBe('strong');
    expect(result.sessionsCreated).toBe(1);
    expect(result.setsImported).toBe(1);
  });

  it('returns error when given unsupported CSV format', () => {
    const unsupportedCsv = `foo,bar,baz\n1,2,3`;
    const result = TrackerImportService.importFromCsv(unsupportedCsv, undefined, db);
    expect(result.success).toBe(false);
    expect(result.error).toBe('unsupportedFormat');
  });

  it('returns emptyFile when content is empty or only whitespace', () => {
    const resEmpty = TrackerImportService.importFromCsv('', undefined, db);
    expect(resEmpty.success).toBe(false);
    expect(resEmpty.error).toBe('emptyFile');

    const resWhitespace = TrackerImportService.importFromCsv('   \n\r\t  ', undefined, db);
    expect(resWhitespace.success).toBe(false);
    expect(resWhitespace.error).toBe('emptyFile');
  });

  describe('importFromFile', () => {
    it('returns canceled when user cancels document picker', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });
      const result = await TrackerImportService.importFromFile();
      expect(result.success).toBe(false);
      expect(result.error).toBe('canceled');
    });

    it('returns emptyFile when picked file content is empty', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///empty.csv' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('');

      const result = await TrackerImportService.importFromFile();
      expect(result.success).toBe(false);
      expect(result.error).toBe('emptyFile');
    });

    it('returns unsupportedFormat when picked file format is unrecognized', async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///unknown.csv' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('col1,col2\nval1,val2');

      const result = await TrackerImportService.importFromFile();
      expect(result.success).toBe(false);
      expect(result.error).toBe('unsupportedFormat');
    });

    it('successfully imports valid tracker CSV from file', async () => {
      const strongCsv = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-05-01 10:00:00","Morning Lift","30m","Push Up",1,0,20,0,0,"",,`;
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///strong.csv' }],
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce(strongCsv);

      const result = await TrackerImportService.importFromFile();
      expect(result.success).toBe(true);
      expect(result.tracker).toBe('strong');
      expect(result.sessionsCreated).toBe(1);
      expect(result.setsImported).toBe(1);
    });
  });
});

describe('T14 — Acceptance Criteria & Edge Cases', () => {
  it('produces physically equivalent weightKg (45.36 kg) for 100 lbs across Strong, Hevy and FitNotes', () => {
    const strongLbs = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight (lbs),Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-01-20 10:00:00","Test Lift","30m","Squat",1,100,5,0,0,"",,`;
    const hevyLbs = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_km,duration_seconds,rpe
"Test Lift","20 Jan 2024, 11:00","20 Jan 2024, 11:30","","Squat",,,0,"normal",100,5,,0,`;
    const fitNotesLbs = `Date,Exercise,Category,Weight (lbs),Reps,Distance,Distance Unit,Time,Comment
"2024-01-20","Squat","Legs",100,5,,,,`;

    StrongImporter.importCsv(strongLbs, db);
    HevyImporter.importCsv(hevyLbs, db);
    FitNotesImporter.importCsv(fitNotesLbs, db);

    const allSquatSets = db.select().from(sets).where(eq(sets.exerciseName, 'Squat')).all();
    expect(allSquatSets).toHaveLength(3);
    for (const s of allSquatSets) {
      expect(s.weightKg).toBe(45.36);
    }
  });

  it('does not fabricate endTime or duration when source does not inform conclusion', () => {
    const strongNoDuration = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-02-01 10:00:00","Morning Workout","","Push Up",1,0,20,0,0,"",,`;
    const hevyNoEndTime = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
"Morning Workout","01 Feb 2024, 10:00","","","Push Up",,,0,"normal",0,20,,0,`;
    const fitNotes = `Date,Exercise,Category,Weight (kgs),Reps,Distance,Distance Unit,Time,Comment
"2024-02-01","Push Up","Chest",0,20,,,,`;

    StrongImporter.importCsv(strongNoDuration, db);
    const strongSession = db.select().from(sessions).where(eq(sessions.routineName, 'Morning Workout')).get();
    expect(strongSession?.endTime).toBeNull();
    expect(strongSession?.durationMinutes).toBeNull();

    sqlite.exec('DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises;');

    HevyImporter.importCsv(hevyNoEndTime, db);
    const hevySession = db.select().from(sessions).where(eq(sessions.routineName, 'Morning Workout')).get();
    expect(hevySession?.endTime).toBeNull();
    expect(hevySession?.durationMinutes).toBeNull();

    sqlite.exec('DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises;');

    FitNotesImporter.importCsv(fitNotes, db);
    const fitNotesSessions = db.select().from(sessions).all();
    expect(fitNotesSessions).toHaveLength(1);
    expect(fitNotesSessions[0].endTime).toBeNull();
    expect(fitNotesSessions[0].durationMinutes).toBeNull();
  });

  it('detects and reports collisions instead of silently discarding valid sessions sharing startTime', () => {
    const collidingCsv = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-03-10 18:00:00","Chest Workout","30m","Bench Press",1,80,10,0,0,"",,
"2024-03-10 18:00:00","Cardio & Core","20m","Plank",1,0,0,0,60,"",,`;

    const res1 = StrongImporter.importCsv(collidingCsv, db);
    expect(res1.success).toBe(true);
    expect(res1.sessionsCreated).toBe(2);
    expect(res1.setsImported).toBe(2);
    expect(res1.collisionsDetected).toBe(1);

    const allSessions = db.select().from(sessions).all();
    expect(allSessions).toHaveLength(2);
    expect(allSessions.map((s) => s.routineName).sort()).toEqual(['Cardio & Core', 'Chest Workout']);

    // Re-importing the exact same colliding file is idempotent (both skipped, 0 collisions reported)
    const res2 = StrongImporter.importCsv(collidingCsv, db);
    expect(res2.success).toBe(true);
    expect(res2.sessionsCreated).toBe(0);
    expect(res2.skippedSessions).toBe(2);
    expect(res2.collisionsDetected).toBe(0);
  });

  it('does not skip import when existing session with same startTime is soft-deleted', () => {
    const timestamp = new Date('2024-04-10T18:00:00').getTime();
    db.insert(sessions).values({
      routineName: 'Old Deleted Session',
      startTime: timestamp,
      deletedAt: Date.now(),
    }).run();

    const strongCsv = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
"2024-04-10 18:00:00","Active Workout","30m","Push Up",1,0,20,0,0,"",,`;

    const result = StrongImporter.importCsv(strongCsv, db);
    expect(result.success).toBe(true);
    expect(result.sessionsCreated).toBe(1);
    expect(result.skippedSessions).toBe(0);
  });
});
