import type { App } from "obsidian";
import { toISOKey } from "../core/date-format";

export interface EcosystemStatus {
  tasks: boolean;
  dayPlanner: boolean;
  periodicNotes: boolean;
  dataview: boolean;
  tracker: boolean;
}

export function detectObsidianEcosystem(app: App): EcosystemStatus {
  const enabled: Set<string> | undefined = (app as unknown as { plugins?: { enabledPlugins?: Set<string> } }).plugins?.enabledPlugins;
  return {
    tasks: Boolean(enabled?.has("obsidian-tasks-plugin")),
    dayPlanner: Boolean(enabled?.has("obsidian-day-planner")),
    periodicNotes: Boolean(enabled?.has("periodic-notes")),
    dataview: Boolean(enabled?.has("dataview")),
    tracker: Boolean(enabled?.has("obsidian-tracker")),
  };
}

/**
 * Formats a task line compatible with Obsidian Tasks (priority emojis + due date)
 * and optional Day Planner timebox (HH:MM - HH:MM).
 */
export function formatInteropTaskLine(opts: {
  title: string;
  done?: boolean;
  priority?: "high" | "medium" | "low";
  dueDateKey?: string;
  startTime?: string;
  endTime?: string;
}): string {
  const box = opts.done ? "[x]" : "[ ]";
  const timePrefix = opts.startTime && opts.endTime ? `${opts.startTime} - ${opts.endTime} ` : "";
  const prioEmoji = opts.priority === "high" ? " ⏫" : opts.priority === "medium" ? " 🔼" : opts.priority === "low" ? " 🔽" : "";
  const isoDue = opts.dueDateKey ? toISOKey(opts.dueDateKey) : null;
  const dueSuffix = isoDue ? ` 📅 ${isoDue}` : "";
  return `- ${box} ${timePrefix}${opts.title}${prioEmoji}${dueSuffix}`;
}

/**
 * Formats Dataview + Obsidian Tracker compatible inline fields & frontmatter keys.
 */
export function formatDataviewMetricLine(label: string, key: string, value: string | number): string {
  return `- ${label}: [${key}:: ${value}]`;
}
