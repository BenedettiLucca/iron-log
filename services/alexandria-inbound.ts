import { z } from 'zod';

/**
 * Alexandria inbound adapter — read-only daily nutrition / sleep signals.
 *
 * The real Alexandria service (https://github.com/owner/alexandria) is an MCP
 * server (Deno + Hono, `@hono/mcp`, Streamable HTTP) fronted by Bearer auth
 * (`MCP_ACCESS_KEY`). This client speaks to the *proposed* REST surface
 * documented in `docs/plans/il70-72-alexandria-contract.md` (UNVERIFIED
 * endpoints, see Uxx notes there).
 *
 * The value schemas below match the VERIFIED `health_entries` row shape:
 *   - nutrition:  entry_type='nutrition', value JSONB {energy_kcal, protein,
 *     fat_total, carbs_total, fiber, sugar, sodium, caffeine} — produced by
 *     importers/health-connect/import_health_connect.py (NUTRITION_CONFIG)
 *   - sleep:      entry_type='sleep', duration_s INTEGER (seconds).
 *
 * Results are explicit union states; a missing/no-data signal is never
 * silently treated as a green default.
 */

export const ALEXANDRIA_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Matches Alexandria's dateRegex (`/^\d{4}-\d{2}-\d{2}$/`). */
export function isAlexandriaDate(date: string): boolean {
  return ALEXANDRIA_DATE_REGEX.test(date);
}

/** Default request timeout (ms) — aligns with PROVIDER_TOTAL_DEADLINE_MS=8000 on the Alexandria side. */
const DEFAULT_TIMEOUT_MS = 8000;

// =============================================================================
// Value schemas (VERIFIED against health_entries rows)
// =============================================================================

/** Verified `health_entries.value` shape for entry_type='nutrition' (kcal k/v: energy|calories|energy_total). */
export const nutritionValueSchema = z.object({
  energy_kcal: z.number().nonnegative().finite(),
  protein: z.number().nonnegative().finite().optional(),
  fat_total: z.number().nonnegative().finite().optional(),
  carbs_total: z.number().nonnegative().finite().optional(),
  fiber: z.number().nonnegative().finite().optional(),
  sugar: z.number().nonnegative().finite().optional(),
  sodium: z.number().nonnegative().finite().optional(),
  caffeine: z.number().nonnegative().finite().optional(),
});
export type NutritionValue = z.infer<typeof nutritionValueSchema>;

/** Verified `health_entries` sleep shape: duration_s in seconds (compute_daily_summary sums it). */
export const sleepValueSchema = z.object({
  duration_s: z.number().nonnegative().finite(),
  sessions: z.number().nonnegative().int().optional(),
});
export type SleepValue = z.infer<typeof sleepValueSchema>;

// =============================================================================
// Payload schemas (UNVERIFIED envelope — contract doc U04)
// =============================================================================

const alexandriaDateSchema = z.string().regex(ALEXANDRIA_DATE_REGEX);

const dailyNutritionPayloadSchema = z.object({
  date: alexandriaDateSchema,
  value: nutritionValueSchema.nullable(),
});

const dailySleepPayloadSchema = z.object({
  date: alexandriaDateSchema,
  value: sleepValueSchema.nullable(),
});

// =============================================================================
// Public types
// =============================================================================

export interface AlexandriaInboundConfig {
  /** Base URL of the Alexandria HTTP endpoint, e.g. http://alexandria.local. */
  baseUrl: string;
  /** Bearer token (maps to MCP_ACCESS_KEY on the server). */
  accessKey: string;
  /** Client identity header `x-alexandria-client`. */
  clientId?: string;
  /** Request timeout in ms (default 8000). */
  timeoutMs?: number;
}

export interface DailyNutrition {
  date: string;
  energyKcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  caffeine?: number;
}

export interface SleepSignal {
  date: string;
  durationSeconds: number;
  sessions?: number;
}

export type AlexandriaInboundResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unavailable'; reason: 'no-data' }
  | { status: 'error'; error: string };

// =============================================================================
// Normalization
// =============================================================================

