import {
  createProgram,
  archiveProgram,
  activateProgram,
  deleteProgram,
  getActiveProgram,
  getProgram,
  getAllPrograms,
} from '@/services/program/crud';
import { setAllWeeks, getProgramWeeks } from '@/services/program/weeks';
import { db, sqlite } from '../fixtures/database';
import { programs, programWeeks, programExerciseTargets, exercises } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { usePrograms } from '@/hooks/use-programs';
import fs from 'node:fs';
import path from 'node:path';

(global as typeof globalThis & { React: typeof React }).React = React;

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

describe('Program lifecycle: ID, rollback and reactivation', () => {
  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM program_exercise_targets; DELETE FROM program_weeks; DELETE FROM programs; DELETE FROM exercises; DELETE FROM sqlite_sequence;'
    );
    db.insert(exercises).values({ id: 1, name: 'Squat', type: 'strength' }).run();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('archiveProgram(id)', () => {
    it('archives only the specified active program', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      expect(p1).not.toBeNull();
      expect(p1!.isActive).toBe(true);

      const success = await archiveProgram(p1!.id);
      expect(success).toBe(true);

      const updated = await getProgram(p1!.id);
      expect(updated?.isActive).toBe(false);

      const active = await getActiveProgram();
      expect(active).toBeNull();
    });

    it('does not deactivate active program when archiving an already archived program', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      const p2 = await createProgram({
        name: 'Program 2',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'strength',
      });
      // p2 is active, p1 was deactivated by createProgram
      expect((await getProgram(p1!.id))?.isActive).toBe(false);
      expect((await getProgram(p2!.id))?.isActive).toBe(true);

      // Archive p1 (already inactive)
      const success = await archiveProgram(p1!.id);
      expect(success).toBe(true);

      // p2 MUST remain active! Archive affects ONLY the specified ID
      const active = await getActiveProgram();
      expect(active?.id).toBe(p2!.id);
      expect(active?.isActive).toBe(true);
    });

    it('does not deactivate active program when ID does not exist', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      expect((await getActiveProgram())?.id).toBe(p1!.id);

      // Non-existent ID
      const success = await archiveProgram(99999);
      expect(success).toBe(false);

      // Active program MUST still be active
      const active = await getActiveProgram();
      expect(active?.id).toBe(p1!.id);
      expect(active?.isActive).toBe(true);
    });
  });

  describe('activateProgram(id)', () => {
    it('activates an archived program and deactivates currently active program', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      const p2 = await createProgram({
        name: 'Program 2',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'strength',
      });

      expect((await getProgram(p1!.id))?.isActive).toBe(false);
      expect((await getProgram(p2!.id))?.isActive).toBe(true);

      // Activate p1
      const success = await activateProgram(p1!.id);
      expect(success).toBe(true);

      expect((await getProgram(p1!.id))?.isActive).toBe(true);
      expect((await getProgram(p2!.id))?.isActive).toBe(false);

      const active = await getActiveProgram();
      expect(active?.id).toBe(p1!.id);
    });

    it('validates target ID before deactivating current program (non-existent ID does not deactivate current)', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      expect((await getActiveProgram())?.id).toBe(p1!.id);

      // Attempt to activate a non-existent program
      const success = await activateProgram(99999);
      expect(success).toBe(false);

      // Current active program must still be active!
      const active = await getActiveProgram();
      expect(active?.id).toBe(p1!.id);
      expect(active?.isActive).toBe(true);
    });

    it('ensures at most one active program when starting from 0, 1, or 2 active programs', async () => {
      // Case 0 active programs
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      await archiveProgram(p1!.id);
      expect(await getActiveProgram()).toBeNull();

      const success0 = await activateProgram(p1!.id);
      expect(success0).toBe(true);
      const allAfter0 = (await getAllPrograms()).filter((p) => p.isActive);
      expect(allAfter0.length).toBe(1);
      expect(allAfter0[0].id).toBe(p1!.id);

      // Case 1 active program -> activate another
      const p2 = await createProgram({
        name: 'Program 2',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'strength',
      });
      const success1 = await activateProgram(p1!.id);
      expect(success1).toBe(true);
      const allAfter1 = (await getAllPrograms()).filter((p) => p.isActive);
      expect(allAfter1.length).toBe(1);
      expect(allAfter1[0].id).toBe(p1!.id);

      // Case 2 active programs (synthetic data anomaly)
      sqlite.exec('UPDATE programs SET is_active = 1;');
      const activeBeforeAnomaly = (await getAllPrograms()).filter((p) => p.isActive);
      expect(activeBeforeAnomaly.length).toBe(2);

      const success2 = await activateProgram(p2!.id);
      expect(success2).toBe(true);
      const allAfter2 = (await getAllPrograms()).filter((p) => p.isActive);
      expect(allAfter2.length).toBe(1);
      expect(allAfter2[0].id).toBe(p2!.id);
    });

    it('rolls back and leaves current active program intact if activation fails', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      const p2 = await createProgram({
        name: 'Program 2',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'strength',
      });
      expect((await getActiveProgram())?.id).toBe(p2!.id);

      // Fault injection: mock db.transaction to simulate runtime failure midway
      const originalTransaction = db.transaction.bind(db);
      jest.spyOn(db, 'transaction').mockImplementationOnce(((callback: any) => {
        return originalTransaction((tx: any) => {
          callback(tx);
          throw new Error('Simulated write failure during activation');
        });
      }) as any);

      const success = await activateProgram(p1!.id);
      expect(success).toBe(false);

      // Transaction rolled back: p2 must still be active, p1 must still be inactive
      expect((await getProgram(p1!.id))?.isActive).toBe(false);
      expect((await getProgram(p2!.id))?.isActive).toBe(true);
      expect((await getActiveProgram())?.id).toBe(p2!.id);
    });
  });

  describe('deleteProgram(id) transactional rollback', () => {
    it('deletes targets, weeks, and program', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      await setAllWeeks(p1!.id, [
        { weekNumber: 1, routineId: null, phase: 'accumulation', rirTarget: 2, intensityMod: 1.0 },
      ]);
      db.insert(programExerciseTargets).values({
        programId: p1!.id,
        exerciseId: 1,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetSets: 3,
      }).run();

      const success = await deleteProgram(p1!.id);
      expect(success).toBe(true);

      expect(await getProgram(p1!.id)).toBeNull();
      expect(await getProgramWeeks(p1!.id)).toEqual([]);
      const targets = db.select().from(programExerciseTargets).where(eq(programExerciseTargets.programId, p1!.id)).all();
      expect(targets).toEqual([]);
    });

    it('returns false when deleting a non-existent program', async () => {
      const success = await deleteProgram(99999);
      expect(success).toBe(false);
    });

    it('rolls back deletion if an error occurs midway (fault injection)', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      await setAllWeeks(p1!.id, [
        { weekNumber: 1, routineId: null, phase: 'accumulation', rirTarget: 2, intensityMod: 1.0 },
      ]);
      db.insert(programExerciseTargets).values({
        programId: p1!.id,
        exerciseId: 1,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetSets: 3,
      }).run();

      // Fault injection: simulate failure before deleting the programs table
      const originalTransaction = db.transaction.bind(db);
      jest.spyOn(db, 'transaction').mockImplementationOnce(((callback: any) => {
        return originalTransaction((tx: any) => {
          tx.delete(programExerciseTargets).where(eq(programExerciseTargets.programId, p1!.id)).run();
          tx.delete(programWeeks).where(eq(programWeeks.programId, p1!.id)).run();
          throw new Error('Simulated failure before program deletion');
        });
      }) as any);

      const success = await deleteProgram(p1!.id);
      expect(success).toBe(false);

      // Program, weeks, and targets must ALL still exist due to rollback!
      expect(await getProgram(p1!.id)).not.toBeNull();
      const weeks = await getProgramWeeks(p1!.id);
      expect(weeks.length).toBe(1);
      const targets = db.select().from(programExerciseTargets).where(eq(programExerciseTargets.programId, p1!.id)).all();
      expect(targets.length).toBe(1);
    });
  });

  describe('setAllWeeks(programId, weeks) transactional rollback', () => {
    it('replaces all weeks successfully', async () => {
      const p = await createProgram({
        name: 'Program',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });

      await setAllWeeks(p!.id, [
        { weekNumber: 1, routineId: null, phase: 'accumulation', rirTarget: 2, intensityMod: 1.0 },
      ]);
      expect((await getProgramWeeks(p!.id)).length).toBe(1);

      await setAllWeeks(p!.id, [
        { weekNumber: 1, routineId: null, phase: 'accumulation', rirTarget: 3, intensityMod: 1.0 },
        { weekNumber: 2, routineId: null, phase: 'intensification', rirTarget: 1, intensityMod: 1.05 },
      ]);
      const weeks = await getProgramWeeks(p!.id);
      expect(weeks.length).toBe(2);
      expect(weeks[0].rirTarget).toBe(3);
      expect(weeks[1].phase).toBe('intensification');
    });

    it('rolls back and preserves existing weeks if insert fails (fault injection)', async () => {
      const p = await createProgram({
        name: 'Program',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });

      await setAllWeeks(p!.id, [
        { weekNumber: 1, routineId: null, phase: 'accumulation', rirTarget: 2, intensityMod: 1.0 },
      ]);
      expect((await getProgramWeeks(p!.id)).length).toBe(1);

      // Fault injection: simulate insert failure during setAllWeeks
      // When setAllWeeks uses db.transaction, this spy will be called during setAllWeeks
      const originalTransaction = db.transaction.bind(db);
      const transactionSpy = jest.spyOn(db, 'transaction').mockImplementation(((callback: any) => {
        return originalTransaction((tx: any) => {
          tx.delete(programWeeks).where(eq(programWeeks.programId, p!.id)).run();
          throw new Error('Simulated insert failure in setAllWeeks');
        });
      }) as any);

      const success = await setAllWeeks(p!.id, [
        { weekNumber: 1, routineId: null, phase: 'intensification', rirTarget: 0, intensityMod: 1.1 },
      ]);
      transactionSpy.mockRestore();

      expect(success).toBe(false);

      // Existing weeks must be intact due to rollback!
      const weeksAfter = await getProgramWeeks(p!.id);
      expect(weeksAfter.length).toBe(1);
      expect(weeksAfter[0].rirTarget).toBe(2);
    });
  });

  describe('createProgram preserves transactional behavior', () => {
    it('creates new program and deactivates current active program', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      expect(p1?.isActive).toBe(true);

      const p2 = await createProgram({
        name: 'Program 2',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'strength',
      });
      expect(p2?.isActive).toBe(true);

      const p1Updated = await getProgram(p1!.id);
      expect(p1Updated?.isActive).toBe(false);

      const active = await getActiveProgram();
      expect(active?.id).toBe(p2!.id);
    });
  });

  describe('usePrograms hook reactivation and state lifecycle', () => {
    it('activates archived program and updates allPrograms, activeProgram, weeks, and targets', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      const p2 = await createProgram({
        name: 'Program 2',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'strength',
      });
      await setAllWeeks(p1!.id, [
        { weekNumber: 1, routineId: null, phase: 'accumulation', rirTarget: 2, intensityMod: 1.0 },
      ]);

      const { result } = renderHook(() => usePrograms());

      await act(async () => {
        await result.current.fetchAllPrograms();
        await result.current.fetchActiveProgram();
      });

      expect(result.current.activeProgram?.id).toBe(p2!.id);

      // Reactivate p1
      let success = false;
      await act(async () => {
        success = await result.current.activateProgram(p1!.id);
      });

      expect(success).toBe(true);
      expect(result.current.activeProgram?.id).toBe(p1!.id);
      expect(result.current.activeProgram?.isActive).toBe(true);
      expect(result.current.weeks.length).toBe(1);

      const archivedInHook = result.current.allPrograms.filter((p) => !p.isActive);
      expect(archivedInHook.map((p) => p.id)).toContain(p2!.id);
      expect(archivedInHook.map((p) => p.id)).not.toContain(p1!.id);
    });

    it('archives active program and keeps activeProgram in sync with inactive state', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });

      const { result } = renderHook(() => usePrograms());

      await act(async () => {
        await result.current.fetchProgramDetails(p1!.id);
      });

      expect(result.current.activeProgram?.id).toBe(p1!.id);
      expect(result.current.activeProgram?.isActive).toBe(true);

      let success = false;
      await act(async () => {
        success = await result.current.archiveProgram(p1!.id);
      });

      expect(success).toBe(true);
      expect(result.current.activeProgram?.id).toBe(p1!.id);
      expect(result.current.activeProgram?.isActive).toBe(false);

      const archivedInHook = result.current.allPrograms.filter((p) => !p.isActive);
      expect(archivedInHook.map((p) => p.id)).toContain(p1!.id);
    });

    it('returns false and preserves state when activating non-existent ID', async () => {
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });

      const { result } = renderHook(() => usePrograms());

      await act(async () => {
        await result.current.fetchActiveProgram();
      });
      expect(result.current.activeProgram?.id).toBe(p1!.id);

      let success = true;
      await act(async () => {
        success = await result.current.activateProgram(99999);
      });

      expect(success).toBe(false);
      expect(result.current.activeProgram?.id).toBe(p1!.id);
      expect(result.current.activeProgram?.isActive).toBe(true);
    });
  });

  describe('Home / Program smoke after toggle', () => {
    it('getActiveProgram reflects correct state through full toggle lifecycle', async () => {
      // 1. Initial creation
      const p1 = await createProgram({
        name: 'Program 1',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'hypertrophy',
      });
      expect((await getActiveProgram())?.id).toBe(p1!.id);

      // 2. Archive
      await archiveProgram(p1!.id);
      expect(await getActiveProgram()).toBeNull();

      // 3. Reactivate
      await activateProgram(p1!.id);
      expect((await getActiveProgram())?.id).toBe(p1!.id);

      // 4. Create second program (replaces active)
      const p2 = await createProgram({
        name: 'Program 2',
        startDate: Date.now(),
        endDate: Date.now() + 7 * 86400000,
        weeksDuration: 4,
        goal: 'strength',
      });
      expect((await getActiveProgram())?.id).toBe(p2!.id);

      // 5. Reactivate first program
      await activateProgram(p1!.id);
      expect((await getActiveProgram())?.id).toBe(p1!.id);
      expect((await getProgram(p2!.id))?.isActive).toBe(false);
    });
  });

  describe('Screen synchronization contracts: reactivation and archiving wiring', () => {
    const indexPath = path.resolve(__dirname, '../../app/programs/index.tsx');
    const detailPath = path.resolve(__dirname, '../../app/programs/detail.tsx');
    const indexSource = fs.readFileSync(indexPath, 'utf8');
    const detailSource = fs.readFileSync(detailPath, 'utf8');

    it('ProgramsListScreen exposes activateProgram and wires handleActivate with feedback', () => {
      // Must consume activateProgram from usePrograms
      expect(indexSource).toMatch(/activateProgram\s*,/);
      // Must implement handleActivate calling activateProgram
      expect(indexSource).toContain('const handleActivate = useCallback(async (programId: number) => {');
      expect(indexSource).toContain('const success = await activateProgram(programId);');
      // Must show toast feedback on success and failure
      expect(indexSource).toContain("setToast({ visible: true, message: t('programs.activateSuccess'), type: 'success' });");
      expect(indexSource).toContain("setToast({ visible: true, message: t('programs.activateError'), type: 'error' });");
      // Must verify active program status with isActive check
      expect(indexSource).toContain('const hasActiveProgram = Boolean(activeProgram && activeProgram.isActive);');
      // Must render reactivation button with accessibility contract and min-h-[44px]
      expect(indexSource).toContain('onPress={() => handleActivate(program.id)}');
      expect(indexSource).toContain('accessibilityRole="button"');
      expect(indexSource).toContain("accessibilityLabel={`${t('programs.activate')}: ${program.name}`}");
      expect(indexSource).toContain('min-h-[44px]');
      expect(indexSource).toContain('min-w-[44px]');
    });

    it('ProgramDetailScreen exposes activateProgram and archiveProgram with state switching and dialogs', () => {
      // Must consume activateProgram and archiveProgram
      expect(detailSource).toMatch(/activateProgram\s*,/);
      expect(detailSource).toMatch(/archiveProgram\s*,/);
      // Must implement handleActivate calling activateProgram
      expect(detailSource).toContain('const handleActivate = async () => {');
      expect(detailSource).toContain('await activateProgram?.(program.id)');
      expect(detailSource).toContain("setToast({ visible: true, message: t('programs.activateSuccess'), type: 'success' });");
      // Must implement handleArchive with confirmation dialog
      expect(detailSource).toContain('const handleArchive = () => {');
      expect(detailSource).toContain('setDialog({');
      expect(detailSource).toContain('await archiveProgram?.(program.id)');
      // Must render conditional action button based on !program.isActive
      expect(detailSource).toContain('!program.isActive ? (');
      expect(detailSource).toContain("title={t('programs.archiveConfirm')}");
      expect(detailSource).toContain("title={t('programs.activateProgram')}");
    });
  });
});
