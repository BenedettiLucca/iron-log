import type { TrackerType } from './types';

/**
 * Parses CSV raw text into rows and columns, handling quotes and multi-line fields.
 */
export function parseCsvRows(content: string): string[][] {
  const cleanContent = content.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < cleanContent.length) {
    const char = cleanContent[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < cleanContent.length && cleanContent[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < cleanContent.length && cleanContent[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses CSV text into an object with headers and row records.
 */
export function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const allRows = parseCsvRows(content);
  if (allRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = allRows[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < allRows.length; r++) {
    const row = allRows[r];
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const headerKey = headers[c];
      record[headerKey] = row[c] !== undefined ? row[c].trim() : '';
    }
    rows.push(record);
  }

  return { headers, rows };
}

/**
 * Detects the tracker format by inspecting the headers.
 */
export function detectTracker(csvOrHeaders: string | string[]): TrackerType | null {
  let headerList: string[];
  if (typeof csvOrHeaders === 'string') {
    const parsed = parseCsv(csvOrHeaders);
    headerList = parsed.headers;
  } else {
    headerList = csvOrHeaders;
  }

  const lowerHeaders = headerList.map((h) => h.toLowerCase().trim());

  // Strong CSV signature
  if (
    lowerHeaders.includes('workout name') ||
    (lowerHeaders.includes('set order') && lowerHeaders.includes('exercise name'))
  ) {
    return 'strong';
  }

  // Hevy CSV signature
  if (
    lowerHeaders.includes('exercise_title') ||
    lowerHeaders.includes('set_type') ||
    lowerHeaders.includes('set_index') ||
    (lowerHeaders.includes('start_time') && lowerHeaders.includes('end_time'))
  ) {
    return 'hevy';
  }

  // FitNotes CSV signature
  if (
    lowerHeaders.includes('category') ||
    lowerHeaders.some((h) => h.includes('weight (kgs)') || h.includes('weight (lbs)')) ||
    (lowerHeaders.includes('exercise') && lowerHeaders.includes('date') && lowerHeaders.includes('reps'))
  ) {
    return 'fitnotes';
  }

  return null;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parses various date representations into epoch milliseconds.
 */
export function parseDateToTimestamp(rawDate: string): number {
  if (!rawDate || !rawDate.trim()) return Date.now();
  const trimmed = rawDate.trim();

  // Pattern: "14 Jan 2024, 08:30" or "14 Jan 2024 08:30:00" or "14 Jan 2024"
  const textMonthMatch = trimmed.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i
  );
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const monthStr = textMonthMatch[2].slice(0, 3).toLowerCase();
    const year = parseInt(textMonthMatch[3], 10);
    const hour = textMonthMatch[4] ? parseInt(textMonthMatch[4], 10) : 12;
    const min = textMonthMatch[5] ? parseInt(textMonthMatch[5], 10) : 0;
    const sec = textMonthMatch[6] ? parseInt(textMonthMatch[6], 10) : 0;
    const month = MONTH_NAMES[monthStr] ?? 0;
    return new Date(year, month, day, hour, min, sec).getTime();
  }

  // Pattern: "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm" or "YYYY-MM-DD"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 12;
    const min = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const sec = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec).getTime();
  }

  // Pattern: "DD/MM/YYYY HH:mm:ss" or "DD/MM/YYYY"
  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec).getTime();
  }

  // Fallback to Date.parse
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) return parsed;

  return Date.now();
}

/**
 * Parses duration strings (e.g. "1h 15m", "45m", "01:15:00", "90s") to total minutes.
 */
export function parseDurationToMinutes(durationStr: string): number | null {
  if (!durationStr || !durationStr.trim()) return null;
  const str = durationStr.trim().toLowerCase();

  let totalMinutes = 0;
  let hasMatch = false;

  const hoursMatch = str.match(/(\d+)\s*h/);
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
    hasMatch = true;
  }
  const minsMatch = str.match(/(\d+)\s*m/);
  if (minsMatch) {
    totalMinutes += parseInt(minsMatch[1], 10);
    hasMatch = true;
  }
  const secsMatch = str.match(/(\d+)\s*s/);
  if (secsMatch) {
    totalMinutes += Math.round(parseInt(secsMatch[1], 10) / 60);
    hasMatch = true;
  }

  if (hasMatch) return totalMinutes > 0 ? totalMinutes : 1;

  // Pattern "HH:MM:SS" or "MM:SS"
  const timeParts = str.split(':').map((p) => parseInt(p, 10));
  if (timeParts.length === 3 && !timeParts.some(isNaN)) {
    return timeParts[0] * 60 + timeParts[1] + Math.round(timeParts[2] / 60);
  }
  if (timeParts.length === 2 && !timeParts.some(isNaN)) {
    return timeParts[0] + Math.round(timeParts[1] / 60);
  }

  const num = parseFloat(str);
  if (!isNaN(num)) {
    return num > 300 ? Math.round(num / 60) : Math.round(num);
  }

  return null;
}

/**
 * Parses duration strings (e.g. "60", "01:30", "00:01:30", "1m 30s") to seconds.
 */
export function parseDurationToSeconds(timeStr: string): number | null {
  if (!timeStr || !timeStr.trim()) return null;
  const str = timeStr.trim().toLowerCase();

  let totalSecs = 0;
  let hasMatch = false;
  const hoursMatch = str.match(/(\d+)\s*h/);
  if (hoursMatch) {
    totalSecs += parseInt(hoursMatch[1], 10) * 3600;
    hasMatch = true;
  }
  const minsMatch = str.match(/(\d+)\s*m/);
  if (minsMatch) {
    totalSecs += parseInt(minsMatch[1], 10) * 60;
    hasMatch = true;
  }
  const secsMatch = str.match(/(\d+)\s*s/);
  if (secsMatch) {
    totalSecs += parseInt(secsMatch[1], 10);
    hasMatch = true;
  }
  if (hasMatch) return totalSecs;

  const timeParts = str.split(':').map((p) => parseInt(p, 10));
  if (timeParts.length === 3 && !timeParts.some(isNaN)) {
    return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
  }
  if (timeParts.length === 2 && !timeParts.some(isNaN)) {
    return timeParts[0] * 60 + timeParts[1];
  }

  const num = parseFloat(str);
  if (!isNaN(num)) return Math.round(num);

  return null;
}

/**
 * Converts RPE (1-10) to RIR (0-10).
 */
export function rpeToRir(rpe: number | string | undefined | null): number | null {
  if (rpe === undefined || rpe === null || rpe === '') return null;
  const val = typeof rpe === 'number' ? rpe : parseFloat(rpe);
  if (isNaN(val) || val <= 0 || val > 10) return null;
  return Math.max(0, Math.min(10, Math.round(10 - val)));
}
