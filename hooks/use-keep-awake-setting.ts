import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

export const STORAGE_KEY = 'settings.keepAwake';
export const DEFAULT_ENABLED = true;

export function useKeepAwakeSetting() {
  const [enabled, setEnabled] = useState<boolean>(DEFAULT_ENABLED);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored !== null) {
        setEnabled(stored === 'true');
      }
    });
  }, []);

  const setSetting = (next: boolean) => {
    setEnabled(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next));
  };

  return { enabled, setSetting };
}

export function useSessionKeepAwake() {
  const { enabled } = useKeepAwakeSetting();

  useEffect(() => {
    if (enabled) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
    return () => {
      deactivateKeepAwake();
    };
  }, [enabled]);
}
