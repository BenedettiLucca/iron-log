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
CREATE TABLE body_metrics (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	date integer NOT NULL,
	type text DEFAULT 'daily',
	weight real,
	waist real,
	arm_right real,
	thigh_right real,
	chest real,
	calf real,
	photo_front text,
	photo_back text,
	photo_side text,
	photo_notes text
);
CREATE TABLE exercises (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	name text NOT NULL,
	type text DEFAULT 'strength' NOT NULL,
	default_rest_seconds integer DEFAULT 90
);
CREATE TABLE folders (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	name text NOT NULL
);
CREATE UNIQUE INDEX folders_name_unique ON folders (name);
CREATE TABLE measurement_goals (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	type text NOT NULL,
	target_value real NOT NULL,
	start_date integer NOT NULL,
	target_date integer NOT NULL,
	achieved integer DEFAULT 0 NOT NULL,
	achieved_date integer
);
CREATE TABLE notification_settings (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	checkin_day integer DEFAULT 1 NOT NULL,
	checkin_hour integer DEFAULT 9 NOT NULL,
	enabled integer DEFAULT 1 NOT NULL,
	last_notification_date integer
);
CREATE TABLE routines (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	name text NOT NULL,
	description text,
	folder text DEFAULT 'Geral',
	is_template integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX routines_name_unique ON routines (name);
CREATE TABLE programs (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	name text NOT NULL,
	description text,
	start_date integer NOT NULL,
	end_date integer NOT NULL,
	weeks_duration integer DEFAULT 6 NOT NULL,
	deload_week integer,
	goal text DEFAULT 'hypertrophy' NOT NULL,
	is_active integer DEFAULT 1 NOT NULL,
	created_at integer
);
CREATE TABLE sessions (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	routine_id integer,
	routine_name text,
	start_time integer NOT NULL,
	end_time integer,
	body_weight real,
	s_rpe integer,
	notes text,
	duration_minutes integer,
	deleted_at integer,
	FOREIGN KEY (routine_id) REFERENCES routines(id) ON UPDATE no action ON DELETE no action
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
	is_warmup integer DEFAULT 0 NOT NULL,
	is_edited integer DEFAULT 0 NOT NULL,
	created_at integer,
	deleted_at integer,
	FOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON UPDATE no action ON DELETE no action
);
CREATE TABLE personal_records (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	exercise_id integer NOT NULL,
	session_id integer,
	record_type text NOT NULL,
	value real NOT NULL,
	date integer NOT NULL,
	set_details text,
	FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX pr_exercise_type_unique ON personal_records (exercise_id, record_type);
CREATE TABLE program_exercise_targets (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	program_id integer NOT NULL,
	exercise_id integer NOT NULL,
	target_reps_min integer NOT NULL,
	target_reps_max integer NOT NULL,
	target_sets integer NOT NULL,
	FOREIGN KEY (program_id) REFERENCES programs(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX program_exercise_unique ON program_exercise_targets (program_id, exercise_id);
CREATE TABLE program_weeks (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	program_id integer NOT NULL,
	week_number integer NOT NULL,
	routine_id integer,
	phase text DEFAULT 'accumulation' NOT NULL,
	rir_target integer DEFAULT 0,
	intensity_mod real DEFAULT 1,
	FOREIGN KEY (program_id) REFERENCES programs(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (routine_id) REFERENCES routines(id) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX program_week_unique ON program_weeks (program_id, week_number);
CREATE TABLE routine_exercises (
	routine_id integer,
	exercise_id integer,
	order_index integer,
	target text,
	notes text,
	rest_seconds integer,
	PRIMARY KEY(routine_id, exercise_id),
	FOREIGN KEY (routine_id) REFERENCES routines(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON UPDATE no action ON DELETE no action
);
CREATE TABLE supplements (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	name text NOT NULL,
	dosage text NOT NULL,
	timing text NOT NULL,
	frequency text DEFAULT 'daily' NOT NULL,
	reminder_time text,
	is_nighttime integer DEFAULT 0 NOT NULL,
	emoji text DEFAULT '💊',
	order_index integer DEFAULT 0 NOT NULL,
	is_active integer DEFAULT 1 NOT NULL
);
CREATE TABLE supplement_logs (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	supplement_id integer NOT NULL,
	date integer NOT NULL,
	taken_at integer NOT NULL,
	FOREIGN KEY (supplement_id) REFERENCES supplements(id) ON UPDATE no action ON DELETE no action
);
CREATE TABLE user_settings (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	default_weight real,
	height real,
	sex text
);
CREATE INDEX sessions_date_idx ON sessions (start_time);
CREATE INDEX sets_session_id_idx ON sets (session_id);
CREATE INDEX sets_exercise_id_idx ON sets (exercise_id);
CREATE INDEX body_metrics_date_idx ON body_metrics (date);
CREATE INDEX pr_exercise_type_idx ON personal_records (exercise_id, record_type);
CREATE INDEX re_routine_id_idx ON routine_exercises (routine_id);
CREATE INDEX re_exercise_id_idx ON routine_exercises (exercise_id);
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
