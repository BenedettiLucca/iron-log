// services/MicroSessionService.ts — IL-66 micro-session stub (throwing, issue #66 core slice).
// ZERO logic; replaced with real implementation when owner approves the side-deferral decision.

export interface MicroSessionDraft {
  routineName: string;
  startTime?: number;
  routineId?: number | null;
}

export interface MicroSetInput {
  exerciseId: number;
  weightKg: number;
  reps: number;
  setNumber?: number;
}

export function createMicroSession(_draft: MicroSessionDraft): never {
  throw new Error('micro-session not implemented yet (issue #66 core slice)');
}

export function addMicroSet(_input: MicroSetInput): never {
  throw new Error('micro-session not implemented yet (issue #66 core slice)');
}

export function finishMicroSession(_params: {
  sessionId: number;
  startTime: number;
  endTime: number;
  weight?: string | number | null;
  sRpe?: number | null;
  notes?: string | null;
}): never {
  throw new Error('micro-session not implemented yet (issue #66 core slice)');
}
