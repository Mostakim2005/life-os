import type { Plugin } from "obsidian";
import type { LifeOSNlpChunk } from "../chunks/nlp";
import { loadPluginChunkAsync } from "./chunk-loader";
import { formatDateDMY, toISOKey } from "./date-format";

const NLP_CHUNK = "lifeos-nlp.chunk.js";

export interface ParsedTaskInput {
  title: string;
  dueDateIso?: string;
  recurrence?: string;
}

export function computeSimpleRecurringDate(
  recurrence: string,
  fromDate: Date = new Date()
): Date | null {
  const lower = recurrence.toLowerCase().trim();
  const next = new Date(fromDate.getTime());

  if (lower === "day" || lower === "daily" || lower === "every day") {
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (lower === "weekday" || lower === "every weekday") {
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6);
    return next;
  }
  if (lower === "week" || lower === "weekly" || lower === "every week") {
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (lower === "month" || lower === "monthly" || lower === "every month") {
    next.setMonth(next.getMonth() + 1);
    return next;
  }
  return null;
}

/**
 * Parses natural language task title and extracts due dates and recurrence using lazy NLP chunk.
 */
export async function parseNaturalLanguageTask(
  plugin: Plugin,
  input: string,
  referenceDate: Date = new Date()
): Promise<ParsedTaskInput> {
  let title = input.trim();
  let dueDateIso: string | undefined;
  let recurrence: string | undefined;

  const repeatMatch = /🔁\s*([^\s📅✅⏫🔼🔽]+(?:\s+[^\s📅✅⏫🔼🔽]+)*)/iu.exec(title);
  if (repeatMatch && repeatMatch[1]) {
    recurrence = repeatMatch[1].trim();
    title = title.replace(repeatMatch[0], "").trim();
  }

  const nlpChunk = await loadPluginChunkAsync<LifeOSNlpChunk>(plugin, NLP_CHUNK);
  const first = nlpChunk.parseChronoFirstDate(title, referenceDate);
  if (first) {
    dueDateIso = toISOKey(formatDateDMY(first.date)) ?? undefined;
    title = (title.slice(0, first.index) + title.slice(first.index + first.text.length))
      .replace(/\s+/g, " ")
      .trim();
  }

  return { title, dueDateIso, recurrence };
}

/**
 * Computes the next occurrence date for a recurring task using pure-TS fast paths
 * and lazy-loaded RRule fallback for complex expressions.
 */
export async function computeNextRecurringDate(
  plugin: Plugin,
  recurrence: string,
  fromDate: Date = new Date()
): Promise<Date> {
  const simple = computeSimpleRecurringDate(recurrence, fromDate);
  if (simple) return simple;

  try {
    const nlpChunk = await loadPluginChunkAsync<LifeOSNlpChunk>(plugin, NLP_CHUNK);
    const occurrence = nlpChunk.computeRRuleNextOccurrence(recurrence.toLowerCase().trim(), fromDate);
    if (occurrence) return occurrence;
  } catch {
    // Fall back to +1 day if RRule fails
  }

  const fallback = new Date(fromDate.getTime());
  fallback.setDate(fallback.getDate() + 1);
  return fallback;
}
