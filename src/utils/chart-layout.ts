export const CHART_HORIZONTAL_PADDING = 114;
export const MIN_CHART_VIEWPORT_WIDTH = 160;
export const CHART_INITIAL_SPACING = 20;
export const CHART_END_SPACING = 20;

export function getChartViewportWidth(screenWidth: number): number {
  return Math.max(screenWidth - CHART_HORIZONTAL_PADDING, MIN_CHART_VIEWPORT_WIDTH);
}
