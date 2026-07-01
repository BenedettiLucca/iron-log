import {
  CHART_END_SPACING,
  CHART_HORIZONTAL_PADDING,
  CHART_INITIAL_SPACING,
  MIN_CHART_POINT_SPACING,
  MIN_CHART_VIEWPORT_WIDTH,
  getChartViewportWidth,
  getScrollableChartWidth,
} from '../../src/utils/chart-layout';

describe('chart layout helpers', () => {
  describe('getChartViewportWidth', () => {
    it('uses the available screen width minus chart padding', () => {
      expect(getChartViewportWidth(400)).toBe(400 - CHART_HORIZONTAL_PADDING);
    });

    it('never returns less than the minimum viewport width', () => {
      expect(getChartViewportWidth(200)).toBe(MIN_CHART_VIEWPORT_WIDTH);
    });
  });

  describe('getScrollableChartWidth', () => {
    it('keeps short series locked to the viewport width', () => {
      expect(getScrollableChartWidth(1, 320)).toBe(320);
      expect(getScrollableChartWidth(4, 320)).toBe(320);
    });

    it('expands width for long histories so horizontal scroll has bounded content', () => {
      const expected =
        CHART_INITIAL_SPACING +
        CHART_END_SPACING +
        (9 * MIN_CHART_POINT_SPACING);

      expect(getScrollableChartWidth(10, 320)).toBe(expected);
    });

    it('never shrinks below the viewport width', () => {
      expect(getScrollableChartWidth(6, 360)).toBeGreaterThanOrEqual(360);
    });
  });
});
