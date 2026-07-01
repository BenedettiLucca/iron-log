export const CHART_HORIZONTAL_PADDING = 80;
export const MIN_CHART_VIEWPORT_WIDTH = 240;
export const CHART_INITIAL_SPACING = 20;
export const CHART_END_SPACING = 20;
export const MIN_CHART_POINT_SPACING = 56;

export function getChartViewportWidth(screenWidth: number): number {
  return Math.max(screenWidth - CHART_HORIZONTAL_PADDING, MIN_CHART_VIEWPORT_WIDTH);
}

export function getScrollableChartWidth(pointCount: number, viewportWidth: number): number {
  if (pointCount <= 1) return viewportWidth;

  const historyWidth =
    CHART_INITIAL_SPACING +
    CHART_END_SPACING +
    (pointCount - 1) * MIN_CHART_POINT_SPACING;

  return Math.max(viewportWidth, historyWidth);
}
