import fs from 'fs';
import path from 'path';

type SqliteStatement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

type SqliteDatabase = {
  pragma: (statement: string) => unknown;
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

const Database = jest.requireActual('better-sqlite3') as new (filename: string) => SqliteDatabase;

const drizzleDir = path.resolve(__dirname, '../../drizzle');

function createPreOccurrenceDatabase() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE routines (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      name text NOT NULL
    );
    CREATE TABLE exercises (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      name text NOT NULL
    );
    CREATE TABLE sessions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      routine_id integer,
      start_time integer NOT NULL
    );
    CREATE TABLE routine_exercises (
      routine_id integer,
      exercise_id integer,
      order_index integer,
      target text,
      notes text,
      rest_seconds integer,
      PRIMARY KEY (routine_id, exercise_id),
      FOREIGN KEY (routine_id) REFERENCES routines(id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );
    CREATE TABLE sets (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      session_id integer NOT NULL,
      exercise_id integer NOT NULL,
      exercise_name text,
      set_number integer NOT NULL,
      weight_kg real NOT NULL,
      reps integer NOT NULL,
      duration_seconds integer,
      rir integer,
      is_warmup integer DEFAULT false NOT NULL,
      is_edited integer DEFAULT false NOT NULL,
      created_at integer,
      deleted_at integer,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    INSERT INTO routines (id, name) VALUES (1, 'A/B/A');
    INSERT INTO exercises (id, name) VALUES (1, 'Supino'), (2, 'Remada');
    INSERT INTO sessions (id, routine_id, start_time) VALUES (1, 1, 1000);
    INSERT INTO routine_exercises
      (routine_id, exercise_id, order_index, target, notes, rest_seconds)
      VALUES (1, 1, 1, '3x5', 'first', 90), (1, 2, 2, '3x8', 'middle', 60);
    INSERT INTO sets
      (id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps)
      VALUES (1, 1, 1, 'Supino', 1, 100, 5);
  `);
  return db;
}

describe('0021 routine occurrence migration', () => {
  it('preserves existing rows and allows A/B/A without inventing set attribution', () => {
    const migrationFiles = fs.readdirSync(drizzleDir)
      .filter((file) => /^0021_.*\.sql$/.test(file));

    expect(migrationFiles).toHaveLength(1);

    const db = createPreOccurrenceDatabase();
    try {
      const migration = fs.readFileSync(path.join(drizzleDir, migrationFiles[0]), 'utf8')
        .replace(/--> statement-breakpoint/g, '');
      db.exec(migration);

      const routineColumns = db.pragma("table_info('routine_exercises')") as {
        name: string;
        pk: number;
      }[];
      const setColumns = db.pragma("table_info('sets')") as { name: string }[];
      const routineIndexes = db.pragma("index_list('routine_exercises')") as { name: string }[];
      const setIndexes = db.pragma("index_list('sets')") as { name: string }[];

      expect(routineColumns.find((column) => column.name === 'id')?.pk).toBe(1);
      expect(setColumns.some((column) => column.name === 'routine_exercise_id')).toBe(true);
      expect(routineIndexes.map((index) => index.name)).toEqual(expect.arrayContaining([
        're_routine_id_idx',
        're_exercise_id_idx',
      ]));
      expect(setIndexes.map((index) => index.name)).toContain('sets_routine_exercise_id_idx');
      expect(db.prepare('SELECT count(*) AS count FROM routine_exercises').get()).toEqual({ count: 2 });
      expect(db.prepare('SELECT count(*) AS count FROM sets').get()).toEqual({ count: 1 });
      expect(db.prepare('SELECT routine_exercise_id FROM sets WHERE id = 1').get()).toEqual({
        routine_exercise_id: null,
      });

      db.prepare(`
        INSERT INTO routine_exercises
          (routine_id, exercise_id, order_index, target, notes, rest_seconds)
          VALUES (?, ?, ?, ?, ?, ?)
      `).run(1, 1, 3, '2x10', 'second', 120);

      expect(db.prepare(`
        SELECT exercise_id, order_index, target
        FROM routine_exercises
        WHERE routine_id = 1 AND exercise_id = 1
        ORDER BY order_index
      `).all()).toEqual([
        { exercise_id: 1, order_index: 1, target: '3x5' },
        { exercise_id: 1, order_index: 3, target: '2x10' },
      ]);

      const secondOccurrence = db.prepare(`
        SELECT id FROM routine_exercises
        WHERE routine_id = 1 AND exercise_id = 1 AND order_index = 3
      `).get() as { id: number };
      db.prepare(`
        INSERT INTO sets
          (session_id, exercise_id, routine_exercise_id, exercise_name, set_number, weight_kg, reps)
          VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(1, 1, secondOccurrence.id, 'Supino', 2, 80, 10);
      db.prepare('DELETE FROM routine_exercises WHERE id = ?').run(secondOccurrence.id);

      expect(db.prepare('SELECT routine_exercise_id FROM sets WHERE set_number = 2').get()).toEqual({
        routine_exercise_id: null,
      });
    } finally {
      db.close();
    }
  });
});
