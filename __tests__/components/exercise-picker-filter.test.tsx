import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { I18nProvider } from '@/src/i18n';
import {
  normalize,
  deriveEquipmentKey,
  getAvailableEquipments,
  filterExercisesByEquipmentAndSearch,
} from '@/src/utils/exercise-filter';
import { ExercisePickerModal } from '@/app/routines/editor';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mockExercises = [
  {
    id: 1,
    name: 'Supino Reto',
    equipment: 'barra',
    type: 'strength' as const,
    muscle_group: 'chest',
    default_rest_seconds: 90,
  },
  {
    id: 2,
    name: 'Supino com Halteres',
    equipment: 'halteres',
    type: 'strength' as const,
    muscle_group: 'chest',
    default_rest_seconds: 90,
  },
  {
    id: 3,
    name: 'Flexão de Braço',
    equipment: null,
    type: 'strength' as const,
    muscle_group: 'chest',
    default_rest_seconds: 60,
  },
  {
    id: 4,
    name: 'Barra Fixa',
    equipment: null,
    type: 'strength' as const,
    muscle_group: 'back',
    default_rest_seconds: 90,
  },
  {
    id: 5,
    name: 'Desenvolvimento Máquina',
    equipment: null,
    type: 'strength' as const,
    muscle_group: 'shoulders',
    default_rest_seconds: 90,
  },
  {
    id: 6,
    name: 'Puxada com Barra',
    equipment: null,
    type: 'strength' as const,
    muscle_group: 'back',
    default_rest_seconds: 90,
  },
  {
    id: 7,
    name: 'Elevação Lateral',
    equipment: 'halteres',
    type: 'strength' as const,
    muscle_group: 'shoulders',
    default_rest_seconds: 60,
  },
];

// Mock database & live query
jest.mock('@/src/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        all: () => mockExercises,
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: 99, name: 'Novo Exercício' }]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  },
}));

jest.mock('../../src/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        all: () => mockExercises,
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: 99, name: 'Novo Exercício' }]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  },
}));

jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: () => ({
    data: mockExercises,
    error: null,
    updatedAt: 1,
  }),
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

jest.mock('@/components/Toast', () => ({
  Toast: () => null,
}));
jest.mock('../../components/Toast', () => ({
  Toast: () => null,
}));

jest.mock('@/hooks/use-reactive-reduced-motion', () => ({
  useReactiveReducedMotion: () => false,
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    onPrimary: '#F4F1DE',
    secondaryText: '#3D5A80',
    onDanger: '#F4F1DE',
    subtext: '#686878',
    onSuccess: '#1D1917',
    primary: '#9E422E',
    border: '#D6CFB8',
  }),
}));

jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const platform = {
    OS: 'android',
    select: (options: Record<string, unknown>) => options[platform.OS] ?? options.default,
  };
  return { __esModule: true, default: platform };
});

jest.mock('react-native/Libraries/StyleSheet/StyleSheet', () => ({
  __esModule: true,
  default: {
    create: (styles: Record<string, unknown>) => styles,
    flatten: (style: unknown) =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style,
  },
}));

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({
  __esModule: true,
  default: 'Pressable',
}));

jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => ({
  __esModule: true,
  default: 'TouchableOpacity',
}));

jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));

jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));

jest.mock('react-native/Libraries/Components/TextInput/TextInput', () => ({
  __esModule: true,
  default: 'TextInput',
}));

jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => ({
  __esModule: true,
  default: 'ScrollView',
}));

jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  __esModule: true,
  default: { dismiss: jest.fn() },
}));

jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => ({
  __esModule: true,
  default: 'KeyboardAvoidingView',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ children, visible, ...props }: any) => {
      if (!visible) return null;
      return ReactActual.createElement('Modal', { visible, ...props }, children);
    },
  };
});

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ data, renderItem, ListEmptyComponent, keyExtractor }: any) => {
      if (!data || data.length === 0) {
        return typeof ListEmptyComponent === 'function'
          ? ReactActual.createElement(ListEmptyComponent)
          : (ListEmptyComponent ?? null);
      }
      return ReactActual.createElement(
        'FlatList',
        null,
        data.map((item: any, index: number) =>
          ReactActual.createElement(
            ReactActual.Fragment,
            { key: keyExtractor ? keyExtractor(item, index) : item.id ?? index },
            renderItem({ item, index })
          )
        )
      );
    },
  };
});

