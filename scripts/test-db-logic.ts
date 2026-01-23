import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';

// --- SCHEMA (Copied from src/db/schema.ts) ---
export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  folder: text('folder').default('Geral'),
});

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull().default('strength'),
  defaultRestSeconds: integer('default_rest_seconds').default(90),
});

export const routineExercises = sqliteTable('routine_exercises', {
  routineId: integer('routine_id').references(() => routines.id),
  exerciseId: integer('exercise_id').references(() => exercises.id),
  orderIndex: integer('order_index'),
  target: text('target'),
  notes: text('notes'),
  restSeconds: integer('rest_seconds'),
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').references(() => routines.id),
  routineName: text('routine_name'),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time'),
  bodyWeight: real('body_weight'),
  sRpe: integer('s_rpe'),
  notes: text('notes'),
  durationMinutes: integer('duration_minutes'),
});

// --- TEST SETUP ---
const sqlite = new Database('test.db');
const db = drizzle(sqlite);

async function main() {
  console.log("--- Starting DB Logic Test ---");

  // 1. Create Tables (Simulating Migrations)
  console.log("Creating tables...");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS routines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, folder TEXT DEFAULT 'Geral');
    CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'strength', default_rest_seconds INTEGER DEFAULT 90);
    CREATE TABLE IF NOT EXISTS routine_exercises (routine_id INTEGER, exercise_id INTEGER, order_index INTEGER, target TEXT, notes TEXT, rest_seconds INTEGER);
    CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id INTEGER, routine_name TEXT, start_time INTEGER NOT NULL, end_time INTEGER, body_weight REAL, s_rpe INTEGER, notes TEXT, duration_minutes INTEGER);
  `);

  // 2. Create Routine (Simulating Editor)
  console.log("Creating routine...");
  const routineName = "Test Routine " + Date.now();
  await db.insert(routines).values({ name: routineName, description: "Test Desc", folder: "Geral" });
  
  const routineRes = await db.select().from(routines).where(eq(routines.name, routineName));
  const routineId = routineRes[0].id;
  console.log("Routine created with ID:", routineId);

  // 3. Start Session (The Crashing Part)
  console.log("Starting session...");
  const now = Date.now();
  
  await db.insert(sessions).values({
    routineId: routineId,
    routineName: routineName,
    startTime: now,
    bodyWeight: 0,
    sRpe: 0,
  });

  const sessionRes = await db.select().from(sessions).where(eq(sessions.startTime, now));
  
  if (sessionRes.length > 0) {
      console.log("Session started successfully. ID:", sessionRes[0].id);
  } else {
      console.error("FAILED to retrieve session!");
      process.exit(1);
  }

  // 4. Test Routine Query (useLiveQuery logic)
  console.log("Querying routine exercises...");
  // Insert some dummy exercises first
  const ex1 = await db.insert(exercises).values({ name: "Ex 1" }).returning();
  await db.insert(routineExercises).values({ routineId, exerciseId: ex1[0].id, orderIndex: 1 });

  const routineExs = await db.select({
      id: exercises.id,
      name: exercises.name,
      order: routineExercises.orderIndex,
      target: routineExercises.target,
      notes: routineExercises.notes,
      restSeconds: routineExercises.restSeconds
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
    .where(eq(routineExercises.routineId, routineId))
    .orderBy(routineExercises.orderIndex);
    
  console.log("Fetched exercises:", routineExs.length);

  console.log("--- TEST PASSED ---");
}

main().catch(e => {
    console.error("TEST FAILED:", e);
    process.exit(1);
});
