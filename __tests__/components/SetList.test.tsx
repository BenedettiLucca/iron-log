import React from 'react';
import { render } from '@testing-library/react-native';
import { SetList } from '@/components/session/SetList';
import type { Set } from '@/src/types';

type ReducedMotionGlobal = {
  __setListReducedMotion: boolean;
};

const reducedMotionGlobal = globalThis as unknown as ReducedMotionGlobal;
reducedMotionGlobal.__setListReducedMotion = false;

jest.mock('@/hooks/use-reactive-reduced-motion', () => ({
  useReactiveReducedMotion: () =>
    (globalThis as unknown as ReducedMotionGlobal).__setListReducedMotion,
}));

jest.mock('@/components/SectionHeader', () => ({
  SectionHeader: 'SectionHeader',
}));

jest.mock('@/components/SetCard', () => ({
  __esModule: true,
  default: 'SetCard',
}));

jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));

jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));

jest.mock('react-native/Libraries/StyleSheet/StyleSheet', () => ({
  __esModule: true,
  default: { flatten: (style: unknown) => style ?? {} },
}));

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  type FlatListProps = {
    data: Set[];
    renderItem: (info: { item: Set; index: number }) => React.ReactNode;
    keyExtractor: (item: Set, index: number) => string;
    ListEmptyComponent?: React.ReactNode;
  };

  function FlatList({ data, renderItem, keyExtractor, ListEmptyComponent }: FlatListProps) {
    if (data.length === 0) return ListEmptyComponent ?? null;
    return ReactActual.createElement(
      ReactActual.Fragment,
      null,
      data.map((item, index) =>
        ReactActual.createElement(
          ReactActual.Fragment,
          { key: keyExtractor(item, index) },
          renderItem({ item, index }),
        ),
      ),
    );
  }

  return { __esModule: true, default: FlatList };
});

const makeSet = (overrides: Partial<Set> = {}): Set => ({
  id: 1,
  sessionId: 10,
  exerciseId: 20,
  exerciseName: 'Agachamento',
  setNumber: 1,
  weightKg: 80,
  reps: 8,
  durationSeconds: null,
  rir: 2,
  isWarmup: false,
  isEdited: false,
  createdAt: 1,
  deletedAt: null,
  ...overrides,
});

const t = (key: string) => key;
const handleEditSet = jest.fn();
const handleDeleteSet = jest.fn();

const props = (sessionSets: Set[], hasLoadedSessionSets: boolean) => ({
  sessionSets,
  hasLoadedSessionSets,
  t,
  handleEditSet,
  handleDeleteSet,
});

const animationBySetNumber = (
  result: ReturnType<typeof render>,
): Map<number, boolean> => new Map(
  result.UNSAFE_getAllByType('SetCard' as never).map(card => [
    card.props.setNumber as number,
    card.props.animateEntry as boolean,
  ]),
);

describe('SetList local entry animation', () => {
  beforeEach(() => {
    reducedMotionGlobal.__setListReducedMotion = false;
  });

  it('suppresses hydration, animates only inserted/edited sets once, and avoids replay', () => {
    const first = makeSet();
    const initial = [first];
    const result = render(<SetList {...props(initial, false)} />);

    expect(animationBySetNumber(result)).toEqual(new Map([[1, false]]));

    result.rerender(<SetList {...props(initial, true)} />);
    expect(animationBySetNumber(result)).toEqual(new Map([[1, false]]));

    const inserted = [first, makeSet({ id: 2, setNumber: 2 })];
    result.rerender(<SetList {...props(inserted, true)} />);
    expect(animationBySetNumber(result)).toEqual(new Map([
      [1, false],
      [2, true],
    ]));

    result.rerender(<SetList {...props(inserted, true)} />);
    expect(animationBySetNumber(result)).toEqual(new Map([
      [1, false],
      [2, false],
    ]));

    const edited = [
      makeSet({ weightKg: 82, isEdited: true }),
      inserted[1],
    ];
    result.rerender(<SetList {...props(edited, true)} />);
    expect(animationBySetNumber(result)).toEqual(new Map([
      [1, true],
      [2, false],
    ]));
  });

  it('suppresses an otherwise eligible insertion when Reduce Motion is enabled', () => {
    const first = makeSet();
    const result = render(<SetList {...props([first], false)} />);
    result.rerender(<SetList {...props([first], true)} />);

    reducedMotionGlobal.__setListReducedMotion = true;
    const inserted = [first, makeSet({ id: 2, setNumber: 2 })];
    result.rerender(<SetList {...props(inserted, true)} />);

    expect(animationBySetNumber(result)).toEqual(new Map([
      [1, false],
      [2, false],
    ]));
  });
});