describe('exercise-filter utils', () => {
  it('normalizes accents and casing correctly', () => {
    expect(normalize('Máquina')).toBe('maquina');
    expect(normalize('Elevação')).toBe('elevacao');
    expect(normalize('EXTENSÃO')).toBe('extensao');
    expect(normalize('Flexão de Braço')).toBe('flexao de braco');
    expect(normalize('')).toBe('');
  });

  it('derives equipment key with column value precedence and name heuristics with accents for null column', () => {
    // Column values take precedence
    expect(deriveEquipmentKey({ name: 'Exercício Qualquer', equipment: 'barra' })).toBe('barra');
    expect(deriveEquipmentKey({ name: 'Barra Fixa', equipment: 'halteres' })).toBe('halteres');
    expect(deriveEquipmentKey({ name: 'Outro', equipment: 'other' })).toBe('other');

    // Heuristics for null equipment (including accented Portuguese names)
    expect(deriveEquipmentKey({ name: 'Flexão de Braço', equipment: null })).toBe('peso_corporal');
    expect(deriveEquipmentKey({ name: 'Barra Fixa', equipment: null })).toBe('peso_corporal');
    expect(deriveEquipmentKey({ name: 'Desenvolvimento Máquina', equipment: null })).toBe('maquina');
    expect(deriveEquipmentKey({ name: 'Puxada na Máquina', equipment: null })).toBe('maquina');
    expect(deriveEquipmentKey({ name: 'Elevação Lateral com Halteres', equipment: null })).toBe('halteres');
    expect(deriveEquipmentKey({ name: 'Puxada com Barra', equipment: null })).toBe('barra');
    expect(deriveEquipmentKey({ name: 'Extensão com Elástico', equipment: null })).toBe('elastico');
    expect(deriveEquipmentKey({ name: 'Crossover no Cabo', equipment: null })).toBe('cabos');
    expect(deriveEquipmentKey({ name: 'Kettlebell Swing', equipment: null })).toBe('kettlebell');
    expect(deriveEquipmentKey({ name: 'Corrida Livre', equipment: null })).toBeNull();
  });

  it('collects distinct available equipments preserving presence', () => {
    const available = getAvailableEquipments(mockExercises);
    expect(available).toContain('barra');
    expect(available).toContain('halteres');
    expect(available).toContain('peso_corporal');
    expect(available).toContain('maquina');
  });

  it('filters exercises by equipment and search correctly with accents', () => {
    // "all" shows all
    const all = filterExercisesByEquipmentAndSearch(mockExercises, 'all', '');
    expect(all).toHaveLength(mockExercises.length);

    // "barra" filters barra only (including explicit and heuristic, but NOT Barra Fixa which is peso_corporal)
    const barraOnly = filterExercisesByEquipmentAndSearch(mockExercises, 'barra', '');
    const barraNames = barraOnly.map((e) => e.name);
    expect(barraNames).toContain('Supino Reto');
    expect(barraNames).toContain('Puxada com Barra');
    expect(barraNames).not.toContain('Barra Fixa');
    expect(barraNames).not.toContain('Supino com Halteres');

    // Accent-insensitive search
    const accentedSearch = filterExercisesByEquipmentAndSearch(mockExercises, 'all', 'elevacao');
    expect(accentedSearch.map((e) => e.name)).toEqual(['Elevação Lateral']);

    const accentedSearch2 = filterExercisesByEquipmentAndSearch(mockExercises, 'all', 'elevação');
    expect(accentedSearch2.map((e) => e.name)).toEqual(['Elevação Lateral']);

    // Combination of equipment and search
    const combo = filterExercisesByEquipmentAndSearch(mockExercises, 'barra', 'puxada');
    expect(combo.map((e) => e.name)).toEqual(['Puxada com Barra']);
  });

  it('proves that inverting equipmentKey and search arguments breaks filtering contract', () => {
    // Inverted call: passing search="" as equipmentKey, and selectedEquipment="all" as search
    // Expected inverted behavior: searches for name containing "all", missing almost everything
    const invertedAll = filterExercisesByEquipmentAndSearch(
      mockExercises,
      '' /* mistakenly search */,
      'all' /* mistakenly selectedEquipment */
    );
    expect(invertedAll).not.toHaveLength(mockExercises.length);

    // Inverted call: passing search="supino" as equipmentKey, and selectedEquipment="barra" as search
    // Expected inverted behavior: equipmentKey="supino" which is not a valid equipment key, returning []
    const invertedCombo = filterExercisesByEquipmentAndSearch(
      mockExercises,
      'supino' /* mistakenly search */,
      'barra' /* mistakenly selectedEquipment */
    );
    expect(invertedCombo).toEqual([]);
  });
});

