import React from 'react';
import { render } from '@testing-library/react-native';
import { ExerciseHistoryModal } from '@/components/session/ExerciseHistoryModal';
import { RirExplainerModal } from '@/components/session/RirExplainerModal';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: 'Modal',
}));
jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => ({
  __esModule: true,
  default: 'TouchableOpacity',
}));
jest.mock('react-native/Libraries/Lists/FlatList', () => ({
  __esModule: true,
  default: 'FlatList',
}));
jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));
jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));

const t = (key: string) => key;

describe('Sprint 6 session modal accessibility', () => {
  it('traps ExerciseHistory focus and names the heading and close action', () => {
    const result = render(
      <ExerciseHistoryModal
        visible
        onClose={jest.fn()}
        historyData={[]}
        t={t}
        language="pt"
      />,
    );
    const modal = result.UNSAFE_getByType('Modal' as any);
    const heading = result
      .UNSAFE_getAllByType('Text' as any)
      .find((node) => node.props.children === 'exerciseSession.history');
    const close = result.UNSAFE_getByType('TouchableOpacity' as any);

    expect(modal.props.accessibilityViewIsModal).toBe(true);
    expect(modal.props.onRequestClose).toEqual(expect.any(Function));
    expect(heading?.props.accessibilityRole).toBe('header');
    expect(close.props.accessibilityRole).toBe('button');
    expect(close.props.accessibilityLabel).toBe('common.close');
  });

  it('traps RIR explainer focus and gives every close path explicit semantics', () => {
    const result = render(<RirExplainerModal visible onClose={jest.fn()} t={t} />);
    const modal = result.UNSAFE_getByType('Modal' as any);
    const heading = result
      .UNSAFE_getAllByType('Text' as any)
      .find((node) => node.props.children === 'exercise.rirQuestion');
    const touchables = result.UNSAFE_getAllByType('TouchableOpacity' as any);
    const closeActions = touchables.filter((node) => node.props.accessibilityRole === 'button');

    expect(modal.props.accessibilityViewIsModal).toBe(true);
    expect(heading?.props.accessibilityRole).toBe('header');
    expect(closeActions).toHaveLength(2);
    expect(closeActions.map((node) => node.props.accessibilityLabel)).toEqual([
      'common.close',
      'common.understood',
    ]);
  });
});