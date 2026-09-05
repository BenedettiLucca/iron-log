import { rankEstimated1RMSets } from '@/services/AnalyticsService';

jest.mock('@/src/db/client', () => ({ db: {} }));

describe('estimated 1RM ranking contract', () => {
  it('ranks the best valid estimate instead of the heaviest set and preserves provenance', () => {
    const ranked = rankEstimated1RMSets([
      {
        exerciseId: 7,
        exerciseName: 'Supino reto',
        weightKg: 110,
        reps: 1,
        sessionId: 9,
        createdAt: 900,
      },
      {
        exerciseId: 7,
        exerciseName: 'Supino reto',
        weightKg: 100,
        reps: 5,
        sessionId: 10,
        createdAt: 1_000,
      },
      {
        exerciseId: 7,
        exerciseName: 'Supino reto',
        weightKg: 60,
        reps: 20,
        sessionId: 11,
        createdAt: 1_100,
      },
      {
        exerciseId: 8,
        exerciseName: null,
        weightKg: 200,
        reps: 2,
        sessionId: 12,
        createdAt: 1_200,
      },
    ]);

    expect(ranked).toEqual([
      {
        exerciseId: 7,
        exercise: 'Supino reto',
        estimated1RM: 116.7,
        weightKg: 100,
        reps: 5,
        sessionId: 10,
        date: 1_000,
      },
    ]);
  });

  it('keeps distinct exercise identities separate even when display names collide', () => {
    const ranked = rankEstimated1RMSets([
      { exerciseId: 7, exerciseName: 'Remada', weightKg: 100, reps: 5, sessionId: 1, createdAt: 100 },
      { exerciseId: 8, exerciseName: 'Remada', weightKg: 60, reps: 10, sessionId: 2, createdAt: 200 },
    ]);

    expect(ranked).toEqual(expect.arrayContaining([
      expect.objectContaining({ exerciseId: 7, exercise: 'Remada', estimated1RM: 116.7 }),
      expect.objectContaining({ exerciseId: 8, exercise: 'Remada', estimated1RM: 80 }),
    ]));
    expect(ranked).toHaveLength(2);
  });

  it('omits exercises that only have invalid estimates', () => {
    expect(rankEstimated1RMSets([
      {
        exerciseId: 9,
        exerciseName: 'Flexão',
        weightKg: 10,
        reps: 13,
        sessionId: 1,
        createdAt: null,
      },
    ])).toEqual([]);
  });
});
