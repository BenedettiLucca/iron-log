import { useState, useCallback } from 'react';
import { db } from '@/src/db/client';
import { sessions } from '@/src/db/schema';
import { desc, isNull } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/services/logger';
import { Session } from '@/src/types';

const INCOMPLETE_SESSION_KEY = 'incomplete_session';

export function useSessions() {
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [incompleteSession, setIncompleteSession] = useState<(Session & { sessionId?: number; exerciseId?: number; exerciseName?: string; target?: string | null; notes?: string | null }) | null>(null);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHomeData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Last session
      const sResult = await db.select().from(sessions)
        .where(isNull(sessions.deletedAt))
        .orderBy(desc(sessions.startTime))
        .limit(1);
      setLastSession(sResult.length > 0 ? sResult[0] : null);

      // Incomplete session from AsyncStorage
      const sessionJson = await AsyncStorage.getItem(INCOMPLETE_SESSION_KEY);
      setIncompleteSession(sessionJson ? JSON.parse(sessionJson) : null);
    } catch (e) {
      logger.error('Failed to fetch session data', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAllSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await db.select().from(sessions)
        .where(isNull(sessions.deletedAt))
        .orderBy(desc(sessions.startTime));
      setAllSessions(result);
    } catch (e) {
      logger.error('Failed to fetch sessions', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getSessionsByDate = useCallback((dateStr: string): Session[] => {
    return allSessions.filter(s => {
      if (!s.startTime) return false;
      const sDate = new Date(s.startTime).toISOString().split('T')[0];
      return sDate === dateStr;
    });
  }, [allSessions]);

  const clearIncompleteSession = useCallback(async () => {
    await AsyncStorage.removeItem(INCOMPLETE_SESSION_KEY);
    setIncompleteSession(null);
  }, []);

  return {
    lastSession,
    incompleteSession,
    allSessions,
    isLoading,
    fetchHomeData,
    fetchAllSessions,
    getSessionsByDate,
    clearIncompleteSession,
  };
}
