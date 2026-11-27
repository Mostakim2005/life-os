import { normalizePath, type App, type Plugin, type TFile } from "obsidian";
import type { LifeOSSettings, TaskItem, TaskPriority } from "../types";
import { formatDateDMY, parseAnyDateKey, todayDMY, toISOKey } from "./date-format";
import {
  applyParsedNoteToMarkdown,
  parseDailyNote,
  parseTaskLine,
  serializeTaskLine,
} from "./note-parser";
import { computeNextRecurringDate, computeSimpleRecurringDate } from "./task-nlp";

export interface VaultTaskEntry {
  filePath: string;
  fileBasename: string;
  lineNumber: number;
  indent: string;
  rawLine: string;
  heading?: string;
  isDailyNote: boolean;
  task: TaskItem;
}

const DAILY_EXCLUDED_HEADINGS = /^(?:prayers|habits|timeline)\b/i;

function isDailyNoteFile(file: TFile, dailyPrefix: string): boolean {
  if (dailyPrefix.length > 0 && file.path.startsWith(`${dailyPrefix}/`)) {
    return true;
  }
  return /^\d{2}-\d{2}-\d{4}$/.test(file.basename) || /^\d{4}-\d{2}-\d{2}$/.test(file.basename);
}

function extractTasksFromMarkdown(
  markdown: string,
  file: TFile,
  isDailyNote: boolean
): VaultTaskEntry[] {
  const lines = markdown.split(/\r?\n/);
  const entries: VaultTaskEntry[] = [];
  let inFence = false;
  let heading = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const headingMatch = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
    if (headingMatch && headingMatch[1]) {
      heading = headingMatch[1].trim();
      continue;
    }

    if (isDailyNote && heading && DAILY_EXCLUDED_HEADINGS.test(heading)) {
      continue;
    }

    const parsed = parseTaskLine(line, `${file.path}:${i}`);
    if (!parsed) continue;

    const indentMatch = /^(\s*)/.exec(line);
    entries.push({
      filePath: file.path,
      fileBasename: file.basename,
      lineNumber: i,
      indent: indentMatch ? indentMatch[1]! : "",
      rawLine: line,
      heading: heading || undefined,
      isDailyNote,
      task: parsed,
    });
  }

  return entries;
}

/**
 * Lazy vault-wide Markdown task index backed by per-file mtime caching.
 * Performs zero scanning until scan() is explicitly called (e.g. when opening the Tasks tab).
 */
export class VaultTaskIndex {
  private cache = new Map<string, { mtime: number; entries: VaultTaskEntry[] }>();

  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  clear(): void {
    this.cache.clear();
  }

  async scan(app: App, settings: LifeOSSettings): Promise<VaultTaskEntry[]> {
    const files = app.vault.getMarkdownFiles();
    const dailyPrefix = normalizePath(settings.dailyNotesFolder || "Life OS/Daily");
    const seenPaths = new Set<string>();
    const allEntries: VaultTaskEntry[] = [];

    for (const file of files) {
      seenPaths.add(file.path);
      const cached = this.cache.get(file.path);
      if (cached && cached.mtime === file.stat.mtime) {
        for (const item of cached.entries) {
          allEntries.push(item);
        }
        continue;
      }

      const content = await app.vault.cachedRead(file);
      const entries = extractTasksFromMarkdown(
        content,
        file,
        isDailyNoteFile(file, dailyPrefix)
      );
      this.cache.set(file.path, { mtime: file.stat.mtime, entries });
      for (const item of entries) {
        allEntries.push(item);
      }
    }

    for (const key of this.cache.keys()) {
      if (!seenPaths.has(key)) {
        this.cache.delete(key);
      }
    }

    return allEntries;
  }
}

export function getEffectiveDateIso(task: TaskItem): string | undefined {
  return task.dueDateIso ?? task.scheduledDateIso ?? task.startDateIso;
}

function getMarkdownFile(app: App, filePath: string): TFile | null {
  const file = app.vault.getFileByPath(normalizePath(filePath));
  return file ?? null;
}

function findMatchingLineIndex(lines: string[], entry: VaultTaskEntry): number {
  if (entry.lineNumber >= 0 && entry.lineNumber < lines.length) {
    const candidate = lines[entry.lineNumber]!;
    if (candidate === entry.rawLine) {
      return entry.lineNumber;
    }
    const parsedCandidate = parseTaskLine(candidate, "");
    if (parsedCandidate && parsedCandidate.title === entry.task.title) {
      return entry.lineNumber;
    }
  }

  const exactIdx = lines.findIndex((line) => line === entry.rawLine);
  if (exactIdx !== -1) {
    return exactIdx;
  }

  return lines.findIndex((line) => {
    const parsed = parseTaskLine(line, "");
    return parsed !== null && parsed.title === entry.task.title && parsed.done === entry.task.done;
  });
}

