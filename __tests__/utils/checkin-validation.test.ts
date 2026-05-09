import {
  validateMonthlyCheckin,
  buildCheckinEntryData,
  strictMonthlyCheckinSchema,
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
