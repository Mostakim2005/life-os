import { parse as parseChrono } from "chrono-node";
import { RRule } from "rrule";

export interface ChronoMatch {
  index: number;
  text: string;
  date: Date;
}

export function parseChronoFirstDate(
  title: string,
  referenceDate: Date = new Date()
): ChronoMatch | null {
  const parsedDates = parseChrono(title, referenceDate, { forwardDate: true });
  if (parsedDates.length === 0) return null;
  const first = parsedDates[0]!;
  return {
    index: first.index,
    text: first.text,
    date: first.start.date(),
  };
}

export function computeRRuleNextOccurrence(textRule: string, fromDate: Date): Date | null {
  try {
    const rule = RRule.fromText(textRule);
    if (rule) {
      return rule.after(fromDate) ?? null;
    }
  } catch {
    // Fall back to caller default
  }
  return null;
}

export type LifeOSNlpChunk = {
  parseChronoFirstDate: typeof parseChronoFirstDate;
  computeRRuleNextOccurrence: typeof computeRRuleNextOccurrence;
};
