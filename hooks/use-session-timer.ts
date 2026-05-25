import { useState, useEffect, useCallback } from 'react';

interface UseSessionTimerReturn {
  // Rest timer
  timerSeconds: number | null;
  timerTarget: number | null;
  timerStatus: 'idle' | 'running' | 'finished';
  setTimerSeconds: (s: number | null) => void;
  setTimerTarget: (t: number | null) => void;
  setTimerStatus: (s: 'idle' | 'running' | 'finished') => void;
  addTime: (sec: number) => void;
  // Active set timer
  activeSetStart: number | null;
  activeSetTime: number;
  isActiveSetRunning: boolean;
  toggleActiveSet: () => void;
}

export function useSessionTimer(): UseSessionTimerReturn {
  // Rest Timer
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerTarget, setTimerTarget] = useState<number | null>(null);
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'finished'>('idle');

  // Active Set Timer
  const [activeSetStart, setActiveSetStart] = useState<number | null>(null);
  const [activeSetTime, setActiveSetTime] = useState(0);
  const isActiveSetRunning = activeSetStart !== null;

  // Efeito Active Timer (delta-based for accuracy)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (activeSetStart !== null) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - activeSetStart) / 1000);
        setActiveSetTime(elapsed);
      };
      tick();
      interval = setInterval(tick, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSetStart]);

  // Efeito Rest Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (timerStatus === 'running' && timerTarget) {
      const tick = () => {
        const now = Date.now();
        const left = Math.ceil((timerTarget - now) / 1000);
        if (left <= 0) {
          setTimerSeconds(0);
          setTimerStatus('finished');
        } else {
          setTimerSeconds(left);
        }
      };
      tick();
      interval = setInterval(tick, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerStatus, timerTarget]);

  const toggleActiveSet = useCallback(() => {
    if (activeSetStart !== null) {
      // Stop — keep current time frozen
      setActiveSetStart(null);
    } else {
      // Start fresh
      setActiveSetTime(0);
      setActiveSetStart(Date.now());
    }
  }, [activeSetStart]);

  const addTime = useCallback((sec: number) => {
    if (timerStatus === 'running' && timerTarget) {
      setTimerTarget(timerTarget + sec * 1000);
    } else {
      setTimerSeconds((prev) => (prev || 0) + sec);
    }
  }, [timerStatus, timerTarget]);

  return {
    timerSeconds,
    timerTarget,
    timerStatus,
    setTimerSeconds,
    setTimerTarget,
    setTimerStatus,
    addTime,
    activeSetStart,
    activeSetTime,
    isActiveSetRunning,
    toggleActiveSet,
  };
}
