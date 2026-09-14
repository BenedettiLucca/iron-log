import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { CheckinGallery } from '@/components/CheckinGallery';
import { MonthlyCheckinComparison } from '@/components/MonthlyCheckinComparison';
import { PhotoComparison } from '@/components/PhotoComparison';
import { PhotoOverlay } from '@/components/PhotoOverlay';
import EvolutionScreen from '@/app/bio/evolution';
import { BodyMetric } from '@/src/types';
import { pt as ptTranslations } from '@/src/i18n/translations/pt';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

// Mock useI18n with real pt translations and stable reference
const mockT = (key: string, params?: Record<string, unknown>) => {
  const parts = key.split('.');
  let val: any = ptTranslations;
  for (const part of parts) {
    val = val?.[part];
  }
  if (typeof val === 'string') {
    if (params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
        val
      );
    }
    return val;
  }
  return key;
};

const mockI18nResult = {
  t: mockT,
  language: 'pt',
};

jest.mock('@/src/i18n/index', () => ({
  useI18n: () => mockI18nResult,
  getLocaleForLanguage: () => 'pt-BR',
}));
jest.mock('../../src/i18n/index', () => ({
  useI18n: () => mockI18nResult,
  getLocaleForLanguage: () => 'pt-BR',
}));

// Mock db client
const mockSelect = jest.fn();
jest.mock('@/src/db/client', () => ({
  __esModule: true,
  db: {
    select: () => mockSelect(),
  },
}));
jest.mock('../../src/db/client', () => ({
  __esModule: true,
  db: {
    select: () => mockSelect(),
  },
}));

// Host mocks for Node test environment
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

jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));

jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));

jest.mock('react-native/Libraries/Image/Image', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const MockImage = (props: any) => ReactModule.createElement('Image', props);
  (MockImage as any).default = MockImage;
  return MockImage;
});

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  function FlatList({
    data,
    renderItem,
    keyExtractor,
    ListHeaderComponent,
    ListEmptyComponent,
    initialNumToRender,
    windowSize,
  }: any) {
    const header = ListHeaderComponent
      ? ReactModule.isValidElement(ListHeaderComponent)
        ? ListHeaderComponent
        : ReactModule.createElement(ListHeaderComponent)
      : null;

    if (!data || data.length === 0) {
      const empty = ListEmptyComponent
        ? ReactModule.isValidElement(ListEmptyComponent)
          ? ListEmptyComponent
          : ReactModule.createElement(ListEmptyComponent)
        : null;
      return ReactModule.createElement(ReactModule.Fragment, null, header, empty);
    }

    const renderLimit =
      initialNumToRender != null
        ? Math.min(data.length, initialNumToRender * (windowSize ?? 2))
        : data.length;
    const slice = data.slice(0, renderLimit);

    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      header,
      slice.map((item: any, index: number) =>
        ReactModule.createElement(
          ReactModule.Fragment,
          { key: keyExtractor ? keyExtractor(item, index) : String(index) },
          renderItem({ item, index })
        )
      )
    );
  }
  return { __esModule: true, default: FlatList };
});

jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) =>
      ReactModule.createElement('ScrollView', props, children),
  };
});

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({
  __esModule: true,
  default: 'Pressable',
}));

jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => ({
  __esModule: true,
  default: 'TouchableOpacity',
}));

jest.mock('react-native/Libraries/Components/ActivityIndicator/ActivityIndicator', () => ({
  __esModule: true,
  default: 'ActivityIndicator',
}));

jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  __esModule: true,
  default: {
    getColorScheme: () => 'light',
    addChangeListener: () => ({ remove: jest.fn() }),
  },
  getColorScheme: () => 'light',
  addChangeListener: () => ({ remove: jest.fn() }),
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'light',
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
}));

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const MockModal = ({ children, visible }: any) =>
    visible ? ReactModule.createElement('Modal', null, children) : null;
  (MockModal as any).default = MockModal;
  return MockModal;
});

jest.mock('@/hooks/use-reactive-reduced-motion', () => ({
  useReactiveReducedMotion: () => false,
}));

// Mock @react-native-community/slider
jest.mock('@react-native-community/slider', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactModule.createElement('Slider', props),
  };
});

// Mock react-native-gifted-charts
jest.mock('react-native-gifted-charts', () => ({
  LineChart: () => null,
}));

// Mock router
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: jest.fn(),
  Stack: { Screen: jest.fn() },
}));

// Helper to generate N synthetic monthly check-ins
function generateSyntheticCheckins(count: number): BodyMetric[] {
  const baseDate = new Date(2026, 0, 15).getTime();
  const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    date: baseDate - i * ONE_MONTH,
    type: 'monthly' as const,
    weight: 100 - i * 0.5,
    waist: 90 - i * 0.3,
    chest: 105,
    armRight: 38,
    thighRight: 60,
    calf: 38,
    photoFront: `file:///photos/front_${i + 1}.jpg`,
    photoBack: `file:///photos/back_${i + 1}.jpg`,
    photoSide: `file:///photos/side_${i + 1}.jpg`,
    photoNotes: JSON.stringify({ front: '', back: '', side: '' }),
  }));
}

