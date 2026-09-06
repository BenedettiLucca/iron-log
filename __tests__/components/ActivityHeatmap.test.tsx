import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { ActivityHeatmapService, DailyActivityBucket } from '@/services/ActivityHeatmapService';

(global as typeof globalThis & { React: typeof React }).React = React;

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const platform = {
    OS: 'android',
    select: (options: Record<string, unknown>) => options[platform.OS] ?? options.default,
  };
  return { __esModule: true, default: platform };
});

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
jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => ({
  __esModule: true,
  default: (props: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('TouchableOpacity', props, props.children),
}));
jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: (props: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('View', props, props.children),
}));
jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: (props: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('Text', props, props.children),
}));
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => ({
  __esModule: true,
  default: (props: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('ScrollView', props, props.children),
}));

jest.mock('@/src/db/client', () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    primary: '#9E422E',
    primaryText: '#9E422E',
    background: '#1D1917',
    text: '#F5EBE6',
    subtext: '#A89F91',
    border: '#3D3430',
  }),
}));

jest.mock('@/src/i18n/index', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      if (key === 'bioAnalytics.activityHeatmap') return 'Atividade Anual';
      if (key === 'bioAnalytics.heatmapTotalWorkouts') return `${vars?.count} treinos`;
      if (key === 'bioAnalytics.heatmapActiveDays') return `${vars?.count} dias ativos`;
      if (key === 'bioAnalytics.heatmapTotalHours') return `${vars?.hours}h ${vars?.minutes}m`;
      if (key === 'bioAnalytics.heatmapSubtitle') return 'Treinos nos últimos 365 dias';
      if (key === 'bioAnalytics.heatmapLess') return 'Menos';
      if (key === 'bioAnalytics.heatmapMore') return 'Mais';
      if (key === 'bioAnalytics.heatmapNoWorkouts') return 'Nenhum treino';
      if (key === 'bioAnalytics.heatmapDayA11y')
        return `${vars?.date}: ${vars?.sessions} treinos, ${vars?.minutes} min`;
      if (key === 'bioAnalytics.heatmapDayEmptyA11y') return `${vars?.date}: sem treinos`;
      return key;
    },
    language: 'pt',
  }),
  getLocaleForLanguage: () => 'pt-BR',
}));

describe('ActivityHeatmap component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleData: DailyActivityBucket[] = [
    { date: '2026-06-01', minutes: 45, sessions: 1 },
    { date: '2026-06-02', minutes: 75, sessions: 2 },
    { date: '2026-06-03', minutes: 0, sessions: 0 },
  ];

  it('renders heatmap header and summary with provided data', () => {
    const { getByText } = render(<ActivityHeatmap data={sampleData} />);

    expect(getByText('Atividade Anual')).toBeTruthy();
    expect(getByText('3 treinos')).toBeTruthy();
    expect(getByText('2 dias ativos')).toBeTruthy();
    expect(getByText('2h 0m')).toBeTruthy();
  });

  it('fetches data using ActivityHeatmapService when no data prop is provided', async () => {
    jest.spyOn(ActivityHeatmapService, 'getDailyActivity').mockResolvedValueOnce(sampleData);

    const { getByText } = render(<ActivityHeatmap />);

    await waitFor(() => {
      expect(ActivityHeatmapService.getDailyActivity).toHaveBeenCalled();
      expect(getByText('3 treinos')).toBeTruthy();
    });
  });

  it('triggers onDayPress callback when a cell is clicked', () => {
    const onDayPressMock = jest.fn();
    const { getByLabelText } = render(
      <ActivityHeatmap data={sampleData} onDayPress={onDayPressMock} />
    );

    const cell = getByLabelText('2026-06-01: 1 treinos, 45 min');
    expect(cell).toBeTruthy();

    fireEvent.press(cell);

    expect(onDayPressMock).toHaveBeenCalledWith('2026-06-01', {
      date: '2026-06-01',
      minutes: 45,
      sessions: 1,
    });
  });

  it('navigates to history on session cell press when no onDayPress is provided', () => {
    const { getByLabelText } = render(<ActivityHeatmap data={sampleData} />);

    const cell = getByLabelText('2026-06-02: 2 treinos, 75 min');
    fireEvent.press(cell);

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/history');
  });

  it('displays selected day details in UI when clicked', () => {
    const { getByLabelText, getByText } = render(<ActivityHeatmap data={sampleData} />);

    const cell = getByLabelText('2026-06-01: 1 treinos, 45 min');
    fireEvent.press(cell);

    expect(getByText('2026-06-01')).toBeTruthy();
  });

  it('renders legend items correctly', () => {
    const { getByText } = render(<ActivityHeatmap data={sampleData} />);
    expect(getByText('Menos')).toBeTruthy();
    expect(getByText('Mais')).toBeTruthy();
  });
});
