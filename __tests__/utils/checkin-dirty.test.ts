import { isCheckinDirty, CheckinFormState } from '../../src/utils/checkin-dirty';

describe('isCheckinDirty', () => {
  const cleanState: CheckinFormState = {
    photos: { front: null, back: null, side: null },
    monthlyData: { waist: '', armRight: '', thighRight: '', chest: '', calf: '' },
    photoNotes: { front: '', back: '', side: '' },
  };

  it('returns false for empty/initial state', () => {
    expect(isCheckinDirty(cleanState)).toBe(false);
  });

  it('returns true when a photo is selected', () => {
    const state: CheckinFormState = {
      ...cleanState,
      photos: { front: 'file:///photos/front.jpg', back: null, side: null },
    };
    expect(isCheckinDirty(state)).toBe(true);
  });

  it('returns true when a measurement is filled', () => {
    const state: CheckinFormState = {
      ...cleanState,
      monthlyData: { ...cleanState.monthlyData, waist: '85.5' },
    };
    expect(isCheckinDirty(state)).toBe(true);
  });

  it('returns false when measurement is only whitespace', () => {
    const state: CheckinFormState = {
      ...cleanState,
      monthlyData: { ...cleanState.monthlyData, waist: '   ' },
    };
    expect(isCheckinDirty(state)).toBe(false);
  });

  it('returns true when a photo note is filled', () => {
    const state: CheckinFormState = {
      ...cleanState,
      photoNotes: { front: 'Looking good', back: '', side: '' },
    };
    expect(isCheckinDirty(state)).toBe(true);
  });

  it('returns true when all three photos are selected', () => {
    const state: CheckinFormState = {
      ...cleanState,
      photos: {
        front: 'file:///photos/front.jpg',
        back: 'file:///photos/back.jpg',
        side: 'file:///photos/side.jpg',
      },
    };
    expect(isCheckinDirty(state)).toBe(true);
  });

  it('returns true when multiple measurements are filled', () => {
    const state: CheckinFormState = {
      ...cleanState,
      monthlyData: { waist: '85', chest: '105', armRight: '38', thighRight: '', calf: '' },
    };
    expect(isCheckinDirty(state)).toBe(true);
  });
});
