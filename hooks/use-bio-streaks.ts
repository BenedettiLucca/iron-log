import { useState, useEffect } from 'react';
import { db } from '@/db/client';
import { bodyMetrics } from '@/db/schema';
import { desc, gte, lte, and, sql } from 'drizzle-orm';

export interface StreakData {
  currentDailyStreak: number;
  longestDailyStreak: number;
  currentMonthlyStreak: number;
  lastCheckinDate: number | null;
  totalCheckins: number;
  averageWeight: number;
}

/**
 * Calculate and track bio check-in streaks
 */
export function useBioStreaks() {
  const [streaks, setStreaks] = useState<StreakData>({
    currentDailyStreak: 0,
    longestDailyStreak: 0,
    currentMonthlyStreak: 0,
    lastCheckinDate: null,
    totalCheckins: 0,
    averageWeight: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateStreaks();
  }, []);

  const calculateStreaks = async () => {
    try {
      setLoading(true);

      // Get all metrics, ordered by date
      const allMetrics = await db
        .select()
        .from(bodyMetrics)
        .orderBy(desc(bodyMetrics.date));

      if (allMetrics.length === 0) {
        setStreaks({
          currentDailyStreak: 0,
          longestDailyStreak: 0,
          currentMonthlyStreak: 0,
          lastCheckinDate: null,
          totalCheckins: 0,
          averageWeight: 0,
        });
        return;
      }

      // Calculate total check-ins
      const totalCheckins = allMetrics.length;

      // Calculate average weight (from entries that have weight)
      const weightsWithValues = allMetrics.filter((m) => m.weight !== null && m.weight !== undefined);
      const averageWeight =
        weightsWithValues.length > 0
          ? weightsWithValues.reduce((sum, m) => sum + (m.weight || 0), 0) / weightsWithValues.length
          : 0;

      // Get last check-in date
      const lastCheckinDate = allMetrics[0].date;

      // Calculate daily streaks
      const dailyStreaks = calculateDailyStreaks(allMetrics);
      const currentDailyStreak = dailyStreaks.current;
      const longestDailyStreak = dailyStreaks.longest;

      // Calculate monthly streaks
      const monthlyStreaks = calculateMonthlyStreaks(allMetrics);
      const currentMonthlyStreak = monthlyStreaks.current;

      setStreaks({
        currentDailyStreak,
        longestDailyStreak,
        currentMonthlyStreak,
        lastCheckinDate,
        totalCheckins,
        averageWeight,
      });
    } catch (error) {
      console.error('Error calculating streaks:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    streaks,
    loading,
    refresh: calculateStreaks,
  };
}

/**
 * Calculate daily streaks (consecutive days with entries)
 */
function calculateDailyStreaks(metrics: any[]) {
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Group metrics by date (day)
  const datesByDay = new Map<number, boolean>();

  metrics.forEach((metric) => {
    const date = new Date(metric.date);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    datesByDay.set(dayStart, true);
  });

  // Sort dates descending
  const sortedDates = Array.from(datesByDay.keys()).sort((a, b) => b - a);

  // Calculate current streak
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;

  if (sortedDates.length > 0) {
    const latestDate = sortedDates[0];

    // Check if streak is still active (latest entry is today or yesterday)
    if (latestDate === today || latestDate === yesterday) {
      currentStreak = 1;

      // Count consecutive days going backwards
      for (let i = 0; i < sortedDates.length - 1; i++) {
        const currentDate = sortedDates[i];
        const nextDate = sortedDates[i + 1];
        const dayDiff = (currentDate - nextDate) / (24 * 60 * 60 * 1000);

        if (dayDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  // Calculate longest streak
  tempStreak = 1;
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const currentDate = sortedDates[i];
    const nextDate = sortedDates[i + 1];
    const dayDiff = (currentDate - nextDate) / (24 * 60 * 60 * 1000);

    if (dayDiff === 1) {
      tempStreak++;
    } else {
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      tempStreak = 1;
    }
  }

  // Final check
  if (tempStreak > longestStreak) {
    longestStreak = tempStreak;
  }

  return {
    current: currentStreak,
    longest: longestStreak,
  };
}

/**
 * Calculate monthly streaks (consecutive months with at least one check-in)
 */
function calculateMonthlyStreaks(metrics: any[]) {
  let currentStreak = 0;

  // Group by month
  const monthsSet = new Set<string>();

  metrics.forEach((metric) => {
    const date = new Date(metric.date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    monthsSet.add(monthKey);
  });

  // Sort months descending
  const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

  // Calculate current streak
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  if (sortedMonths.length > 0) {
    const latestMonth = sortedMonths[0];

    // Check if streak is still active
    const latestDate = new Date(latestMonth);
    const currentDate = new Date(currentMonthKey);
    const monthDiff =
      (currentDate.getFullYear() - latestDate.getFullYear()) * 12 +
      (currentDate.getMonth() - latestDate.getMonth());

    if (monthDiff <= 1) {
      // Current month or previous month has entries
      currentStreak = 1;

      // Count consecutive months going backwards
      for (let i = 0; i < sortedMonths.length - 1; i++) {
        const currentMonth = sortedMonths[i];
        const nextMonth = sortedMonths[i + 1];

        const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
        const [nextYear, nextMonthNum] = nextMonth.split('-').map(Number);

        const monthDiffCalc = (currentYear - nextYear) * 12 + (currentMonthNum - nextMonthNum);

        if (monthDiffCalc === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  return {
    current: currentStreak,
  };
}
