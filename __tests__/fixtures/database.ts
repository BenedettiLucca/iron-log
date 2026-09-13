import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/src/db/schema';

// Synthetic, in-memory database only. No copy of an app database or native bridge mock.
// Uses direct DDL matching src/db/schema.ts because historical migrations 0001, 0012, 0013
// contain SQLite DQS incompatibilities (drizzle-kit table recreation referencing new columns
// in old SELECT statements), which fail on modern SQLite / better-sqlite3 with DQS=0.
const Database = jest.requireActual('better-sqlite3');
export const sqlite = new Database(':memory:');
export const db = drizzle(sqlite, { schema });

const schemaDdl = `
CREATE TABLE body_metrics (\n\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tdate integer NOT NULL,
\ttype text DEFAULT 'daily',
\tweight real,
\twaist real,
\tarm_right real,
\tthigh_right real,
\tchest real,
\tcalf real,
\tphoto_front text,
\tphoto_back text,
\tphoto_side text,
\tphoto_notes text
);
CREATE TABLE exercises (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tname text NOT NULL,
\ttype text DEFAULT 'strength' NOT NULL,
\tmuscle_group text,
\tequipment text,
\tdefault_rest_seconds integer DEFAULT 90
);
CREATE TABLE folders (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tname text NOT NULL
);
CREATE UNIQUE INDEX folders_name_unique ON folders (name);
CREATE TABLE measurement_goals (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\ttype text NOT NULL,
\ttarget_value real NOT NULL,
\tstart_date integer NOT NULL,
\ttarget_date integer NOT NULL,
\tachieved integer DEFAULT 0 NOT NULL,
\tachieved_date integer
);
CREATE TABLE notification_settings (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tcheckin_day integer DEFAULT 1 NOT NULL,
\tcheckin_hour integer DEFAULT 9 NOT NULL,
\tenabled integer DEFAULT 1 NOT NULL,
\tlast_notification_date integer
);
CREATE TABLE routines (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tname text NOT NULL,
\tdescription text,
\tfolder text DEFAULT 'Geral',
\tis_template integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX routines_name_unique ON routines (name);
CREATE TABLE programs (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tname text NOT NULL,
\tdescription text,
\tstart_date integer NOT NULL,
\tend_date integer NOT NULL,
\tweeks_duration integer DEFAULT 6 NOT NULL,
\tdeload_week integer,
\tgoal text DEFAULT 'hypertrophy' NOT NULL,
\tis_active integer DEFAULT 1 NOT NULL,
\tcreated_at integer
);
CREATE TABLE sessions (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\troutine_id integer,
\troutine_name text,
\tstart_time integer NOT NULL,
\tend_time integer,
\tbody_weight real,
\ts_rpe integer,
\tnotes text,
\tduration_minutes integer,
\tdeleted_at integer,
\tFOREIGN KEY (routine_id) REFERENCES routines(id) ON UPDATE no action ON DELETE no action
);
CREATE TABLE sets (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tsession_id integer NOT NULL,
\texercise_id integer NOT NULL,
\texercise_name text,
\tset_number integer NOT NULL,
\tweight_kg real NOT NULL,
\treps integer NOT NULL,
\tduration_seconds integer,
\trir integer,
\tis_warmup integer DEFAULT 0 NOT NULL,
\tis_edited integer DEFAULT 0 NOT NULL,
\tcreated_at integer,
\tdeleted_at integer,
\troutine_exercise_id integer,
\toperation_id text,
\tFOREIGN KEY (routine_exercise_id) REFERENCES routine_exercises(id) ON UPDATE no action ON DELETE set null,
\tFOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE no action ON DELETE no action,
\tFOREIGN KEY (exercise_id) REFERENCES exercises(id) ON UPDATE no action ON DELETE no action
);
CREATE TABLE personal_records (\n\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\texercise_id integer NOT NULL,
\tsession_id integer,
\trecord_type text NOT NULL,
\tvalue real NOT NULL,
\tdate integer NOT NULL,
\tset_details text,
\tFOREIGN KEY (exercise_id) REFERENCES exercises(id) ON UPDATE no action ON DELETE no action,
\tFOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX pr_exercise_type_unique ON personal_records (exercise_id, record_type);
CREATE TABLE program_exercise_targets (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tprogram_id integer NOT NULL,
\texercise_id integer NOT NULL,
\ttarget_reps_min integer NOT NULL,
\ttarget_reps_max integer NOT NULL,
\ttarget_sets integer NOT NULL,
\tFOREIGN KEY (program_id) REFERENCES programs(id) ON UPDATE no action ON DELETE no action,
\tFOREIGN KEY (exercise_id) REFERENCES exercises(id) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX program_exercise_unique ON program_exercise_targets (program_id, exercise_id);
CREATE TABLE program_weeks (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tprogram_id integer NOT NULL,
\tweek_number integer NOT NULL,
\troutine_id integer,
\tphase text DEFAULT 'accumulation' NOT NULL,
\trir_target integer DEFAULT 0,
\tintensity_mod real DEFAULT 1,
\tFOREIGN KEY (program_id) REFERENCES programs(id) ON UPDATE no action ON DELETE no action,
\tFOREIGN KEY (routine_id) REFERENCES routines(id) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX program_week_unique ON program_weeks (program_id, week_number);
CREATE TABLE routine_exercises (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\troutine_id integer,
\texercise_id integer,
\torder_index integer,
\ttarget text,
\tnotes text,
\trest_seconds integer,
\tFOREIGN KEY (routine_id) REFERENCES routines(id) ON UPDATE no action ON DELETE no action,
\tFOREIGN KEY (exercise_id) REFERENCES exercises(id) ON UPDATE no action ON DELETE no action
);
CREATE TABLE supplements (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tname text NOT NULL,
\tdosage text NOT NULL,
\ttiming text NOT NULL,
\tfrequency text DEFAULT 'daily' NOT NULL,
\treminder_time text,
\tis_nighttime integer DEFAULT 0 NOT NULL,
\temoji text DEFAULT '💊',
\torder_index integer DEFAULT 0 NOT NULL,
\tis_active integer DEFAULT 1 NOT NULL
);
CREATE TABLE supplement_logs (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tsupplement_id integer NOT NULL,
\tdate integer NOT NULL,
\ttaken_at integer NOT NULL,
\tFOREIGN KEY (supplement_id) REFERENCES supplements(id) ON UPDATE no action ON DELETE no action
);
CREATE TABLE user_settings (
\tid integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\tdefault_weight real,
\theight real,
\tsex text
);
CREATE INDEX sessions_date_idx ON sessions (start_time);
CREATE INDEX sets_session_id_idx ON sets (session_id);
CREATE INDEX sets_exercise_id_idx ON sets (exercise_id);
CREATE INDEX body_metrics_date_idx ON body_metrics (date);
CREATE INDEX pr_exercise_type_idx ON personal_records (exercise_id, record_type);
CREATE INDEX re_routine_id_idx ON routine_exercises (routine_id);
CREATE INDEX re_exercise_id_idx ON routine_exercises (exercise_id);
CREATE INDEX sets_routine_exercise_id_idx ON sets (routine_exercise_id);
CREATE UNIQUE INDEX sets_operation_id_unique ON sets (operation_id);
CREATE INDEX sessions_routine_id_idx ON sessions (routine_id);
CREATE INDEX programs_active_idx ON programs (is_active);
CREATE INDEX pw_program_id_idx ON program_weeks (program_id);
CREATE INDEX pet_program_exercise_idx ON program_exercise_targets (program_id, exercise_id);
CREATE INDEX supplement_logs_date_idx ON supplement_logs (date);
CREATE INDEX supplement_logs_supplement_id_idx ON supplement_logs (supplement_id);
CREATE INDEX supplement_logs_compound_idx ON supplement_logs (supplement_id, date);
CREATE INDEX supplements_active_idx ON supplements (is_active);
`;

sqlite.exec(schemaDdl);
sqlite.pragma('foreign_keys = ON');
