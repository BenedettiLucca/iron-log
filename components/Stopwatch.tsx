import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { useI18n } from '@/src/i18n/index';

interface StopwatchProps {
  startTime: number;
  className?: string;
}

export function Stopwatch({ startTime, className }: StopwatchProps) {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Text
      className={`font-mono text-xl font-bold tracking-widest ${className || 'text-text'}`}
      accessibilityRole="timer"
      accessibilityLabel={`${t('exerciseSession.elapsedTime')}: ${formatTime(seconds)}`}
    >
      {formatTime(seconds)}
    </Text>
  );
}
