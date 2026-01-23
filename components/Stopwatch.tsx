import { useState, useEffect } from 'react';
import { Text } from 'react-native';

export function Stopwatch({ startTime }: { startTime: number }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    console.log("Stopwatch mounted with startTime:", startTime);
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Text className="text-white font-mono text-xl font-bold tracking-widest">
      {formatTime(seconds)}
    </Text>
  );
}
