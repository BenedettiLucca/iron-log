import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, waitFor } from '@testing-library/react-native';
import ProgramDetailScreen from '@/app/programs/detail';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mockFetchProgramDetails = jest.fn();
const mockFetchDashboardData = jest.fn();

jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));

jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));

jest.mock('@/components/Toast', () => ({ Toast: () => null }));
jest.mock('@/components/Card', () => ({ Card: ({ children }: { children?: React.ReactNode }) => children }));
jest.mock('@/components/Button', () => ({ Button: () => null }));
jest.mock('@/components/Dialog', () => ({ Dialog: () => null }));
jest.mock('@/components/SectionHeader', () => ({ SectionHeader: () => null }));
jest.mock('@/components/StatTile', () => ({ StatTile: () => null }));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: () => null,
  Polyline: () => null,
}));

jest.mock('expo-router', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
    useLocalSearchParams: () => ({ programId: '1' }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback]);
    },
  };
});

jest.mock('@/hooks/use-programs', () => ({
  usePrograms: () => {
    const ReactModule = jest.requireActual<typeof import('react')>('react');
    const [activeProgram, setActiveProgram] = ReactModule.useState<{
      id: number;
      name: string;
    } | null>(null);

    const fetchProgramDetails = ReactModule.useCallback(async (programId: number) => {
      mockFetchProgramDetails(programId);
      setActiveProgram({ id: programId, name: 'Forge' });
    }, []);

    // This identity intentionally changes with activeProgram, matching the real hook.
    const fetchDashboardData = ReactModule.useCallback(async () => {
      mockFetchDashboardData(activeProgram?.id ?? null);
    }, [activeProgram]);

    return {
      activeProgram,
      weeks: [],
      targets: [],
      isLoading: true,
      detailError: null,
      fetchProgramDetails,
      deleteProgram: jest.fn(),
      getCurrentWeek: jest.fn(() => null),
      getWeeksUntilDeload: jest.fn(() => null),
      getCurrentPhase: jest.fn(() => null),
      weekCompletionMap: new Map(),
      fetchDashboardData,
    };
  },
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({ primaryText: '#9E422E' }),
}));

jest.mock('@/src/i18n/index', () => ({
  useI18n: () => ({ t: (key: string) => key, language: 'pt' }),
  getLocaleForLanguage: () => 'pt-BR',
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: { visible: false, message: '', type: 'info' }, setToast: jest.fn() }),
}));

jest.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => ({
    dialog: { visible: false, title: '', message: '', onConfirm: jest.fn() },
    setDialog: jest.fn(),
  }),
}));

const source = fs.readFileSync(
  path.resolve(__dirname, '../../app/programs/detail.tsx'),
  'utf8'
);

describe('Program detail effect lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the focused program once and then fetches its dashboard without re-entering', async () => {
    render(<ProgramDetailScreen />);

    await waitFor(() => {
      expect(mockFetchProgramDetails).toHaveBeenCalledTimes(1);
      expect(mockFetchProgramDetails).toHaveBeenCalledWith(1);
      expect(mockFetchDashboardData).toHaveBeenCalledTimes(1);
      expect(mockFetchDashboardData).toHaveBeenCalledWith(1);
    });

    expect(mockFetchProgramDetails).toHaveBeenCalledTimes(1);
  });

  it('keeps the identity-changing dashboard callback out of the focus dependency cycle', () => {
    const focusEffect = source.match(
      /useFocusEffect\(\s*useCallback\(\(\) => \{([\s\S]*?)\}, \[([^\]]+)\]\)\s*\);/
    );

    expect(focusEffect).not.toBeNull();
    expect(focusEffect?.[1]).toContain('fetchProgramDetails(programIdNum)');
    expect(focusEffect?.[1]).not.toContain('fetchDashboardData');
    expect(focusEffect?.[2]).not.toContain('fetchDashboardData');
  });
});
