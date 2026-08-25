import React from 'react';
import { render } from '@testing-library/react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { ProgressBar } from '@/components/ProgressBar';

(global as typeof globalThis & { React: typeof React }).React = React;

jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));
jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({ primary: '#9E422E' }),
}));

jest.mock('@/src/i18n/index', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      if (key === 'common.progress') return 'Progresso';
      if (key === 'common.progressCount') return `${vars?.current} de ${vars?.total}`;
      return key;
    },
  }),
}));

let mockReducedMotion = false;

jest.mock('@/hooks/use-reactive-reduced-motion', () => ({
  useReactiveReducedMotion: () => mockReducedMotion,
}));

const mockUseSharedValue = useSharedValue as jest.Mock;
const mockWithTiming = withTiming as jest.Mock;

function getHostNodes(result: ReturnType<typeof render>) {
  const views = result.UNSAFE_getAllByType('View' as any);
  const container = views[0];
  const root = views.find((view) => view.props.accessibilityRole === 'progressbar');
  const fill = views.find((view) => view.props.testID === 'progress-fill');
  const labels = result.UNSAFE_queryAllByType('Text' as any);
  return { container, root, fill, labels };
}

describe('ProgressBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion = false;
  });

  it('exposes localized progress semantics and a percentage value', () => {
    const result = render(<ProgressBar current={2} total={5} />);
    const { root, labels } = getHostNodes(result);

    expect(root?.props.accessibilityLabel).toBe('Progresso');
    expect(root?.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 40,
      text: '2 de 5',
    });
    expect(labels).toHaveLength(1);
    expect(labels[0].props.children).toBe('2 de 5');
    expect(labels[0].props.className).not.toContain('uppercase');
  });

  it('honors custom visual and accessible labels, including compact bars', () => {
    const result = render(
      <ProgressBar
        current={1}
        total={4}
        variant="compact"
        label="1 de 4 exercícios"
        accessibilityLabel="Exercícios concluídos"
      />
    );
    const { root, labels } = getHostNodes(result);

    expect(labels).toHaveLength(1);
    expect(labels[0].props.children).toBe('1 de 4 exercícios');
    expect(root?.props.accessibilityLabel).toBe('Exercícios concluídos');
    expect(root?.props.accessibilityValue.text).toBe('1 de 4 exercícios');
  });

  it('keeps compact progress accessible when the visual label is hidden', () => {
    const result = render(
      <ProgressBar current={3} total={4} variant="compact" showLabel={false} />
    );
    const { root, labels } = getHostNodes(result);

    expect(labels).toHaveLength(0);
    expect(root?.props.accessibilityValue.text).toBe('3 de 4');
  });

  it('can be explicitly decorative inside an accessible parent', () => {
    const result = render(
      <ProgressBar current={3} total={4} showLabel={false} isAccessible={false} />
    );
    const { container, root } = getHostNodes(result);

    expect(root).toBeUndefined();
    expect(container.props.accessible).toBe(false);
    expect(container.props.accessibilityElementsHidden).toBe(true);
    expect(container.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(container.props.accessibilityValue).toBeUndefined();
  });

  it('clamps overflow, negative and invalid values', () => {
    const result = render(<ProgressBar current={12} total={10} />);
    let { root } = getHostNodes(result);
    expect(root?.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100, text: '10 de 10' });

    result.rerender(<ProgressBar current={-3} total={10} />);
    ({ root } = getHostNodes(result));
    expect(root?.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 0, text: '0 de 10' });

    result.rerender(<ProgressBar current={Number.NaN} total={0} />);
    ({ root } = getHostNodes(result));
    expect(root?.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 0, text: '0 de 0' });

    const invalidCases: [number, number, string][] = [
      [Number.POSITIVE_INFINITY, 10, '0 de 10'],
      [5, Number.POSITIVE_INFINITY, '0 de 0'],
      [5, Number.NaN, '0 de 0'],
      [5, -2, '0 de 0'],
    ];

    invalidCases.forEach(([current, total, text]) => {
      result.rerender(<ProgressBar current={current} total={total} />);
      ({ root } = getHostNodes(result));
      expect(root?.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 0, text });
    });
  });

  it('animates scale updates on the UI thread instead of animating width', () => {
    const result = render(<ProgressBar current={1} total={4} />);
    const { fill } = getHostNodes(result);

    expect(mockWithTiming).toHaveBeenCalledWith(0.25, { duration: 300 });
    const fillStyle = Object.assign(
      {},
      ...(Array.isArray(fill?.props.style) ? fill.props.style : [fill?.props.style])
    );
    expect(fillStyle).toEqual(
      expect.objectContaining({
        backgroundColor: '#9E422E',
        width: '100%',
        height: 6,
        transformOrigin: 'left center',
        transform: [{ scaleX: 0 }],
      })
    );
    expect(fill?.props.className).toBeUndefined();

    mockWithTiming.mockClear();
    result.rerender(<ProgressBar current={3} total={4} />);
    expect(mockWithTiming).toHaveBeenCalledWith(0.75, { duration: 300 });
  });

  it('updates instantly when Reduce Motion changes while mounted', () => {
    const result = render(<ProgressBar current={1} total={4} />);
    mockWithTiming.mockClear();

    mockReducedMotion = true;
    result.rerender(<ProgressBar current={2} total={4} />);
    const { fill } = getHostNodes(result);

    expect(fill).toBeDefined();
    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(mockUseSharedValue.mock.results[0].value.value).toBe(0.5);
  });
});