describe('T24: Bio media virtualizada e comparação utilizável', () => {
  describe('CheckinGallery virtualization', () => {
    it('virtualizes 60 synthetic check-ins and does not mount all 60 thumbnails simultaneously', () => {
      const synthetic60 = generateSyntheticCheckins(60);
      const onSelectMonth = jest.fn();

      const { UNSAFE_getAllByType } = render(
        <CheckinGallery
          metrics={synthetic60}
          selectedMetricId={synthetic60[0].id}
          onSelectMonth={onSelectMonth}
        />
      );

      // In a virtualized list (FlatList with initialNumToRender/windowSize),
      // only a subset of items/images should be mounted initially.
      const images = UNSAFE_getAllByType(Image);
      expect(images.length).toBeLessThan(60);
      expect(images.length).toBeGreaterThan(0);
    });

    it('triggers onSelectMonth when a month thumbnail is pressed', () => {
      const metrics = generateSyntheticCheckins(5);
      const onSelectMonth = jest.fn();

      const { getAllByLabelText } = render(
        <CheckinGallery
          metrics={metrics}
          selectedMetricId={metrics[0].id}
          onSelectMonth={onSelectMonth}
        />
      );

      const items = getAllByLabelText(/Check-in de/i);
      expect(items.length).toBeGreaterThan(1);
      fireEvent.press(items[1]);
      expect(onSelectMonth).toHaveBeenCalledWith(metrics[1]);
    });
  });

  describe('MonthlyCheckinComparison canonical poses, selection and explicit units', () => {
    const currentMetric: BodyMetric = {
      id: 2,
      date: new Date(2026, 3, 15).getTime(),
      type: 'monthly',
      weight: 116.5,
      waist: 87.0,
      chest: 104,
      armRight: 39,
      thighRight: 61,
      calf: 38,
      photoFront: 'file:///current_front.jpg',
      photoBack: 'file:///current_back.jpg',
      photoSide: 'file:///current_side.jpg',
      photoNotes: null,
    };

    const previousMetric: BodyMetric = {
      id: 1,
      date: new Date(2026, 2, 15).getTime(),
      type: 'monthly',
      weight: 118.2,
      waist: 89.0,
      chest: 105,
      armRight: 38.5,
      thighRight: 62,
      calf: 38,
      photoFront: 'file:///previous_front.jpg',
      photoBack: 'file:///previous_back.jpg',
      photoSide: 'file:///previous_side.jpg',
      photoNotes: null,
    };

    it('renders all 3 canonical poses (front, back, side) with explicit metric measurements', () => {
      const { getAllByText, getAllByTestId, getByTestId } = render(
        <MonthlyCheckinComparison current={currentMetric} previous={previousMetric} />
      );

      // Poses cards
      expect(getByTestId('pose-card-photoFront')).toBeTruthy();
      expect(getByTestId('pose-card-photoBack')).toBeTruthy();
      expect(getByTestId('pose-card-photoSide')).toBeTruthy();

      // Poses headers present
      expect(getAllByText(/FRENTE|Front/i).length).toBeGreaterThan(0);
      expect(getAllByText(/COSTAS|Back/i).length).toBeGreaterThan(0);
      expect(getAllByText(/PERFIL|LATERAL|Side/i).length).toBeGreaterThan(0);

      // Explicit metric units (kg and cm)
      expect(getAllByText(/116\.5\s*kg/).length).toBeGreaterThan(0);
      expect(getAllByText(/118\.2\s*kg/).length).toBeGreaterThan(0);
      expect(getAllByText(/87(\.0)?\s*cm/).length).toBeGreaterThan(0);
      expect(getAllByText(/89(\.0)?\s*cm/).length).toBeGreaterThan(0);

      // Overlays rendered
      const overlays = getAllByTestId('photo-overlay');
      expect(overlays.length).toBeGreaterThanOrEqual(2);
    });

    it('handles missing pose gracefully (estado sem pose) without crashing', () => {
      const currentNoSide: BodyMetric = {
        ...currentMetric,
        photoSide: null,
      };
      const previousNoBackNoSide: BodyMetric = {
        ...previousMetric,
        photoBack: null,
        photoSide: null,
      };

      const { queryAllByText, getByTestId } = render(
        <MonthlyCheckinComparison current={currentNoSide} previous={previousNoBackNoSide} />
      );

      // Check that it rendered without throw and indicates no photos for the missing poses
      expect(getByTestId('pose-card-photoFront')).toBeTruthy();
      expect(getByTestId('pose-card-photoSide')).toBeTruthy();
      const noPhotoTexts = queryAllByText(/📷|Nenhuma foto|Sem foto/i);
      expect(noPhotoTexts.length).toBeGreaterThan(0);
    });

    it('handles null measurements with explicit em-dash and no phantom units (medidas/null/units explícitas)', () => {
      const currentNullMeasures: BodyMetric = {
        ...currentMetric,
        weight: null,
        waist: null,
      };
      const previousNullMeasures: BodyMetric = {
        ...previousMetric,
        weight: null,
        waist: null,
      };

      const { getAllByText, queryByText } = render(
        <MonthlyCheckinComparison current={currentNullMeasures} previous={previousNullMeasures} />
      );

      // Should display '—', NOT '— kg' or '— cm'
      expect(queryByText('— kg')).toBeNull();
      expect(queryByText('— cm')).toBeNull();
      const dashes = getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('allows selecting a specific pose filter and calling slider comparison', () => {
      const onOpenSlider = jest.fn();
      const onSelectPose = jest.fn();

      const { getByTestId, queryByTestId, getByText } = render(
        <MonthlyCheckinComparison
          current={currentMetric}
          previous={previousMetric}
          selectedPose="photoFront"
          onSelectPose={onSelectPose}
          onOpenSlider={onOpenSlider}
        />
      );

      // Only front pose should be visible when selectedPose is photoFront
      expect(getByTestId('pose-card-photoFront')).toBeTruthy();
      expect(queryByTestId('pose-card-photoBack')).toBeNull();
      expect(queryByTestId('pose-card-photoSide')).toBeNull();

      // Slider launch button for front pose
      const sliderButton = getByText(/Slider/i);
      fireEvent.press(sliderButton);
      expect(onOpenSlider).toHaveBeenCalledWith(
        'file:///previous_front.jpg',
        'file:///current_front.jpg',
        expect.any(String)
      );
    });
  });

  describe('PhotoOverlay badge and accessibility', () => {
    it('renders semi-transparent badges for weight and waist', () => {
      const { getByTestId, getByText } = render(
        <PhotoOverlay weight="116.5 kg" waist="87 cm" />
      );

      const overlay = getByTestId('photo-overlay');
      expect(overlay).toBeTruthy();
      expect(getByText('116.5 kg')).toBeTruthy();
      expect(getByText('87 cm')).toBeTruthy();
    });

    it('returns null when both weight and waist are null or empty', () => {
      const { queryByTestId } = render(
        <PhotoOverlay weight={null} waist={null} />
      );
      expect(queryByTestId('photo-overlay')).toBeNull();
    });
  });

  describe('PhotoComparison accessible slider with overlays', () => {
    it('renders accessible slider with accessibilityLabel, hint, and percentage values', () => {
      const onClose = jest.fn();
      const { getByLabelText, getByText, getAllByText } = render(
        <PhotoComparison
          visible={true}
          onClose={onClose}
          beforeUri="file:///before.jpg"
          afterUri="file:///after.jpg"
          label="Frente"
          beforeOverlay={{ weight: '118.2 kg', waist: '89 cm' }}
          afterOverlay={{ weight: '116.5 kg', waist: '87 cm' }}
        />
      );

      const slider = getByLabelText(/Comparação de fotos antes e depois|slider/i);
      expect(slider).toBeTruthy();

      // Controls to toggle before/after/compare
      const viewBefore = getByText('Ver Antes');
      const viewAfter = getByText('Ver Depois');
      const compareBtns = getAllByText('Comparar');
      expect(viewBefore).toBeTruthy();
      expect(viewAfter).toBeTruthy();
      expect(compareBtns.length).toBeGreaterThan(0);

      // Overlays visible in viewer
      expect(getByText('118.2 kg')).toBeTruthy();
      expect(getByText('116.5 kg')).toBeTruthy();
    });
  });

  describe('EvolutionScreen main UI virtualized feed and comparison call', () => {
    it('virtualizes 60 check-in photo items without mounting all 60 simultaneously and provides comparison', async () => {
      const synthetic60 = generateSyntheticCheckins(60);

      mockSelect.mockReturnValue({
        from: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(synthetic60),
        }),
      });

      render(<EvolutionScreen />);

      // Switch to photos tab
      const photosTab = await screen.findByText(/FOTOS|Photos/i);
      fireEvent.press(photosTab);

      // Verify that images rendered are bounded (virtualized)
      const images = screen.UNSAFE_getAllByType('Image' as any);
      expect(images.length).toBeLessThan(60 * 3);

      // Main UI has Compare action
      const compareAction = screen.getByText(/Comparar|Compare/i);
      expect(compareAction).toBeTruthy();

      // Triggering comparison opens the comparison view
      fireEvent.press(compareAction);

      // Verify comparison view is invoked and rendered with canonical poses
      const frontCard = await screen.findByTestId('pose-card-photoFront');
      expect(frontCard).toBeTruthy();
      expect(screen.getByTestId('pose-card-photoBack')).toBeTruthy();
      expect(screen.getByTestId('pose-card-photoSide')).toBeTruthy();
    });
  });
});
