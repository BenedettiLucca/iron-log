import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { withTiming } from 'react-native-reanimated';
import { SegmentedControl } from '@/components/SegmentedControl';

(global as typeof globalThis & { React: typeof React }).React = React;

jest.mock('react-native/Libraries/StyleSheet/StyleSheet', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (!style) return {};
    if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
    return typeof style === 'object' ? (style as Record<string, unknown>) : {};
  };

  return {
    __esModule: true,
    default: {
      create: (styles: Record<string, unknown>) => styles,
      flatten,
    },
  };
});

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({
  __esModule: true,
  default: 'Pressable',
}));
jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));
jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));

let mockReducedMotion = false;

jest.mock('@/hooks/use-reactive-reduced-motion', () => ({
  useReactiveReducedMotion: () => mockReducedMotion,
}));

const mockWithTiming = withTiming as jest.MockedFunction<typeof withTiming>;

const segments = [
  { key: 'daily', label: 'Diário' },
  { key: 'training', label: 'Dias de Treino' },
  { key: 'rest', label: 'Dias de Descanso' },
];

describe('SegmentedControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion = false;
  });

  it('exposes a tablist with selected tab semantics and >=44dp targets', () => {
    const { UNSAFE_getAllByType } = render(
      <SegmentedControl segments={segments} activeKey="training" onSelect={jest.fn()} />
    );

    const tablist = UNSAFE_getAllByType('View' as any).find(
      (node) => node.props.accessibilityRole === 'tablist'
    );
    const tabs = UNSAFE_getAllByType('Pressable' as any);

    expect(tablist).toBeDefined();
    expect(tablist?.props.className).toContain('items-stretch');
    expect(tabs).toHaveLength(3);
    expect(tabs.map((tab) => tab.props.accessibilityRole)).toEqual(['tab', 'tab', 'tab']);
    expect(tabs.map((tab) => tab.props.accessibilityState)).toEqual([
      { selected: false },
      { selected: true },
      { selected: false },
    ]);
    tabs.forEach((tab) => {
      expect(tab.props.className).toContain('min-h-[44px]');
      expect(tab.props.className).toContain('min-w-0');
    });
  });

  it('wraps long translated labels adaptively without changing their accessible copy', () => {
    const longSegments = [
      { key: 'daily', label: 'Diario' },
      { key: 'training', label: 'Días de Entrenamiento' },
      { key: 'rest', label: 'Días de Descanso' },
    ];
    const { UNSAFE_getAllByType } = render(
      <SegmentedControl segments={longSegments} activeKey="daily" onSelect={jest.fn()} />
    );

    const labels = UNSAFE_getAllByType('Text' as any);
    const renderedLabels = labels.map((label) => String(label.props.children));
    expect(renderedLabels.map((label) => label.replaceAll('\u200B', ''))).toEqual(
      longSegments.map(({ label }) => label)
    );
    expect(renderedLabels[1]).toContain('\u200B');
    expect(renderedLabels[1].split(' ').pop()?.split('\u200B')).toEqual(
      Array.from('Entrenamiento')
    );

    labels.forEach((label) => {
      expect(label.props.numberOfLines).toBeUndefined();
      expect(label.props.ellipsizeMode).toBeUndefined();
      expect(label.props.className).toContain('text-center');
      expect(label.props.className).toContain('w-full');
      expect(label.props.className).toContain('shrink');
    });

    expect(
      UNSAFE_getAllByType('Pressable' as any).map((tab) => tab.props.accessibilityLabel)
    ).toEqual(longSegments.map(({ label }) => label));
  });

  it('keeps four evolution tabs equal-width and makes long words breakable', () => {
    const evolutionSegments = [
      { key: 'weight', label: 'WEIGHT' },
      { key: 'measures', label: 'MEASUREMENTS' },
      { key: 'photos', label: 'PHOTOS' },
      { key: 'analysis', label: 'ANALYSIS' },
    ];
    const { UNSAFE_getAllByType } = render(
      <SegmentedControl
        segments={evolutionSegments}
        activeKey="weight"
        onSelect={jest.fn()}
      />
    );

    const tabs = UNSAFE_getAllByType('Pressable' as any);
    const labels = UNSAFE_getAllByType('Text' as any).map((label) => String(label.props.children));

    expect(tabs).toHaveLength(4);
    tabs.forEach((tab) => {
      expect(tab.props.className).toContain('flex-1');
      expect(tab.props.className).toContain('min-w-0');
    });
    expect(labels[1].split('\u200B')).toEqual(Array.from('MEASUREMENTS'));
    expect(labels[1].replaceAll('\u200B', '')).toBe('MEASUREMENTS');
  });

  it('selects only inactive tabs', () => {
    const onSelect = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <SegmentedControl segments={segments} activeKey="daily" onSelect={onSelect} />
    );
    const tabs = UNSAFE_getAllByType('Pressable' as any);

    fireEvent.press(tabs[0]);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.press(tabs[2]);
    expect(onSelect).toHaveBeenCalledWith('rest');
  });

  it('animates the old and new selected indicators with restrained timing', () => {
    const { rerender } = render(
      <SegmentedControl segments={segments} activeKey="daily" onSelect={jest.fn()} />
    );
    mockWithTiming.mockClear();

    rerender(
      <SegmentedControl segments={segments} activeKey="training" onSelect={jest.fn()} />
    );

    expect(mockWithTiming).toHaveBeenCalledWith(0, { duration: 160 });
    expect(mockWithTiming).toHaveBeenCalledWith(1, { duration: 160 });
  });

  it('updates indicators instantly when Reduce Motion changes while mounted', () => {
    const result = render(
      <SegmentedControl segments={segments} activeKey="daily" onSelect={jest.fn()} />
    );
    mockWithTiming.mockClear();

    mockReducedMotion = true;
    result.rerender(
      <SegmentedControl segments={segments} activeKey="training" onSelect={jest.fn()} />
    );

    expect(result.UNSAFE_getByProps({ testID: 'segment-indicator-training' })).toBeTruthy();
    expect(mockWithTiming).not.toHaveBeenCalled();
  });
});
