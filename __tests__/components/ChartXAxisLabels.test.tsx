import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ChartXAxisLabels } from '../../components/ChartXAxisLabels';

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
  default: {
    flatten: (style: unknown) => style,
  },
}));

describe('ChartXAxisLabels', () => {
  it('matches the gifted chart plot offset and keeps endpoint labels inside the viewport', () => {
    const { UNSAFE_getAllByType } = render(
      <ChartXAxisLabels
        axisLabels={['A', 'B', 'C', 'D', 'E']}
        slotSpacing={50}
        viewportWidth={240}
        yAxisLabelWidth={48}
      />,
    );

    const views = UNSAFE_getAllByType('View' as never);
    const rootStyle = StyleSheet.flatten(views[0].props.style);
    const firstLabelStyle = StyleSheet.flatten(views[1].props.style);
    const lastLabelStyle = StyleSheet.flatten(views[5].props.style);

    expect(rootStyle).toMatchObject({ marginLeft: 48, width: 240 });
    expect(rootStyle.overflow).toBeUndefined();
    expect(firstLabelStyle).toMatchObject({ left: 0, width: 40 });
    expect(lastLabelStyle).toMatchObject({ left: 200, width: 40 });
  });
});
