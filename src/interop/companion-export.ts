import type { DailyRecord } from "../types";
import { toISOKey } from "../core/date-format";

/**
 * Exports tasks into a portable JSON structure compatible with Super Productivity import.
 */
export function exportToSuperProductivityJSON(
  dateKey: string,
  tasks: Array<{ id: string; title: string; done: boolean; estimateMin?: number }>
): string {
  const iso = toISOKey(dateKey) ?? dateKey;
  return JSON.stringify(
    {
      source: "life-os",
      date: iso,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        isDone: t.done,
        timeEstimate: (t.estimateMin ?? 30) * 60 * 1000,
        plannedDay: iso,
      })),
    },
    null,
    2
  );
}

/**
 * Exports daily habit completion rows in Loop Habit Tracker (uHabits) Checkmarks.csv format.
 * Value convention: 2 = YES_MANUAL, 0 = NO.
 */
export function exportToLoopHabitsCSV(records: DailyRecord[], habitKeys: string[]): string {
  const header = ["Date", ...habitKeys].join(",");
  const rows = records.map((r) => {
    const cols = habitKeys.map((k) => (r.habits && r.habits[k] ? "2" : "0"));
    return [r.isoDate, ...cols].join(",");
  });
  return [header, ...rows].join("\n") + "\n";
}