function toDailyNutrition(date: string, value: NutritionValue): DailyNutrition {
  const nutrition: DailyNutrition = {
    date,
    energyKcal: value.energy_kcal,
    ...(value.protein !== undefined && { protein: value.protein }),
    ...(value.carbs_total !== undefined && { carbs: value.carbs_total }),
    ...(value.fat_total !== undefined && { fat: value.fat_total }),
    ...(value.fiber !== undefined && { fiber: value.fiber }),
    ...(value.sugar !== undefined && { sugar: value.sugar }),
    ...(value.sodium !== undefined && { sodium: value.sodium }),
    ...(value.caffeine !== undefined && { caffeine: value.caffeine }),
  };
  return nutrition;
}

function toSleepSignal(date: string, value: SleepValue): SleepSignal {
  const sleep: SleepSignal = {
    date,
    durationSeconds: value.duration_s,
    ...(value.sessions !== undefined && { sessions: value.sessions }),
  };
  return sleep;
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// =============================================================================
// Shared request path
// =============================================================================

type BodyParser<T> = (body: unknown) => T | null;

async function requestDaily<T>(
  config: AlexandriaInboundConfig,
  endpoint: string,
  date: string,
  parseBody: BodyParser<T>,
): Promise<AlexandriaInboundResult<T>> {
  if (!isAlexandriaDate(date)) {
    return {
      status: 'error',
      error: `alexandria ${endpoint}: invalid date "${date}" (expected YYYY-MM-DD)`,
    };
  }

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.accessKey}`,
      Accept: 'application/json',
    };
    if (config.clientId !== undefined) {
      headers['x-alexandria-client'] = config.clientId;
    }

    const cleanBase = config.baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}${endpoint}?date=${encodeURIComponent(date)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 'error',
          error: `alexandria ${endpoint} timed out after ${timeoutMs}ms`,
        };
      }
      return {
        status: 'error',
        error: `alexandria ${endpoint} request failed: ${describeError(error)}`,
      };
    }

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        return { status: 'unavailable', reason: 'no-data' };
      }
      return {
        status: 'error',
        error: `alexandria ${endpoint} responded with HTTP ${response.status}`,
      };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      return {
        status: 'error',
        error: `alexandria ${endpoint} response is malformed: not valid JSON (${describeError(error)})`,
      };
    }

    try {
      const data = parseBody(body);
      if (data === null) {
        return { status: 'unavailable', reason: 'no-data' };
      }
      return { status: 'ok', data };
    } catch (error) {
      return {
        status: 'error',
        error: `alexandria ${endpoint} response is malformed: ${describeError(error)}`,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

// =============================================================================
// Daily queries
// =============================================================================

function parseNutritionBody(body: unknown): DailyNutrition | null {
  const parsed = dailyNutritionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  const { date, value } = parsed.data;
  if (value === null) {
    return null;
  }
  return toDailyNutrition(date, value);
}

/**
 * Fetch daily calorie/macro intake for `date` (YYYY-MM-DD).
 * Endpoint: PROPOSED (contract doc U04) — GET {baseUrl}/api/v1/health/nutrition?date=...
 */
export async function fetchDailyNutrition(
  config: AlexandriaInboundConfig,
  date: string,
): Promise<AlexandriaInboundResult<DailyNutrition>> {
  return requestDaily(config, '/api/v1/health/nutrition', date, parseNutritionBody);
}

function parseSleepBody(body: unknown): SleepSignal | null {
  const parsed = dailySleepPayloadSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  const { date, value } = parsed.data;
  if (value === null) {
    return null;
  }
  return toSleepSignal(date, value);
}

/**
 * Fetch daily sleep signal for `date` (YYYY-MM-DD); duration in seconds.
 * Endpoint: PROPOSED (contract doc U04) — GET {baseUrl}/api/v1/health/sleep?date=...
 */
export async function fetchDailySleep(
  config: AlexandriaInboundConfig,
  date: string,
): Promise<AlexandriaInboundResult<SleepSignal>> {
  return requestDaily(config, '/api/v1/health/sleep', date, parseSleepBody);
}