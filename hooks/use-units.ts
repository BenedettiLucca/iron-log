import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UnitSystem } from '@/services/units';

const UNIT_SYSTEM_KEY = '@ironlog_unit_system';

export function useUnits() {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(UNIT_SYSTEM_KEY);
        if (stored === 'metric' || stored === 'imperial') {
          if (mounted) setUnitSystemState(stored as UnitSystem);
        }
      } catch (e) {
        // fall back to default
      } finally {
        if (mounted) setIsLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const setUnitSystem = useCallback(async (system: UnitSystem) => {
    setUnitSystemState(system);
    try {
      await AsyncStorage.setItem(UNIT_SYSTEM_KEY, system);
    } catch (e) {
      // storage failure is non-fatal
    }
  }, []);

  return { unitSystem, setUnitSystem, isLoaded };
}