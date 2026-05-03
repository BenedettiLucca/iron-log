import { useState, useCallback } from 'react';
import { db } from '@/src/db/client';
import { supplements, supplementLogs } from '@/src/db/schema';
import { eq, and, desc, asc, gte, inArray } from 'drizzle-orm';
import { logger } from '@/services/logger';
import { Supplement, SupplementLog } from '@/src/types';

export function useSupplements() {
  const [items, setItems] = useState<Supplement[]>([]);
  const [todayLogs, setTodayLogs] = useState<SupplementLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getStartOfDay = (date: Date = new Date()) => {
    return new Date(date).setHours(0, 0, 0, 0);
  };

  const fetchSupplements = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await db
        .select()
        .from(supplements)
        .where(eq(supplements.isActive, true))
        .orderBy(asc(supplements.orderIndex)) as Supplement[];
      setItems(data || []);
    } catch (e) {
      logger.error('Failed to fetch supplements', e);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTodayLogs = useCallback(async () => {
    try {
      const today = getStartOfDay();
      const logs = await db
        .select()
        .from(supplementLogs)
        .where(eq(supplementLogs.date, today)) as SupplementLog[];
      setTodayLogs(logs || []);
    } catch (e) {
      logger.error('Failed to fetch today logs', e);
      setTodayLogs([]);
    }
  }, []);

  const toggleSupplement = useCallback(async (supplementId: number) => {
    try {
      const today = getStartOfDay();
      const existing = await db
        .select()
        .from(supplementLogs)
        .where(
          and(
            eq(supplementLogs.supplementId, supplementId),
            eq(supplementLogs.date, today)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .delete(supplementLogs)
          .where(eq(supplementLogs.id, existing[0].id));
      } else {
        await db.insert(supplementLogs).values({
          supplementId,
          date: today,
          takenAt: Date.now(),
        });
      }
      await fetchTodayLogs();
    } catch (e) {
      logger.error('Failed to toggle supplement', e);
    }
  }, [fetchTodayLogs]);

  const addSupplement = useCallback(async (supplement: Omit<Supplement, 'id'>) => {
    try {
      await db.insert(supplements).values(supplement);
      await fetchSupplements();
    } catch (e) {
      logger.error('Failed to add supplement', e);
    }
  }, [fetchSupplements]);

  const updateSupplement = useCallback(async (id: number, updates: Partial<Supplement>) => {
    try {
      await db.update(supplements).set(updates).where(eq(supplements.id, id));
      await fetchSupplements();
    } catch (e) {
      logger.error('Failed to update supplement', e);
    }
  }, [fetchSupplements]);

  const deleteSupplement = useCallback(async (id: number) => {
    try {
      await db.update(supplements).set({ isActive: false }).where(eq(supplements.id, id));
      await fetchSupplements();
    } catch (e) {
      logger.error('Failed to delete supplement', e);
    }
  }, [fetchSupplements]);

  const getStreak = useCallback(async (supplementId: number): Promise<number> => {
    try {
      const logs = await db
        .select()
        .from(supplementLogs)
        .where(eq(supplementLogs.supplementId, supplementId))
        .orderBy(desc(supplementLogs.date)) as SupplementLog[];

      if (logs.length === 0) return 0;

      let streak = 0;
      let currentDate = getStartOfDay();
      
      // Check if taken today
      const takenToday = logs.some(l => l.date === currentDate);
      
      if (!takenToday) {
        currentDate -= 86400000; // start checking from yesterday
      }

      for (let i = 0; i < 365; i++) {
        const found = logs.find(l => l.date === currentDate);
        if (found) {
          streak++;
          currentDate -= 86400000;
        } else {
          break;
        }
      }

      return streak;
    } catch (e) {
      logger.error('Failed to get streak', e);
      return 0;
    }
  }, []);

  const getAllStreaks = useCallback(async (supplementIds: number[]): Promise<Record<number, number>> => {
    try {
      const streaks: Record<number, number> = {};
      for (const id of supplementIds) {
        streaks[id] = 0;
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch last 30 days of logs for ALL supplements in one query
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startEpoch = thirtyDaysAgo.getTime();
      
      const logs = await db
        .select()
        .from(supplementLogs)
        .where(
          and(
            inArray(supplementLogs.supplementId, supplementIds),
            gte(supplementLogs.date, startEpoch)
          )
        )
        .orderBy(desc(supplementLogs.date)) as SupplementLog[];
      
      // Group logs by supplement
      const logsBySupplement = new Map<number, number[]>();
      for (const log of logs) {
        if (!logsBySupplement.has(log.supplementId)) {
          logsBySupplement.set(log.supplementId, []);
        }
        logsBySupplement.get(log.supplementId)!.push(log.date);
      }
      
      // Calculate streak for each supplement
      for (const id of supplementIds) {
        const dates = logsBySupplement.get(id) || [];
        const uniqueDays = [...new Set(dates.map(d => {
          const d2 = new Date(d);
          d2.setHours(0, 0, 0, 0);
          return d2.getTime();
        }))].sort((a, b) => b - a);
        
        if (uniqueDays.length === 0) {
          streaks[id] = 0;
          continue;
        }
        
        const msPerDay = 24 * 60 * 60 * 1000;
        let streak = 0;
        let expected = today.getTime();
        
        // Allow today or yesterday as start
        if (uniqueDays[0] >= expected - msPerDay) {
          streak = 1;
          expected = uniqueDays[0];
          for (let i = 1; i < uniqueDays.length; i++) {
            if (expected - uniqueDays[i] <= msPerDay) {
              streak++;
              expected = uniqueDays[i];
            } else {
              break;
            }
          }
        }
        streaks[id] = streak;
      }
      
      return streaks;
    } catch (e) {
      logger.error('Failed to get all streaks', e);
      return {};
    }
  }, []);

  const getWeeklyAdherence = useCallback(async (): Promise<Record<number, number>> => {
    try {
      const now = new Date();
      const oneWeekAgo = getStartOfDay(new Date(now.getTime() - 7 * 86400000));
      
      const logs = await db
        .select()
        .from(supplementLogs)
        .where(gte(supplementLogs.date, oneWeekAgo)) as SupplementLog[];

      const adherence: Record<number, number> = {};
      
      items.forEach(item => {
        const itemLogs = logs.filter(l => l.supplementId === item.id).length;
        // Calculation depends on frequency, but a simple 1 week = 7 days adherence
        // If frequency is 'daily', total possible is 7.
        // For simplicity and matching common patterns, we'll return % based on 7 days
        adherence[item.id] = Math.min(100, Math.round((itemLogs / 7) * 100));
      });

      return adherence;
    } catch (e) {
      logger.error('Failed to get weekly adherence', e);
      return {};
    }
  }, [items]);

  const seedDefaultSupplements = useCallback(async () => {
    try {
      const count = await db.select().from(supplements).limit(1);
      if (count.length === 0) {
        const defaultStack = [
          { name: 'Creatina Monohidratada', dosage: '5g', timing: 'qualquer hora', frequency: 'daily', reminderTime: '09:00', isNighttime: false, emoji: '💊', orderIndex: 0, isActive: true },
          { name: 'Cafeína + L-Theanine', dosage: '200mg + 100mg', timing: '30min antes do treino', frequency: 'training_days', reminderTime: null, isNighttime: false, emoji: '☕', orderIndex: 1, isActive: true },
          { name: 'Vitamina D3', dosage: '2000 UI', timing: 'após café da manhã', frequency: 'daily', reminderTime: '08:00', isNighttime: false, emoji: '☀️', orderIndex: 2, isActive: true },
          { name: 'Ômega 3 (EPA/DHA)', dosage: '1g', timing: 'com alguma refeição', frequency: 'daily', reminderTime: '12:00', isNighttime: false, emoji: '🐟', orderIndex: 3, isActive: true },
          { name: 'Magnésio Bisglicinato', dosage: '400mg', timing: 'antes de dormir', frequency: 'daily', reminderTime: '21:30', isNighttime: true, emoji: '🧪', orderIndex: 4, isActive: true },
          { name: 'Ashwagandha (KSM-66)', dosage: '300mg', timing: 'antes de dormir', frequency: 'daily', reminderTime: '21:30', isNighttime: true, emoji: '🌿', orderIndex: 5, isActive: true },
        ];
        
        for (const item of defaultStack) {
          await db.insert(supplements).values(item);
        }
        await fetchSupplements();
      }
    } catch (e) {
      logger.error('Failed to seed supplements', e);
    }
  }, [fetchSupplements]);

  return {
    items,
    todayLogs,
    isLoading,
    fetchSupplements,
    fetchTodayLogs,
    toggleSupplement,
    addSupplement,
    updateSupplement,
    deleteSupplement,
    getStreak,
    getAllStreaks,
    getWeeklyAdherence,
    seedDefaultSupplements,
  };
}
