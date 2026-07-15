import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function useReactiveReducedMotion() {
  const startupReducedMotion = useReducedMotion();
  const [isReducedMotion, setIsReducedMotion] = useState(startupReducedMotion);

  useEffect(() => {
    let mounted = true;
    let receivedChangeEvent = false;

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (!mounted) return;
        receivedChangeEvent = true;
        setIsReducedMotion(enabled);
      }
    );

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted && !receivedChangeEvent) {
          setIsReducedMotion(enabled);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return isReducedMotion;
}
