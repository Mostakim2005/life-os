import { formatDateDMY, toISOKey } from "./date-format";

type ChronoMod = typeof import("chrono-node");
type RRuleMod = typeof import("rrule");

let chronoCache: ChronoMod | null = null;
let rruleCache: RRuleMod | null = null;

function getChrono(): ChronoMod {
  if (!chronoCache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Deferred load avoids parsing Chrono regex tables on Obsidian startup
    chronoCache = require("chrono-node") as ChronoMod;
  }
  return chronoCache;
}

function getRRule(): RRuleMod {
  if (!rruleCache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Deferred load avoids initializing RRule on Obsidian startup
    rruleCache = require("rrule") as RRuleMod;
  }
  return rruleCache;
}

export interface ParsedTaskInput {
  title: string;
  dueDateIso?: string;
  recurrence?: string;
}

/**
 * Parses natural language task title and extracts due dates and recurrence.
 * Example: "Submit lab report next Friday 🔁 every week"
 */
export function parseNaturalLanguageTask(
  input: string,
  referenceDate: Date = new Date()
): ParsedTaskInput {
  let title = input.trim();
  let dueDateIso: string | undefined;
  let recurrence: string | undefined;

  // 1. Extract recurrence pattern (e.g., 🔁 every day, 🔁 every week)
  const repeatMatch = /🔁\s*([^\s📅✅⏫🔼🔽]+(?:\s+[^\s📅✅⏫🔼🔽]+)*)/iu.exec(title);
  if (repeatMatch && repeatMatch[1]) {
    recurrence = repeatMatch[1].trim();
    title = title.replace(repeatMatch[0], "").trim();
  }

  // 2. Parse natural language dates using lazy-loaded chrono-node
  const parsedDates = getChrono().parse(title, referenceDate, { forwardDate: true });
  if (parsedDates.length > 0) {
    const first = parsedDates[0]!;
    const dateObj = first.start.date();
    dueDateIso = toISOKey(formatDateDMY(dateObj)) ?? undefined;
    // Strip date phrase from title
    title = (
      title.slice(0, first.index) + title.slice(first.index + first.text.length)
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  return { title, dueDateIso, recurrence };
}

/**
 * Computes the next occurrence date for a recurring task using rrule and fallback rules.
 */
export function computeNextRecurringDate(
  recurrence: string,
  fromDate: Date = new Date()
): Date {
  const lower = recurrence.toLowerCase().trim();
  const next = new Date(fromDate.getTime());

  if (lower === "day" || lower === "daily" || lower === "every day") {
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (lower === "weekday" || lower === "every weekday") {
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6); // 0 = Sun, 6 = Sat
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

  // Attempt RRule.fromText parsing
  try {
    const rule = getRRule().RRule.fromText(lower);
    if (rule) {
      const occurrence = rule.after(fromDate);
      if (occurrence) return occurrence;
    }
  } catch {
    // Non-standard text pattern, fall back to next day
  }

  next.setDate(next.getDate() + 1);
  return next;
}
