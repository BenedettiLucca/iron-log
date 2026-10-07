import {
  isAlexandriaDate,
  nutritionValueSchema,
  sleepValueSchema,
  fetchDailyNutrition,
  fetchDailySleep,
  AlexandriaInboundConfig,
} from '@/services/alexandria-inbound';

// =============================================================================
// Helpers
// =============================================================================

const mockFetch = jest.fn();

function installJsonResponse(body: unknown, status = 200, contentType = 'application/json') {
  mockFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response);
}

function installNetworkError(error: unknown) {
  mockFetch.mockRejectedValue(error);
}

const CONFIG: AlexandriaInboundConfig = {
  baseUrl: 'http://alexandria.local',
  accessKey: 'test-access-key',
  clientId: 'iron-log-test',
};

// Verified health_entries nutrition `value` shape (import_health_connect.py NUTRITION_CONFIG)
const NUTRITION_FIXTURE = {
  energy_kcal: 2456.5,
  protein: 182.3,
  fat_total: 88.0,
  carbs_total: 221.4,
  fiber: 24.1,
  sugar: 52.0,
  sodium: 2400,
  caffeine: 120,
};

const NUTRITION_RESPONSE = { date: '2026-10-05', value: NUTRITION_FIXTURE };

const SLEEP_RESPONSE = { date: '2026-10-05', value: { duration_s: 28800, sessions: 1 } };

// =============================================================================
// Date validation (parity with Alexandria's dateRegex /^\d{4}-\d{2}-\d{2}$/)
// =============================================================================

describe('isAlexandriaDate', () => {
  it('accepts a YYYY-MM-DD date', () => {
    expect(isAlexandriaDate('2026-10-05')).toBe(true);
  });

  it('rejects non-zero-padded dates', () => {
    expect(isAlexandriaDate('2026-1-5')).toBe(false);
  });

  it('rejects slash-separated dates', () => {
    expect(isAlexandriaDate('2026/10/05')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isAlexandriaDate('')).toBe(false);
  });
});

// =============================================================================
// Raw verified value schemas (health_entries row parsing)
// =============================================================================

