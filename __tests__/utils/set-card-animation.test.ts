import {
  buildSetAnimationSignatures,
  getAnimatedSetIds,
  type SetAnimationData,
} from '../../src/utils/set-card-animation';

const set = (overrides: Partial<SetAnimationData> = {}): SetAnimationData => ({
  id: 1,
  setNumber: 1,
  weightKg: 80,
  reps: 8,
  durationSeconds: null,
  rir: 2,
  isWarmup: false,
  isEdited: false,
  ...overrides,
});

describe('set card animation selection', () => {
  it('does not animate unchanged or merely reordered sets', () => {
    const previous = buildSetAnimationSignatures([set(), set({ id: 2, setNumber: 2 })]);
    const current = buildSetAnimationSignatures([set({ id: 2, setNumber: 2 }), set()]);

    expect([...getAnimatedSetIds(previous, current)]).toEqual([]);
  });

  it('animates only newly inserted and visibly changed sets', () => {
    const previous = buildSetAnimationSignatures([set(), set({ id: 2, setNumber: 2 })]);
    const current = buildSetAnimationSignatures([
      set(),
      set({ id: 2, setNumber: 2, weightKg: 82.5, isEdited: true }),
      set({ id: 3, setNumber: 3 }),
    ]);

    expect([...getAnimatedSetIds(previous, current)]).toEqual([2, 3]);
  });
});
