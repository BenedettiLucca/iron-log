import {
  CHART_HORIZONTAL_PADDING,
  MIN_CHART_VIEWPORT_WIDTH,
  getChartViewportWidth,
} from '../../src/utils/chart-layout';

describe('chart layout helpers', () => {
  describe('getChartViewportWidth', () => {
    it('uses the available screen width minus chart padding', () => {
      expect(getChartViewportWidth(400)).toBe(400 - CHART_HORIZONTAL_PADDING);
    });

    it('keeps the plot plus 48dp Y axis inside the padded Card', () => {
      for (const screenWidth of [320, 384]) {
        const cardInnerWidth = screenWidth - 66;

        expect(getChartViewportWidth(screenWidth) + 48).toBeLessThanOrEqual(cardInnerWidth);
      }
    });

    it('never returns less than the minimum viewport width', () => {
      expect(getChartViewportWidth(200)).toBe(MIN_CHART_VIEWPORT_WIDTH);
    });
  });
});
