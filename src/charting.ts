export interface TrendPoint {
  label: string;
  value: number;
}

export interface MultiTrendPoint {
  label: string;
  values: Record<string, number>;
}

export function maxValue(points: TrendPoint[]): number {
  return Math.max(1, ...points.map((point) => point.value));
}

export function minMax(points: TrendPoint[]): { min: number; max: number } {
  if (!points.length) return { min: 0, max: 1 };
  const values = points.map((point) => point.value);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function niceLabel(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
