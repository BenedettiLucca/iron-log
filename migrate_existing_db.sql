-- Iron Log v3.6.0 Migration: Add Program Management Tables
-- Generated from Notion 'Treino' page: Operacao Martelo de Forja v8.2
-- Safe migration: does NOT drop or alter existing tables

BEGIN TRANSACTION;

-- ============================================================
-- 1. Create 'programs' table
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    weeks_duration INTEGER DEFAULT 4,
    deload_week INTEGER,
    goal TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_programs_active ON programs(is_active);
CREATE INDEX IF NOT EXISTS idx_programs_dates ON programs(start_date, end_date);

-- ============================================================
-- 2. Create 'program_weeks' table
-- ============================================================
CREATE TABLE IF NOT EXISTS program_weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    routine_id INTEGER NOT NULL,
    phase TEXT,
    rir_target TEXT,
    intensity_mod REAL DEFAULT 1.0,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_program_weeks_program ON program_weeks(program_id);
CREATE INDEX IF NOT EXISTS idx_program_weeks_routine ON program_weeks(routine_id);

-- ============================================================
-- 3. Create 'program_exercise_targets' table
-- ============================================================
CREATE TABLE IF NOT EXISTS program_exercise_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    target_reps_min INTEGER,
    target_reps_max INTEGER,
    target_sets INTEGER,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_program_exercise_targets_program ON program_exercise_targets(program_id);
CREATE INDEX IF NOT EXISTS idx_program_exercise_targets_exercise ON program_exercise_targets(exercise_id);

-- ============================================================
-- 4. Insert Program: Operacao Martelo de Forja v8.2
-- ============================================================
INSERT OR IGNORE INTO programs (id, name, description, start_date, weeks_duration, deload_week, goal, is_active, created_at)
VALUES (1, 'Operacao Martelo de Forja v8.2 (Upper/Lower Black Ops)',
        'Programa Upper/Lower 4x/semana com progressao linear. Foco em densidade, forca bruta e hipertrofia regional.',
        date('now'), 4, NULL, 'hypertrophy', 1, datetime('now'));

-- ============================================================
-- 5. Insert Program Weeks (linking to existing routines)
-- ============================================================
INSERT OR IGNORE INTO program_weeks (program_id, week_number, routine_id, phase, rir_target, intensity_mod)
VALUES (1, 1, 9, 'Densidade e Forca Bruta', '0-1', 1.0);
INSERT OR IGNORE INTO program_weeks (program_id, week_number, routine_id, phase, rir_target, intensity_mod)
VALUES (1, 2, 10, 'Artilharia Frontal e Core', '0-1', 1.0);
INSERT OR IGNORE INTO program_weeks (program_id, week_number, routine_id, phase, rir_target, intensity_mod)
VALUES (1, 3, 11, 'Largura e Refinamento', '1-2', 1.0);
INSERT OR IGNORE INTO program_weeks (program_id, week_number, routine_id, phase, rir_target, intensity_mod)
VALUES (1, 4, 12, 'Cadeia Posterior e Pelvica', '1-2', 1.0);

-- ============================================================
-- 6. Insert Exercise Targets per Program
-- ============================================================
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 6, 6, 8, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 35, 10, 12, 2);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 28, 10, 12, 2);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 2, 6, 8, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 17, 10, 12, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 38, 10, 12, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 40, 8, 10, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 22, 8, 10, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 41, 12, 15, 2);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 42, 10, 12, 2);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 9, 10, 12, 2);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 44, 12, 15, 2);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 14, 8, 10, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 23, 8, 10, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 12, 12, 15, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 32, 15, 20, 3);
INSERT OR IGNORE INTO program_exercise_targets (program_id, exercise_id, target_reps_min, target_reps_max, target_sets)
VALUES (1, 20, 0, 0, 3);

COMMIT;

-- Migration complete. All existing data preserved.