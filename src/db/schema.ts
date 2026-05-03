import { sqliteTable, text, integer, real, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';

// TABELA: Templates de Treino (Ex: Treino A, Treino B)
export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  folder: text('folder').default('Geral'),
  isTemplate: integer('is_template', { mode: 'boolean' }).notNull().default(false),
});

// TABELA: Definição de Exercícios (Biblioteca)
export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull().default('strength'), // 'strength' | 'duration'
  defaultRestSeconds: integer('default_rest_seconds').default(90),
});

// TABELA: Exercícios contidos em uma Rotina (Join Table com ordem)
export const routineExercises = sqliteTable('routine_exercises', {
  routineId: integer('routine_id').references(() => routines.id),
  exerciseId: integer('exercise_id').references(() => exercises.id),
  orderIndex: integer('order_index'),
  target: text('target'), // Ex: "3x8-12" ou "60s"
  notes: text('notes'),   // Ex: "Banco altura 4, foco na negativa"
  restSeconds: integer('rest_seconds'), // Tempo de descanso em segundos
}, (t) => [
  primaryKey({ columns: [t.routineId, t.exerciseId] }),
]);

// TABELA: Sessões de Treino
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').references(() => routines.id),
  routineName: text('routine_name'), // Snapshot
  startTime: integer('start_time').notNull(), // Epoch timestamp
  endTime: integer('end_time'),
  bodyWeight: real('body_weight'),
  sRpe: integer('s_rpe'),
  notes: text('notes'),
  durationMinutes: integer('duration_minutes'),
  deletedAt: integer('deleted_at'), // Epoch, null = active
});

// TABELA: Sets (Registro de séries)
export const sets = sqliteTable('sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  exerciseName: text('exercise_name'), // Snapshot
  setNumber: integer('set_number').notNull(),
  weightKg: real('weight_kg').notNull(),
  reps: integer('reps').notNull(),
  durationSeconds: integer('duration_seconds'),
  rir: integer('rir'),
  isWarmup: integer('is_warmup', { mode: 'boolean' }).notNull().default(false),
  isEdited: integer('is_edited', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
  deletedAt: integer('deleted_at'), // Epoch, null = active
});

// TABELA: Métricas Corporais e Fotos
export const bodyMetrics = sqliteTable('body_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: integer('date').notNull(), // Epoch
  type: text('type').default('daily'), // 'daily' (peso) ou 'monthly' (completo)
  weight: real('weight'),
  waist: real('waist'),
  armRight: real('arm_right'),
  thighRight: real('thigh_right'),
  chest: real('chest'),
  calf: real('calf'),
  photoFront: text('photo_front'),
  photoBack: text('photo_back'),
  photoSide: text('photo_side'),
  photoNotes: text('photo_notes'),
});

// TABELA: Configurações do Usuário (Single Row)
export const userSettings = sqliteTable('user_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  defaultWeight: real('default_weight'),
  height: real('height'),
  sex: text('sex'), // 'M' | 'F' | 'O'
});

// TABELA: Configurações de Notificações (Single Row)
export const notificationSettings = sqliteTable('notification_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  checkinDay: integer('checkin_day').notNull().default(1), // 1-31
  checkinHour: integer('checkin_hour').notNull().default(9), // 0-23
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastNotificationDate: integer('last_notification_date'), // Epoch timestamp
});

// TABELA: Metas de Medidas Corporais
export const measurementGoals = sqliteTable('measurement_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // 'weight', 'waist', 'armRight', 'thighRight', 'chest', 'calf'
  targetValue: real('target_value').notNull(),
  startDate: integer('start_date').notNull(), // Epoch
  targetDate: integer('target_date').notNull(), // Epoch
  achieved: integer('achieved', { mode: 'boolean' }).notNull().default(false),
  achievedDate: integer('achieved_date'), // Epoch
});

// TABELA: Recordes Pessoais (PRs)
export const personalRecords = sqliteTable('personal_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  sessionId: integer('session_id').references(() => sessions.id),
  recordType: text('record_type').notNull(), // 'weight', 'reps', 'volume', 'duration'
  value: real('value').notNull(),
  date: integer('date').notNull(), // Epoch
  setDetails: text('set_details'), // JSON string with set details
}, (table) => [
  uniqueIndex("pr_exercise_type_unique").on(table.exerciseId, table.recordType),
]);

