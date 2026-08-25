import { getGoalBadge, getPhaseLabel } from '../../src/utils/programs';

describe('program display helpers', () => {
  const t = jest.fn((key: string) => `translated:${key}`);

  beforeEach(() => {
    t.mockClear();
  });

  describe('getPhaseLabel', () => {
    it('returns an empty label for a missing phase', () => {
      expect(getPhaseLabel(null, t)).toBe('');
      expect(t).not.toHaveBeenCalled();
    });

    it.each([
      ['accumulation', 'programs.phases.accumulation'],
      ['intensification', 'programs.phases.intensification'],
      ['deload', 'programs.phases.deload'],
    ])('translates the %s phase', (phase, translationKey) => {
      expect(getPhaseLabel(phase, t)).toBe(`translated:${translationKey}`);
      expect(t).toHaveBeenCalledWith(translationKey);
    });

    it('preserves an unknown phase label', () => {
      expect(getPhaseLabel('realization', t)).toBe('realization');
      expect(t).not.toHaveBeenCalled();
    });
  });

  describe('getGoalBadge', () => {
    it.each([
      ['hypertrophy', '💪', 'programs.goals.hypertrophy'],
      ['strength', '🏋️', 'programs.goals.strength'],
      ['endurance', '🏃', 'programs.goals.endurance'],
    ])('maps %s to its emoji and translated label', (goal, emoji, translationKey) => {
      expect(getGoalBadge(goal, t)).toEqual({
        emoji,
        label: `translated:${translationKey}`,
      });
      expect(t).toHaveBeenCalledWith(translationKey);
    });

    it('uses a neutral badge for an unknown goal', () => {
      expect(getGoalBadge('mobility', t)).toEqual({
        emoji: '🎯',
        label: 'mobility',
      });
      expect(t).not.toHaveBeenCalled();
    });
  });
});
