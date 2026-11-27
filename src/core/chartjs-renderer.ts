import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import type { DayStatSummary } from "./stats-engine";

let chartRegistered = false;
function getChartConstructor(): typeof Chart {
  if (!chartRegistered) {
    chartRegistered = true;
    Chart.register(
      BarController,
      LineController,
      BarElement,
      LineElement,
      PointElement,
      LinearScale,
      CategoryScale,
      Tooltip,
      Legend
    );
  }
  return Chart;
}

export interface ChartJsMetricOptions {
  label: string;
  unit: string;
  maxValue?: number;
  targetValue?: number;
  barColor: string;
  targetLineColor?: string;
  getValue: (day: DayStatSummary) => number | null;
}

export function getObsidianThemePalette(): {
  textColor: string;
  gridColor: string;
  fontFamily: string;
} {
  const bodyStyle = getComputedStyle(document.body);
  const textColor =
    bodyStyle.getPropertyValue("--text-muted").trim() ||
    bodyStyle.getPropertyValue("--text-normal").trim() ||
    "#888888";
  const gridColor =
    bodyStyle.getPropertyValue("--background-modifier-border").trim() ||
    "rgba(128, 128, 128, 0.2)";
  const fontFamily =
    bodyStyle.getPropertyValue("--font-text").trim() ||
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return { textColor, gridColor, fontFamily };
}

export function renderInteractiveChart(
  container: HTMLElement,
  summaries: DayStatSummary[],
  options: ChartJsMetricOptions
): Chart {
  const ChartCtor = getChartConstructor();
  const canvas = container.createEl("canvas", { cls: "life-os-chart-canvas" });

  const { textColor, gridColor, fontFamily } = getObsidianThemePalette();
  const labels = summaries.map((s) => s.dateKey.slice(0, 5));
  const data = summaries.map((s) => (s.exists ? options.getValue(s) ?? 0 : 0));

  // Base bar dataset
  const datasets: Chart["data"]["datasets"] = [
    {
      type: "bar",
      label: options.label,
      data,
      backgroundColor: options.barColor,
      borderRadius: 4,
      maxBarThickness: 16,
    },
  ];

  // Optional target baseline
  if (options.targetValue !== undefined) {
    const targetVal = options.targetValue;
    datasets.push({
      type: "line",
      label: `Goal (${targetVal}${options.unit})`,
      data: summaries.map(() => targetVal),
      borderColor: options.targetLineColor ?? "rgba(234, 179, 8, 0.8)",
      borderWidth: 2,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
    });
  }

  const chart = new ChartCtor(canvas, {
    type: "bar",
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: options.targetValue !== undefined,
          labels: {
            color: textColor,
            font: { family: fontFamily, size: 10 },
            boxWidth: 10,
          },
        },
        tooltip: {
          callbacks: {
            label(item) {
              return `${item.dataset.label}: ${item.formattedValue} ${options.unit}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { family: fontFamily, size: 9 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: summaries.length > 14 ? 10 : summaries.length,
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax: options.maxValue,
          grid: {
            color: gridColor,
          },
          ticks: {
            color: textColor,
            font: { family: fontFamily, size: 9 },
            callback(val) {
              return `${val}${options.unit}`;
            },
          },
        },
      },
    },
  });

  return chart;
}
