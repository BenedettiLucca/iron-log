import React from 'react';
import { render } from '@testing-library/react-native';
import { ExerciseHeader } from '@/components/session/ExerciseHeader';
import { ExerciseHistoryModal } from '@/components/session/ExerciseHistoryModal';
import { PhotoComparison } from '@/components/PhotoComparison';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: 'Modal',
}));
jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => ({
  __esModule: true,
  default: 'TouchableOpacity',
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'dark'),
}));
jest.mock('react-native/Libraries/Lists/FlatList', () => ({
  __esModule: true,
  default: ({ data, renderItem }: any) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{data?.map((item: any, index: number) => renderItem({ item, index }))}</View>;
  },
}));
jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));
jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));
jest.mock('react-native/Libraries/Image/Image', () => ({
  __esModule: true,
  default: 'Image',
}));
jest.mock('react-native-reanimated', () => {
  const View = 'View';
  return {
    __esModule: true,
    default: { View },
    FadeInRight: { duration: () => ({}) },
    FadeOutLeft: { duration: () => ({}) },
  };
});
jest.mock('@react-native-community/slider', () => ({
  __esModule: true,
  default: 'Slider',
}));
jest.mock('@/components/Stopwatch', () => ({
  Stopwatch: () => React.createElement('Text', {}, '00:00'),
}));
jest.mock('@/components/ProgressBar', () => ({
  ProgressBar: () => React.createElement('View'),
}));
jest.mock('@/components/Button', () => ({
  Button: (props: any) => React.createElement('Button', props),
}));
jest.mock('@/components/Pressable', () => ({
  Pressable: (props: any) => React.createElement('Pressable', props),
}));
jest.mock('@/constants/colors', () => ({
  getThemeColors: () => ({ primary: '#000', border: '#ccc' }),
}));
jest.mock('@/src/i18n/index', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      if (key === 'photoComparison.title') return `Comparing ${vars?.label}`;
      if (key === 'photoComparison.sliderLabel') return 'Slider Label';
      if (key === 'photoComparison.sliderHint') return 'Slider Hint';
      if (key === 'photoComparison.sliderValue') return 'Slider Value';
      if (key === 'common.closeComparison') return 'Close Comparison';
      if (key === 'exerciseSession.setOf') return `Set ${vars?.current} of ${vars?.total}`;
      if (key === 'exerciseSession.restTime') return `Rest: ${vars?.seconds} seconds`;
      return key;
    },
  }),
  getLocaleForLanguage: () => 'en-US',
}));

describe('Sprint 6 Residual Core Accessibility', () => {
  describe('ExerciseHeader accessibility', () => {
    it('provides accessible label for set counter and rest timer', () => {
      const mockT = (key: string, vars?: Record<string, string | number>) => {
        if (key === 'exerciseSession.setOf') return `Set ${vars?.current} of ${vars?.total}`;
        if (key === 'exerciseSession.restTime') return `Rest: ${vars?.seconds} seconds`;
        return key;
      };

      const result = render(
        <ExerciseHeader
          insetsTop={0}
          totalExercises={3}
          completedExercisesCount={1}
          t={mockT}
          startTime={Date.now()}
          onOpenHistory={jest.fn()}
          a11yHistory={{ accessibilityLabel: 'History' }}
          exerciseId={1}
          currentName="Bench Press"
          currentSetNumber={2}
          targetInfo={{ sets: 4, reps: '8-10' }}
          routineRest={90}
          target="4x10"
          notes="Pause at bottom"
        />
      );

      const texts = result.UNSAFE_getAllByType('Text' as any);
      const setCounter = texts.find((t) => {
        const c = t.props.children;
        return Array.isArray(c) && c.join('').startsWith('S2');
      });
      expect(setCounter).toBeDefined();
      expect(setCounter?.props.accessibilityLabel).toBe('Set 2 of 4');

      const restTimer = texts.find((t) => {
        const c = t.props.children;
        return Array.isArray(c) && c.join('').includes('90s');
      });
      expect(restTimer).toBeDefined();
      expect(restTimer?.props.accessibilityLabel).toBe('Rest: 90 seconds');
    });

    it('announces target and notes without decorative emoji names', () => {
      const mockT = (key: string) => key;
      const result = render(
        <ExerciseHeader
          insetsTop={0}
          totalExercises={1}
          completedExercisesCount={0}
          t={mockT}
          startTime={Date.now()}
          onOpenHistory={jest.fn()}
          a11yHistory={{ accessibilityLabel: 'History' }}
          exerciseId={1}
          currentName="Bench Press"
          currentSetNumber={1}
          targetInfo={null}
          routineRest={null}
          target="Heavy"
          notes="Focus"
        />
      );

      const texts = result.UNSAFE_getAllByType('Text' as any);
      const targetText = texts.find((t) => t.props.accessibilityLabel === 'Heavy');
      const notesText = texts.find((t) => t.props.accessibilityLabel === 'Focus');

      expect(targetText).toBeDefined();
      expect(notesText).toBeDefined();
    });
  });

  describe('ExerciseHistoryModal accessibility', () => {
    it('groups history item fields into single accessible item', () => {
      const mockT = (key: string) => key;
      const historyData = [
        {
          sessionId: 1,
          date: new Date('2026-08-25').getTime(),
          weight: 80,
          reps: 10,
          duration: null,
          rir: 2,
        },
      ];

      const result = render(
        <ExerciseHistoryModal
          visible={true}
          onClose={jest.fn()}
          historyData={historyData}
          t={mockT}
          language="en"
        />
      );

      const views = result.UNSAFE_getAllByType('View' as any);
      const itemGroup = views.find((v) => v.props.accessibilityRole === 'summary');
      expect(itemGroup).toBeDefined();
      expect(itemGroup?.props.accessible).toBe(true);
      expect(itemGroup?.props.accessibilityLabel).toBeDefined();
      expect(itemGroup?.props.accessibilityLabel).toContain('80kg');
      expect(itemGroup?.props.accessibilityLabel).toContain('10');
      expect(itemGroup?.props.accessibilityLabel).toContain('RIR 2');
    });
  });

  describe('PhotoComparison accessibility', () => {
    it('sets modal semantics without exposing backdrop/card containers as unnamed buttons', () => {
      const result = render(
        <PhotoComparison
          visible={true}
          onClose={jest.fn()}
          beforeUri="file://before.jpg"
          afterUri="file://after.jpg"
          label="Progress"
        />
      );

      const modal = result.UNSAFE_getByType('Modal' as any);
      expect(modal.props.accessibilityViewIsModal).toBe(true);

      const heading = result
        .UNSAFE_getAllByType('Text' as any)
        .find((node) => node.props.children === 'Comparing Progress');
      expect(heading?.props.accessibilityRole).toBe('header');

      const pressables = result.UNSAFE_getAllByType('Pressable' as any);
      expect(pressables.slice(0, 2).map((node) => node.props.accessible)).toEqual([false, false]);

      const images = result.UNSAFE_getAllByType('Image' as any);
      expect(images.length).toBeGreaterThanOrEqual(2);
      images.forEach((img) => {
        expect(img.props.accessible).toBe(false);
      });

      const views = result.UNSAFE_getAllByType('View' as any);
      const knobView = views.find((v) => v.props.accessible === false && typeof v.props.className === 'string' && v.props.className.includes('rounded-full'));
      expect(knobView).toBeDefined();
    });
  });
});