export async function toggleVaultTask(
  app: App,
  entry: VaultTaskEntry,
  plugin?: Plugin
): Promise<{ completed: boolean; nextDueIso?: string }> {
  const file = getMarkdownFile(app, entry.filePath);
  if (!file) return { completed: entry.task.done };

  let precomputedNextDate: Date | null = null;
  if (!entry.task.done && entry.task.recurrence && plugin) {
    const anchorIso = entry.task.dueDateIso ?? entry.task.scheduledDateIso;
    const baseDate = (anchorIso ? parseAnyDateKey(anchorIso) : null) ?? new Date();
    precomputedNextDate = await computeNextRecurringDate(plugin, entry.task.recurrence, baseDate);
  }

  let result: { completed: boolean; nextDueIso?: string } = { completed: entry.task.done };

  await app.vault.process(file, (content) => {
    const lines = content.split(/\r?\n/);
    const idx = findMatchingLineIndex(lines, entry);
    if (idx === -1) return content;

    const current = parseTaskLine(lines[idx]!, entry.task.id) ?? entry.task;
    const nowDone = !current.done;
    const todayIso = toISOKey(todayDMY()) ?? undefined;

    const updatedCurrent: TaskItem = {
      ...current,
      done: nowDone,
      doneDateIso: nowDone ? todayIso : undefined,
    };

    const updatedLine = serializeTaskLine(updatedCurrent, entry.indent);
    result = { completed: nowDone };

    if (nowDone && current.recurrence) {
      const anchorIso = current.dueDateIso ?? current.scheduledDateIso;
      const baseDate = (anchorIso ? parseAnyDateKey(anchorIso) : null) ?? new Date();
      let nextDate = precomputedNextDate && current.recurrence === entry.task.recurrence
        ? precomputedNextDate
        : computeSimpleRecurringDate(current.recurrence, baseDate);
      if (!nextDate) {
        nextDate = new Date(baseDate.getTime());
        nextDate.setDate(nextDate.getDate() + 1);
      }
      const nextIso = toISOKey(formatDateDMY(nextDate)) ?? undefined;

      const nextTask: TaskItem = {
        ...current,
        done: false,
        doneDateIso: undefined,
        dueDateIso:
          current.dueDateIso || !current.scheduledDateIso ? nextIso : current.dueDateIso,
        scheduledDateIso:
          !current.dueDateIso && current.scheduledDateIso ? nextIso : current.scheduledDateIso,
      };
      const nextLine = serializeTaskLine(nextTask, entry.indent);
      lines.splice(idx, 1, nextLine, updatedLine);
      result = { completed: true, nextDueIso: nextIso };
    } else {
      lines[idx] = updatedLine;
    }

    return lines.join("\n");
  });

  return result;
}

const PRIORITY_CYCLE: Record<TaskPriority, TaskPriority> = {
  none: "high",
  high: "medium",
  medium: "low",
  low: "none",
};

export async function cycleVaultTaskPriority(
  app: App,
  entry: VaultTaskEntry
): Promise<TaskPriority> {
  const file = getMarkdownFile(app, entry.filePath);
  let nextPriority: TaskPriority = PRIORITY_CYCLE[entry.task.priority];
  if (!file) return nextPriority;

  await app.vault.process(file, (content) => {
    const lines = content.split(/\r?\n/);
    const idx = findMatchingLineIndex(lines, entry);
    if (idx === -1) return content;

    const current = parseTaskLine(lines[idx]!, entry.task.id) ?? entry.task;
    nextPriority = PRIORITY_CYCLE[current.priority];
    lines[idx] = serializeTaskLine({ ...current, priority: nextPriority }, entry.indent);
    return lines.join("\n");
  });

  return nextPriority;
}

export async function postponeVaultTask(
  app: App,
  entry: VaultTaskEntry,
  days = 1
): Promise<string | undefined> {
  const file = getMarkdownFile(app, entry.filePath);
  if (!file) return undefined;

  let nextIso: string | undefined;

  await app.vault.process(file, (content) => {
    const lines = content.split(/\r?\n/);
    const idx = findMatchingLineIndex(lines, entry);
    if (idx === -1) return content;

    const current = parseTaskLine(lines[idx]!, entry.task.id) ?? entry.task;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const anchorIso = current.dueDateIso ?? current.scheduledDateIso;
    const parsedAnchor = anchorIso ? parseAnyDateKey(anchorIso) : null;
    const base =
      parsedAnchor && parsedAnchor.getTime() >= todayStart.getTime() ? parsedAnchor : todayStart;

    const shifted = new Date(base.getTime());
    shifted.setDate(shifted.getDate() + days);
    nextIso = toISOKey(formatDateDMY(shifted)) ?? undefined;
    if (!nextIso) return content;

    const updated: TaskItem = { ...current };
    if (!current.dueDateIso && current.scheduledDateIso) {
      updated.scheduledDateIso = nextIso;
    } else {
      updated.dueDateIso = nextIso;
    }

    lines[idx] = serializeTaskLine(updated, entry.indent);
    return lines.join("\n");
  });

  return nextIso;
}

export async function deleteVaultTask(app: App, entry: VaultTaskEntry): Promise<boolean> {
  const file = getMarkdownFile(app, entry.filePath);
  if (!file) return false;

  let deleted = false;
  await app.vault.process(file, (content) => {
    const lines = content.split(/\r?\n/);
    const idx = findMatchingLineIndex(lines, entry);
    if (idx === -1) return content;

    lines.splice(idx, 1);
    deleted = true;
    return lines.join("\n");
  });

  return deleted;
}

export async function addTaskToDailyNote(
  app: App,
  settings: LifeOSSettings,
  ensureNoteForDate: (dateKey: string) => Promise<TFile>,
  newTask: TaskItem,
  targetDateKey?: string
): Promise<TFile> {
  const dateKey = targetDateKey ?? todayDMY();
  const file = await ensureNoteForDate(dateKey);

  await app.vault.process(file, (md) => {
    const parsed = parseDailyNote(md, dateKey, settings);
    parsed.tasks.unshift(newTask);
    return applyParsedNoteToMarkdown(md, parsed, settings);
  });

  return file;
}
