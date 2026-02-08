import { useState, useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface StopwatchProps {
  startTime: number;
  paused?: boolean;
  onTogglePause?: () => void;
  editable?: boolean;
  className?: string;
}

export function Stopwatch({ startTime, paused = false, onTogglePause, editable = false, className }: StopwatchProps) {
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(paused);

  useEffect(() => {
    setIsPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isPaused]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePress = () => {
    if (editable && onTogglePause) {
      setIsPaused(!isPaused);
      onTogglePause();
    }
  };

  const content = (
    <Text className={`font-mono text-xl font-bold tracking-widest ${className || 'text-text'}`}>
      {formatTime(seconds)}
    </Text>
  );

  if (editable) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        className="flex-row items-center gap-2"
        activeOpacity={0.7}
      >
        {content}
        {isPaused && (
          <View className="bg-warning/20 px-2 py-0.5 rounded">
            <Text className="text-warning text-[10px] font-bold">PAUSADO</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return content;
}
