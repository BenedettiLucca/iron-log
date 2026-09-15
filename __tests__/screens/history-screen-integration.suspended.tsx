import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HistoryScreen from '@/app/(tabs)/history';
(global as typeof globalThis & { React: typeof React }).React = React;
import { db, sqlite } from '../fixtures/database';
import { sessions, sets, exercises } from '@/src/db/schema';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

let mockParams: { date?: string } = {};
const mockRouterPush = jest.fn();

jest.mock('react-native', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Platform: {
      OS: 'android',
      select: (options: Record<string, unknown>) => options['android'] ?? options.default,
    },
    View: (props: any) => ReactActual.createElement('View', props, props.children),
    Text: (props: any) => ReactActual.createElement('Text', props, props.children),
    TextInput: (props: any) => ReactActual.createElement('TextInput', props),
    TouchableOpacity: (props: any) => ReactActual.createElement('TouchableOpacity', props, props.children),
    Pressable: (props: any) => ReactActual.createElement('Pressable', props, props.children),
    ActivityIndicator: (props: any) => ReactActual.createElement('ActivityIndicator', props),
    RefreshControl: (props: any) => ReactActual.createElement('RefreshControl', props),
    FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }: any) => {
      return ReactActual.createElement(
        'FlatList',
        null,
        typeof ListHeaderComponent === 'function' ? ListHeaderComponent() : ListHeaderComponent,
        (!data || data.length === 0)
          ? (typeof ListEmptyComponent === 'function' ? ListEmptyComponent() : ListEmptyComponent)
          : data.map((item: any, index: number) => (renderItem ? renderItem({ item, index }) : null)),
        typeof ListFooterComponent === 'function' ? ListFooterComponent() : ListFooterComponent
      );
    },
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
  Stack: { Screen: jest.fn() },
}));

jest.mock('react-native-calendars', () => {
  const React = require('react');
  return {
    Calendar: (props: any) => React.createElement('Calendar', props),
    LocaleConfig: { locales: {}, defaultLocale: 'pt' },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/Dialog', () => ({
  Dialog: (props: any) => React.createElement('Dialog', props),
}));

jest.mock('@/components/DatePicker', () => ({
  DatePicker: (props: any) => React.createElement('DatePicker', props),
}));

jest.mock('@/components/Toast', () => ({
  Toast: (props: any) => React.createElement('Toast', props),
}));

jest.mock('@/components/Skeleton', () => ({
  SkeletonList: (props: any) => React.createElement('SkeletonList', props),
}));

jest.mock('@/components/ScreenState', () => ({
  ErrorState: (props: any) => React.createElement('ErrorState', props),
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

jest.mock('@/src/i18n/index', () => {
  const actual = jest.requireActual('@/src/i18n/index');
  const stableT = (key: string, vars?: Record<string, string | number>) => actual.translate(key, vars, 'pt');
  return {
    ...actual,
    useI18n: () => ({
      t: stableT,
      language: 'pt',
    }),
  };
});

  describe('HistoryScreen component integration', () => {
    beforeEach(() => {
      mockParams = {};
      jest.clearAllMocks();
    });

    it('renders calendar mode by default with unselected day prompt', async () => {
      const screen = render(React.createElement(HistoryScreen));
      process.stdout.write('RENDER JSON: ' + JSON.stringify(screen.toJSON()) + '\n');
      expect(await screen.findByText('Selecione um dia para ver seus treinos')).toBeTruthy();
    });

    it('consumes validated date param on navigation, opening the day and loading its sessions', async () => {
      mockParams = { date: '2026-06-15' };
      const jun15 = new Date(2026, 5, 15, 10, 0).getTime();

      db.insert(sessions).values([
        { id: 99, routineName: 'Navigated Workout', startTime: jun15, durationMinutes: 60, deletedAt: null },
      ]).run();

      const { findByText } = render(React.createElement(HistoryScreen));
      expect(await findByText('Navigated Workout')).toBeTruthy();
    });

    it('gracefully ignores invalid date param and stays in unselected state', async () => {
      mockParams = { date: '2026-02-31' }; // invalid calendar date

      const { findByText, queryByText } = render(React.createElement(HistoryScreen));
      expect(await findByText('Selecione um dia para ver seus treinos')).toBeTruthy();
      expect(queryByText('Navigated Workout')).toBeNull();
    });

    it('filters sessions by search query and shows clearable chip', async () => {
      const d1 = new Date(2026, 5, 1, 10, 0).getTime();
      const d2 = new Date(2026, 5, 2, 10, 0).getTime();

      db.insert(sessions).values([
        { id: 1, routineName: 'Treino Força A', startTime: d1, deletedAt: null },
        { id: 2, routineName: 'Cardio Leve', startTime: d2, deletedAt: null },
      ]).run();

      const { findByPlaceholderText, findByText, queryByText } = render(React.createElement(HistoryScreen));
      const input = await findByPlaceholderText('Buscar rotina ou exercício...');

      fireEvent.changeText(input, 'Força');

      expect(await findByText('Treino Força A')).toBeTruthy();
      expect(queryByText('Cardio Leve')).toBeNull();
      expect(await findByText('"Força"')).toBeTruthy();

      // Clear filters
      const clearBtn = await findByText('Limpar filtros');
      fireEvent.press(clearBtn);

      // Returns to calendar mode
      expect(await findByText('Selecione um dia para ver seus treinos')).toBeTruthy();
    });
});
