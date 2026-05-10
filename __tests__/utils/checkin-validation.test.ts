import {
  validateMonthlyCheckin,
  buildCheckinEntryData,
  strictMonthlyCheckinSchema,
  getMonthlyCheckinDateRange,
  resolveCurrentMonthCheckin,
} from '../../src/utils/checkin-validation';

describe('validateMonthlyCheckin', () => {
  it('accepts all empty strings — nothing provided', () => {
    const result = validateMonthlyCheckin({
      waist: '', armRight: '', thighRight: '', chest: '', calf: '',
    });
    expect(result.success).toBe(true);
    expect(result.data?.waist).toBeUndefined();
    expect(result.data?.armRight).toBeUndefined();
    expect(result.data?.thighRight).toBeUndefined();
    expect(result.data?.chest).toBeUndefined();
    expect(result.data?.calf).toBeUndefined();
  });

  it('accepts valid numeric strings', () => {
    const result = validateMonthlyCheckin({
      waist: '85.5', armRight: '38', thighRight: '60', chest: '105', calf: '40',
    });
    expect(result.success).toBe(true);
    expect(result.data?.waist).toBe(85.5);
    expect(result.data?.armRight).toBe(38);
    expect(result.data?.thighRight).toBe(60);
    expect(result.data?.chest).toBe(105);
    expect(result.data?.calf).toBe(40);
  });

  it('rejects negative values', () => {
    const result = validateMonthlyCheckin({
      waist: '-5', armRight: '', thighRight: '', chest: '', calf: '',
    });
    expect(result.success).toBe(false);
    expect(result.errors?.waist).toBeDefined();
  });

  it('rejects values exceeding max', () => {
    const result = validateMonthlyCheckin({
      waist: '', armRight: '', thighRight: '', chest: '', calf: '1000',
    });
    expect(result.success).toBe(false);
    expect(result.errors?.calf).toBeDefined();
  });

  it('rejects non-numeric strings', () => {
    const result = validateMonthlyCheckin({
      waist: 'abc', armRight: '', thighRight: '', chest: '', calf: '',
    });
    expect(result.success).toBe(false);
    expect(result.errors?.waist).toBeDefined();
  });

  it('treats whitespace-only strings as not provided', () => {
    const result = validateMonthlyCheckin({
      waist: '   ', armRight: '  ', thighRight: '', chest: '\t', calf: ' \n ',
    });
    expect(result.success).toBe(true);
    expect(result.data?.waist).toBeUndefined();
    expect(result.data?.calf).toBeUndefined();
  });

  it('accepts partial data — only waist provided', () => {
    const result = validateMonthlyCheckin({
      waist: '90', armRight: '', thighRight: '', chest: '', calf: '',
    });
    expect(result.success).toBe(true);
    expect(result.data?.waist).toBe(90);
    expect(result.data?.armRight).toBeUndefined();
  });

  it('accepts zero as an intentional measurement', () => {
    const result = validateMonthlyCheckin({
      waist: '0', armRight: '', thighRight: '', chest: '', calf: '',
    });
    expect(result.success).toBe(true);
    expect(result.data?.waist).toBe(0);
  });
});

describe('buildCheckinEntryData', () => {
  it('uses validated values over existing DB values', () => {
    const entry = buildCheckinEntryData({
      validated: { waist: 90, armRight: undefined, thighRight: 60, chest: undefined, calf: undefined },
      existingData: { waist: 85, armRight: 35, thighRight: 55, chest: 100, calf: 38 },
      photos: { front: 'photo.jpg', back: null, side: null },
      photoNotes: { front: 'good', back: '', side: '' },
      weight: 95,
      date: 1234567890,
    });

    expect(entry.waist).toBe(90);
    expect(entry.armRight).toBe(35); // fallback to existing
    expect(entry.thighRight).toBe(60); // validated overrides
    expect(entry.chest).toBe(100); // fallback to existing
    expect(entry.photoFront).toBe('photo.jpg');
    expect(entry.photoBack).toBeNull();
  });

  it('falls back to 0 when no existing data and no validated value', () => {
    const entry = buildCheckinEntryData({
      validated: { waist: undefined, armRight: undefined, thighRight: undefined, chest: undefined, calf: undefined },
      photos: { front: null, back: null, side: null },
      photoNotes: { front: '', back: '', side: '' },
      weight: 80,
      date: 1234567890,
    });

    expect(entry.waist).toBe(0);
    expect(entry.armRight).toBe(0);
    expect(entry.photoFront).toBeNull();
  });
});

describe('monthly check-in current-month resolution', () => {
  it('includes check-ins saved on the last day of the month', () => {
    const reference = new Date(2026, 4, 31, 12, 0, 0).getTime(); // May 31 local
    const lastDayEntry = { id: 31, date: new Date(2026, 4, 31, 23, 59, 59, 999).getTime() };

    const range = getMonthlyCheckinDateRange(reference);
    const current = resolveCurrentMonthCheckin([lastDayEntry], reference);

    expect(lastDayEntry.date).toBeGreaterThanOrEqual(range.startOfMonth);
    expect(lastDayEntry.date).toBeLessThan(range.startOfNextMonth);
    expect(current?.id).toBe(31);
  });

  it('includes the exact start of month and excludes the exact start of next month', () => {
    const reference = new Date(2026, 4, 15, 12, 0, 0).getTime(); // May 2026
    const range = getMonthlyCheckinDateRange(reference);
    const startEntry = { id: 1, date: range.startOfMonth };
    const nextMonthEntry = { id: 2, date: range.startOfNextMonth };

    const current = resolveCurrentMonthCheckin([nextMonthEntry, startEntry], reference);

    expect(current?.id).toBe(1);
  });

  it('does not treat the previous month check-in as existing data for a new month', () => {
    const reference = new Date(2026, 5, 1, 9, 0, 0).getTime(); // Jun 1 local
    const previousMonthEntry = {
      id: 10,
      date: new Date(2026, 4, 31, 12, 0, 0).getTime(),
      weight: 96,
      waist: 90,
      armRight: 40,
      thighRight: 62,
      chest: 110,
      calf: 43,
      photoFront: 'may-front.jpg',
      photoBack: 'may-back.jpg',
      photoSide: 'may-side.jpg',
    };

    const currentMonthEntry = resolveCurrentMonthCheckin([previousMonthEntry], reference);
    const entry = buildCheckinEntryData({
      validated: { waist: undefined, armRight: undefined, thighRight: undefined, chest: undefined, calf: undefined },
      existingData: currentMonthEntry,
      photos: { front: null, back: null, side: null },
      photoNotes: { front: '', back: '', side: '' },
      weight: 0,
      date: reference,
    });

    expect(currentMonthEntry).toBeUndefined();
    expect(entry.waist).toBe(0);
    expect(entry.armRight).toBe(0);
    expect(entry.photoFront).toBeNull();
    expect(entry.photoBack).toBeNull();
    expect(entry.photoSide).toBeNull();
  });
});

describe('strictMonthlyCheckinSchema', () => {
  it('does NOT coerce empty string to 0', () => {
    // This is the core regression test — old schema did Number('') === 0
    const result = strictMonthlyCheckinSchema.safeParse({ waist: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.waist).toBeUndefined();
    }
  });
});
