// ponytail: extracted from duplicate definitions in programs/detail.tsx and programs/index.tsx

export function getPhaseLabel(phase: string | null, t: (key: string) => string): string {
  if (!phase) return '';
  switch (phase) {
    case 'accumulation': return t('programs.phases.accumulation');
    case 'intensification': return t('programs.phases.intensification');
    case 'deload': return t('programs.phases.deload');
    default: return phase;
  }
}

export function getGoalBadge(goal: string, t: (key: string) => string): { emoji: string; label: string } {
  switch (goal) {
    case 'hypertrophy': return { emoji: '💪', label: t('programs.goals.hypertrophy') };
    case 'strength': return { emoji: '🏋️', label: t('programs.goals.strength') };
    case 'endurance': return { emoji: '🏃', label: t('programs.goals.endurance') };
    default: return { emoji: '🎯', label: goal };
  }
}
