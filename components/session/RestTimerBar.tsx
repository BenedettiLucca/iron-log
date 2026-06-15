import { RestTimer } from '../RestTimer';

interface RestTimerBarProps {
  timerStatus: 'idle' | 'running' | 'finished';
  timerSeconds: number | null;
  setTimerStatus: (status: 'idle' | 'running' | 'finished') => void;
  setTimerSeconds: (seconds: number | null) => void;
  addTime: (sec: number) => void;
  nextExerciseName?: string;
}

export function RestTimerBar({
  timerStatus,
  timerSeconds,
  setTimerStatus,
  setTimerSeconds,
  addTime,
  nextExerciseName,
}: RestTimerBarProps) {
  return (
    <RestTimer
      visible={timerStatus !== 'idle'}
      seconds={timerSeconds || 0}
      status={timerStatus}
      onClose={() => {
        setTimerStatus('idle');
        setTimerSeconds(null);
      }}
      onSkip={() => {
        setTimerStatus('idle');
        setTimerSeconds(null);
      }}
      onAddTime={addTime}
      nextExerciseName={nextExerciseName}
    />
  );
}
