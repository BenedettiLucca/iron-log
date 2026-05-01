-- Migration: Add programs, program_weeks, and program_exercise_targets tables
CREATE TABLE IF NOT EXISTS "programs" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "start_date" integer NOT NULL,
  "end_date" integer NOT NULL,
  "weeks_duration" integer DEFAULT 6 NOT NULL,
  "deload_week" integer,
  "goal" text DEFAULT 'hypertrophy' NOT NULL,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "program_weeks" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "program_id" integer NOT NULL,
  "week_number" integer NOT NULL,
  "routine_id" integer,
  "phase" text DEFAULT 'accumulation' NOT NULL,
  "rir_target" integer DEFAULT 0,
  "intensity_mod" real DEFAULT 1.0,
  FOREIGN KEY ("program_id") REFERENCES "programs"("id"),
  FOREIGN KEY ("routine_id") REFERENCES "routines"("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "program_exercise_targets" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "program_id" integer NOT NULL,
  "exercise_id" integer NOT NULL,
  "target_reps_min" integer NOT NULL,
  "target_reps_max" integer NOT NULL,
  "target_sets" integer NOT NULL,
  FOREIGN KEY ("program_id") REFERENCES "programs"("id"),
  FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "program_week_unique" ON "program_weeks" ("program_id","week_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "program_exercise_unique" ON "program_exercise_targets" ("program_id","exercise_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_active_idx" ON "programs" ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pw_program_id_idx" ON "program_weeks" ("program_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pet_program_exercise_idx" ON "program_exercise_targets" ("program_id","exercise_id");
