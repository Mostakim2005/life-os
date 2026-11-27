export { getObsidianThemePalette, renderInteractiveChart, type ChartJsMetricOptions } from "../core/chartjs-renderer";

export type LifeOSChartsChunk = {
  renderInteractiveChart: typeof import("../core/chartjs-renderer").renderInteractiveChart;
};
