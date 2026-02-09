import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// TABELA: Templates de Treino (Ex: Treino A, Treino B)
export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  folder: text('folder').default('Geral'),
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
});

// TABELA: Sessões de Treino
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').references(() => routines.id), // Novo vínculo
  routineName: text('routine_name'), // Snapshot
  startTime: integer('start_time').notNull(), // Epoch timestamp
  endTime: integer('end_time'),
  bodyWeight: real('body_weight'),
  sRpe: integer('s_rpe'),
  notes: text('notes'),
  durationMinutes: integer('duration_minutes'),
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
  createdAt: integer('created_at').default(Date.now()),
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