describe('ExercisePickerModal (component behavior & call site wiring)', () => {
  function renderPicker(overrides: Partial<Parameters<typeof ExercisePickerModal>[0]> = {}) {
    return render(
      <I18nProvider initialLanguage="pt">
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          onSelect={jest.fn()}
          {...overrides}
        />
      </I18nProvider>
    );
  }

  it('All sem texto mostra lista completa', () => {
    const { getByText, queryByText } = renderPicker();

    // All items in the fixtures must be present
    expect(getByText('Supino Reto')).toBeTruthy();
    expect(getByText('Supino com Halteres')).toBeTruthy();
    expect(getByText('Flexão de Braço')).toBeTruthy();
    expect(getByText('Barra Fixa')).toBeTruthy();
    expect(getByText('Desenvolvimento Máquina')).toBeTruthy();
    expect(getByText('Puxada com Barra')).toBeTruthy();
    expect(getByText('Elevação Lateral')).toBeTruthy();

    // Empty state message should NOT be shown
    expect(queryByText('Digite para buscar')).toBeNull();
  });

  it('chip barra filtra barra e exclui outros equipamentos e peso_corporal', () => {
    const { getByText, queryByText, getByLabelText } = renderPicker();

    // Find and press the "Barra" chip
    const barraChip = getByLabelText('Barra');
    fireEvent.press(barraChip);

    // Must show exercises whose derived equipment is barra
    expect(getByText('Supino Reto')).toBeTruthy();
    expect(getByText('Puxada com Barra')).toBeTruthy();

    // Must NOT show exercises of other equipments or peso_corporal (even if name has "Barra")
    expect(queryByText('Barra Fixa')).toBeNull();
    expect(queryByText('Supino com Halteres')).toBeNull();
    expect(queryByText('Flexão de Braço')).toBeNull();
    expect(queryByText('Desenvolvimento Máquina')).toBeNull();
    expect(queryByText('Elevação Lateral')).toBeNull();
  });

  it('texto e chip combinam com busca acentuada', () => {
    const { getByText, queryByText, getByPlaceholderText, getByLabelText } = renderPicker();

    // Select "Barra" chip
    const barraChip = getByLabelText('Barra');
    fireEvent.press(barraChip);

    // Enter search "puxada"
    const searchInput = getByPlaceholderText('Buscar ou Criar...');
    fireEvent.changeText(searchInput, 'puxada');

    // Only "Puxada com Barra" should be shown
    expect(getByText('Puxada com Barra')).toBeTruthy();
    expect(queryByText('Supino Reto')).toBeNull();
  });

  it('busca com acento e sem acento funciona com chip selecionado', () => {
    const { getByText, queryByText, getByPlaceholderText, getByLabelText } = renderPicker();

    // Select "Halteres" chip
    const halteresChip = getByLabelText('Halteres');
    fireEvent.press(halteresChip);

    // Search with accent "elevação"
    const searchInput = getByPlaceholderText('Buscar ou Criar...');
    fireEvent.changeText(searchInput, 'elevação');

    expect(getByText('Elevação Lateral')).toBeTruthy();
    expect(queryByText('Supino com Halteres')).toBeNull();

    // Search without accent "elevacao"
    fireEvent.changeText(searchInput, 'elevacao');
    expect(getByText('Elevação Lateral')).toBeTruthy();
    expect(queryByText('Supino com Halteres')).toBeNull();
  });

  it('preserva acessibilidade dos chips e seleção de exercício', () => {
    const onSelect = jest.fn();
    const { getByLabelText } = renderPicker({ onSelect });

    // Click an exercise to select
    const exerciseItem = getByLabelText('Selecionar Supino Reto');
    expect(exerciseItem.props.accessibilityRole).toBe('button');
    fireEvent.press(exerciseItem);

    expect(onSelect).toHaveBeenCalledWith({ id: 1, name: 'Supino Reto' });
  });
});