describe('nutritionValueSchema (verified health_entries value shape)', () => {
  it('validates a full nutrition value', () => {
    const result = nutritionValueSchema.safeParse(NUTRITION_FIXTURE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.energy_kcal).toBe(2456.5);
      expect(result.data.protein).toBe(182.3);
    }
  });

  it('accepts energy-only values (macros optional)', () => {
    const result = nutritionValueSchema.safeParse({ energy_kcal: 2100.25 });
    expect(result.success).toBe(true);
  });

  it('rejects values without energy_kcal', () => {
    const result = nutritionValueSchema.safeParse({ protein: 100 });
    expect(result.success).toBe(false);
  });

  it('rejects negative energy_kcal', () => {
    const result = nutritionValueSchema.safeParse({ energy_kcal: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects string macro values', () => {
    const result = nutritionValueSchema.safeParse({ energy_kcal: 2000, protein: 'high' });
    expect(result.success).toBe(false);
  });
});

describe('sleepValueSchema (verified duration in seconds)', () => {
  it('validates a sleep value with duration and sessions', () => {
    const result = sleepValueSchema.safeParse({ duration_s: 28800, sessions: 1 });
    expect(result.success).toBe(true);
  });

  it('rejects negative duration_s', () => {
    const result = sleepValueSchema.safeParse({ duration_s: -5 });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// fetchDailyNutrition
// =============================================================================

describe('fetchDailyNutrition', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('fetches the daily nutrition endpoint and returns normalized ok data', async () => {
    installJsonResponse(NUTRITION_RESPONSE);

    const result = await fetchDailyNutrition(CONFIG, '2026-10-05');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://alexandria.local/api/v1/health/nutrition?date=2026-10-05');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${CONFIG.accessKey}`,
      Accept: 'application/json',
      'x-alexandria-client': 'iron-log-test',
    });

    expect(result).toMatchObject({
      status: 'ok',
      data: {
        date: '2026-10-05',
        energyKcal: 2456.5,
        protein: 182.3,
        carbs: 221.4,
        fat: 88.0,
        fiber: 24.1,
        sugar: 52.0,
        sodium: 2400,
        caffeine: 120,
      },
    });
  });

  it('normalizes a baseUrl with a trailing slash (no double slash in the URL)', async () => {
    installJsonResponse(NUTRITION_RESPONSE);

    const result = await fetchDailyNutrition(
      { ...CONFIG, baseUrl: 'http://alexandria.local/' },
      '2026-10-05',
    );

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://alexandria.local/api/v1/health/nutrition?date=2026-10-05');
    expect(result).toMatchObject({ status: 'ok' });
  });

  it('returns ok with only calories when macros are absent', async () => {
    installJsonResponse({ date: '2026-10-05', value: { energy_kcal: 2100.25 } });

    const result = await fetchDailyNutrition(CONFIG, '2026-10-05');

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.energyKcal).toBe(2100.25);
      expect(result.data.protein).toBeUndefined();
    }
  });

  it('returns unavailable (no-data) on HTTP 404', async () => {
    installJsonResponse({ error: 'not found' }, 404);

    const result = await fetchDailyNutrition(CONFIG, '2026-10-05');

    expect(result).toMatchObject({ status: 'unavailable', reason: 'no-data' });
  });

  it('returns unavailable (no-data) when the payload has a null value', async () => {
    installJsonResponse({ date: '2026-10-05', value: null });

    const result = await fetchDailyNutrition(CONFIG, '2026-10-05');

    expect(result).toMatchObject({ status: 'unavailable', reason: 'no-data' });
  });

  it('never returns ok for auth failures (HTTP 401)', async () => {
    installJsonResponse({ error: 'unauthorized' }, 401);

    const result = await fetchDailyNutrition(CONFIG, '2026-10-05');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toMatch(/401/);
    }
  });

  it('returns error on HTTP 500', async () => {
    installJsonResponse({ error: 'boom' }, 500);

    const result = await fetchDailyNutrition(CONFIG, '2026-10-05');

    expect(result.status).toBe('error');
  });

  it('returns error on malformed nutrition payload (negative kcal)', async () => {
    installJsonResponse({ date: '2026-10-05', value: { energy_kcal: -10 } });

    const result = await fetchDailyNutrition(CONFIG, '2026-10-05');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toMatch(/malformed/);
    }
  });

  it('returns error when the response body is not valid JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON')),
    } as unknown as Response);

    const result = await fetchDailyNutrition(CONFIG, '2026-10-05');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toMatch(/malformed/);
    }
  });

  it('returns error on timeout (AbortError)', async () => {
    installNetworkError(Object.assign(new Error('aborted'), { name: 'AbortError' }));

    const result = await fetchDailyNutrition(CONFIG, '2026-10-05');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toMatch(/timed out/);
    }
  });

  it('does not fetch when the date is malformed', async () => {
    const result = await fetchDailyNutrition(CONFIG, '05-10-2026');

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });

  it('uses the configured timeout for the aborted fetch signal', async () => {
    installJsonResponse(NUTRITION_RESPONSE);

    await fetchDailyNutrition({ ...CONFIG, timeoutMs: 42 }, '2026-10-05');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeDefined();
    expect((init.signal as AbortSignal | undefined)?.aborted).toBe(false);
  });
});

// =============================================================================
// fetchDailySleep
// =============================================================================

describe('fetchDailySleep', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('fetches the daily sleep endpoint and returns normalized ok data', async () => {
    installJsonResponse(SLEEP_RESPONSE);

    const result = await fetchDailySleep(CONFIG, '2026-10-05');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://alexandria.local/api/v1/health/sleep?date=2026-10-05');

    expect(result).toMatchObject({
      status: 'ok',
      data: { date: '2026-10-05', durationSeconds: 28800, sessions: 1 },
    });
  });

  it('returns unavailable (no-data) on HTTP 404', async () => {
    installJsonResponse({ error: 'not found' }, 404);

    const result = await fetchDailySleep(CONFIG, '2026-10-05');

    expect(result).toMatchObject({ status: 'unavailable', reason: 'no-data' });
  });

  it('returns unavailable when the payload has a null value', async () => {
    installJsonResponse({ date: '2026-10-05', value: null });

    const result = await fetchDailySleep(CONFIG, '2026-10-05');

    expect(result).toMatchObject({ status: 'unavailable', reason: 'no-data' });
  });

  it('returns error on malformed sleep payload (negative duration)', async () => {
    installJsonResponse({ date: '2026-10-05', value: { duration_s: -5 } });

    const result = await fetchDailySleep(CONFIG, '2026-10-05');

    expect(result.status).toBe('error');
  });

  it('returns error on HTTP 500', async () => {
    installJsonResponse({ error: 'boom' }, 500);

    const result = await fetchDailySleep(CONFIG, '2026-10-05');

    expect(result.status).toBe('error');
  });
});