// TABELA: Programas / Mesociclos (Periodização)
export const programs = sqliteTable('programs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // Ex: "Força Bruta v8.2"
  description: text('description'),
  startDate: integer('start_date').notNull(), // Epoch
  endDate: integer('end_date').notNull(), // Epoch
  weeksDuration: integer('weeks_duration').notNull().default(6),
  deloadWeek: integer('deload_week'), // Week number for deload (e.g. 6)
  goal: text('goal').notNull().default('hypertrophy'), // 'hypertrophy' | 'strength' | 'endurance' | 'deload'
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

// TABELA: Vinculação Rotina ↔ Semana do Programa
export const programWeeks = sqliteTable('program_weeks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id').notNull().references(() => programs.id),
  weekNumber: integer('week_number').notNull(), // 1–N
  routineId: integer('routine_id').references(() => routines.id),
  phase: text('phase').notNull().default('accumulation'), // 'accumulation' | 'intensification' | 'deload'
  rirTarget: integer('rir_target').default(0), // Target RIR for this week
  intensityMod: real('intensity_mod').default(1.0), // Multiplier for load (e.g. 0.6 for deload)
}, (t) => [
  uniqueIndex("program_week_unique").on(t.programId, t.weekNumber),
]);

// TABELA: RIR Target por Exercício no Programa
export const programExerciseTargets = sqliteTable('program_exercise_targets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id').notNull().references(() => programs.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  targetRepsMin: integer('target_reps_min').notNull(), // Bottom of double progression range
  targetRepsMax: integer('target_reps_max').notNull(), // Top of range
  targetSets: integer('target_sets').notNull(), // Number of working sets
}, (t) => [
  uniqueIndex("program_exercise_unique").on(t.programId, t.exerciseId),
]);

// Indexes for query performance
export const sessionsDateIdx = index("sessions_date_idx").on(sessions.startTime);
export const setsSessionIdx = index("sets_session_id_idx").on(sets.sessionId);
export const setsExerciseIdx = index("sets_exercise_id_idx").on(sets.exerciseId);
export const bodyMetricsDateIdx = index("body_metrics_date_idx").on(bodyMetrics.date);
export const personalRecordsExerciseIdx = index("pr_exercise_type_idx").on(personalRecords.exerciseId, personalRecords.recordType);
export const routineExercisesRoutineIdx = index("re_routine_id_idx").on(routineExercises.routineId);
export const routineExercisesExerciseIdx = index("re_exercise_id_idx").on(routineExercises.exerciseId);
export const sessionsRoutineIdx = index("sessions_routine_id_idx").on(sessions.routineId);
export const programsActiveIdx = index("programs_active_idx").on(programs.isActive);
export const programWeeksProgramIdx = index("pw_program_id_idx").on(programWeeks.programId);
export const programExerciseTargetsIdx = index("pet_program_exercise_idx").on(programExerciseTargets.programId, programExerciseTargets.exerciseId);

// TABELA: Suplementos
export const supplements = sqliteTable('supplements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  dosage: text('dosage').notNull(),           // "5g", "200mg + 100mg"
  timing: text('timing').notNull(),            // "qualquer hora", "30min antes do treino", "antes de dormir"
  frequency: text('frequency').notNull().default('daily'), // "daily", "training_days", "rest_days"
  reminderTime: text('reminder_time'),         // "07:00", "21:30"
  isNighttime: integer('is_nighttime', { mode: 'boolean' }).notNull().default(false),
  emoji: text('emoji').default('💊'),
  orderIndex: integer('order_index').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
}, (t) => [
  index("supplements_active_idx").on(t.isActive),
]);

// TABELA: Log de Suplementação
export const supplementLogs = sqliteTable('supplement_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplementId: integer('supplement_id').notNull().references(() => supplements.id),
  date: integer('date').notNull(),       // epoch start of day (midnight)
  takenAt: integer('taken_at').notNull(), // exact epoch timestamp
}, (t) => [
  index("supplement_logs_date_idx").on(t.date),
]);

