import { estimateE1RM, rankEstimated1RMSets } from '@/services/AnalyticsService';

jest.mock('@/src/db/client', () => ({ db: {} }));

describe('rankEstimated1RMSets deterministic ranking and provenance', () => {
  it('handles 12 reps as the upper limit and omits > 12 reps', () => {
    const atLimit = estimateE1RM(60, 12);
    expect(atLimit).toBe(84);

    const aboveLimit = estimateE1RM(60, 13);
    expect(aboveLimit).toBe(0);

    const ranked = rankEstimated1RMSets([
      { exerciseId: 1, exerciseName: 'Barbell Row', weightKg: 60, reps: 12, sessionId: 1, createdAt: 100 },
      { exerciseId: 1, exerciseName: 'Barbell Row', weightKg: 60, reps: 13, sessionId: 2, createdAt: 200 },
    ]);

    expect(ranked).toEqual([
      {
        exerciseId: 1,
        exercise: 'Barbell Row',
        estimated1RM: 84,
        weightKg: 60,
        reps: 12,
        sessionId: 1,
        date: 100,
      },
    ]);
  });

  it('breaks ties deterministically in order: weight, reps, date, sessionId', () => {
    // Tie-break 1: Higher weight wins when e1RM is equal
    // 100kg x 1 rep = 100 e1RM vs 85.7kg x 5 reps = 100 e1RM
    const weightTieBreak = rankEstimated1RMSets([
      { exerciseId: 1, exerciseName: 'Squat', weightKg: 85.7, reps: 5, sessionId: 1, createdAt: 100 },
      { exerciseId: 1, exerciseName: 'Squat', weightKg: 100, reps: 1, sessionId: 2, createdAt: 100 },
    ]);
    expect(weightTieBreak[0].weightKg).toBe(100);

    // Tie-break 2: More recent date wins when e1RM and weight are equal
    const dateTieBreak = rankEstimated1RMSets([
      { exerciseId: 2, exerciseName: 'Deadlift', weightKg: 150, reps: 5, sessionId: 1, createdAt: 1000 },
      { exerciseId: 2, exerciseName: 'Deadlift', weightKg: 150, reps: 5, sessionId: 2, createdAt: 2000 },
    ]);
    expect(dateTieBreak[0].sessionId).toBe(2);
    expect(dateTieBreak[0].date).toBe(2000);

    // Non-null date beats null date
    const nullDateTieBreak = rankEstimated1RMSets([
      { exerciseId: 2, exerciseName: 'Deadlift', weightKg: 150, reps: 5, sessionId: 1, createdAt: null },
      { exerciseId: 2, exerciseName: 'Deadlift', weightKg: 150, reps: 5, sessionId: 2, createdAt: 500 },
    ]);
    expect(nullDateTieBreak[0].sessionId).toBe(2);
    expect(nullDateTieBreak[0].date).toBe(500);

    // Tie-break 3: Higher sessionId wins when all else is identical
    const sessionTieBreak = rankEstimated1RMSets([
      { exerciseId: 3, exerciseName: 'Bench', weightKg: 100, reps: 5, sessionId: 10, createdAt: 1000 },
      { exerciseId: 3, exerciseName: 'Bench', weightKg: 100, reps: 5, sessionId: 20, createdAt: 1000 },
    ]);
    expect(sessionTieBreak[0].sessionId).toBe(20);
  });

  it('sorts multiple exercises deterministically by e1RM desc, weight desc, then name asc', () => {
    const ranked = rankEstimated1RMSets([
      { exerciseId: 1, exerciseName: 'Biceps Curl', weightKg: 20, reps: 10, sessionId: 1, createdAt: 100 }, // 20 * (1 + 10/30) = 26.7
      { exerciseId: 2, exerciseName: 'Squat', weightKg: 140, reps: 3, sessionId: 2, createdAt: 200 },       // 140 * (1 + 3/30) = 154
      { exerciseId: 3, exerciseName: 'Bench Press', weightKg: 100, reps: 5, sessionId: 3, createdAt: 300 }, // 100 * (1 + 5/30) = 116.7
    ]);

    expect(ranked.map(r => r.exercise)).toEqual(['Squat', 'Bench Press', 'Biceps Curl']);
  });

  it('preserves null date when neither date nor createdAt are provided', () => {
    const ranked = rankEstimated1RMSets([
      { exerciseId: 4, exerciseName: 'Overhead Press', weightKg: 60, reps: 5, sessionId: 1 },
    ]);

    expect(ranked).toEqual([
      {
        exerciseId: 4,
        exercise: 'Overhead Press',
        estimated1RM: 70,
        weightKg: 60,
        reps: 5,
        sessionId: 1,
        date: null,
      },
    ]);
  });

  it('preserves display name from the winning set', () => {
    const ranked = rankEstimated1RMSets([
      { exerciseId: 10, exerciseName: 'Incline DB Press (old name)', weightKg: 30, reps: 10, sessionId: 1, createdAt: 100 },
      { exerciseId: 10, exerciseName: 'Incline Dumbbell Press', weightKg: 40, reps: 10, sessionId: 2, createdAt: 200 },
    ]);

    expect(ranked).toEqual([
      {
        exerciseId: 10,
        exercise: 'Incline Dumbbell Press',
        estimated1RM: 53.3,
        weightKg: 40,
        reps: 10,
        sessionId: 2,
        date: 200,
      },
    ]);
  });
});
