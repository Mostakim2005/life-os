import type {
  HabitItem,
  LifeOSSettings,
  ParsedDailyNote,
  PrayerEntry,
  PrayerName,
  PrayerStatus,
  TaskItem,
  TaskPriority,
  TimelineBlock,
  WaterUnit,
} from "../types";
import { toISOKey } from "./date-format";
import { replaceBoundedSection } from "./markdown-surgery";
import { computePrayerTimesWithAdhan } from "./prayer-adhan";

export const PRAYER_NAMES: readonly PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

export const SLEEP_MIN_HOURS = 1.0;
export const SLEEP_MAX_HOURS = 10.0;
export const SLEEP_STEP_HOURS = 0.5;

export const WATER_GLASS_MIN = 0;
export const WATER_GLASS_MAX = 10;

export const WATER_BOTTLE_MIN = 0;
export const WATER_BOTTLE_MAX = 5.0;
export const WATER_BOTTLE_STEP = 0.5;

export function clampSleepHours(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  if (n < SLEEP_MIN_HOURS) return SLEEP_MIN_HOURS;
  if (n > SLEEP_MAX_HOURS) return SLEEP_MAX_HOURS;
  return Math.round(n * 2) / 2;
}

export function clampWaterGlasses(value: number): number {
  const n = Math.round(Number(value) || 0);
  return Math.max(WATER_GLASS_MIN, Math.min(WATER_GLASS_MAX, n));
}

export function clampWaterBottles(value: number): number {
  const n = Number(value) || 0;
  const clamped = Math.max(WATER_BOTTLE_MIN, Math.min(WATER_BOTTLE_MAX, n));
  return Math.round(clamped * 2) / 2;
}

export function computeWaterLiters(
  mode: WaterUnit,
  glasses: number,
  bottles: number,
  glassVolumeLiters: number,
  bottleVolumeLiters: number
): number {
  const raw = mode === "bottle" ? bottles * bottleVolumeLiters : glasses * glassVolumeLiters;
  return Math.round(raw * 100) / 100;
}

function extractSectionLines(markdown: string, headingName: string): string[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const targetHeader = `## ${headingName}`;
  let inFence = false;
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (startIdx === -1) {
      if (line.trim() === targetHeader) {
        startIdx = i;
      }
    } else if (/^##\s+/.test(line)) {
      endIdx = i;
      break;
    }
  }

  if (startIdx === -1) return [];
  return lines.slice(startIdx + 1, endIdx);
}

function extractInlineField(text: string, key: string): string | null {
  const re = new RegExp(`\\[${key}::\\s*([^\\]]*)\\]`, "i");
  const match = re.exec(text);
  return match ? match[1]!.trim() : null;
}

function extractFrontmatterValue(markdown: string, key: string): string | null {
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!fmMatch) return null;
  const body = fmMatch[1]!;
  const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const m = re.exec(body);
  return m ? m[1]!.trim() : null;
}

function normalizePrayerStatus(raw: string | null, checked: boolean): PrayerStatus {
  const clean = (raw || "").trim().toLowerCase();
  if (clean === "jamaah" || clean === "prayed" || clean === "late" || clean === "missed") {
    return clean;
  }
  return checked ? "prayed" : "";
}

export function parseDailyNote(
  markdown: string,
  dateKey: string,
  settings: LifeOSSettings
): ParsedDailyNote {
  const isoDate = toISOKey(dateKey) ?? dateKey;
  const computedTimes = computePrayerTimesWithAdhan(dateKey, settings.prayer);

  // 1. Sleep (inline first, legacy frontmatter fallback)
  const sleepRaw = extractInlineField(markdown, "sleep") ?? extractFrontmatterValue(markdown, "sleep");
  const sleepNum = sleepRaw !== null && sleepRaw !== "" ? Number(sleepRaw) : null;
  const sleepHours = sleepNum !== null && !Number.isNaN(sleepNum) ? clampSleepHours(sleepNum) : null;

  // 2. Water (mode + glasses + bottles)
  const waterModeRaw = extractInlineField(markdown, "water_mode");
  const waterMode: WaterUnit =
    waterModeRaw === "bottle" || waterModeRaw === "glasses" ? waterModeRaw : settings.waterUnit;

  const waterGlassesRaw =
    extractInlineField(markdown, "water") ?? extractFrontmatterValue(markdown, "water") ?? "0";
  const waterGlasses = clampWaterGlasses(Number(waterGlassesRaw));

  const waterBottlesRaw = extractInlineField(markdown, "water_bottles");
  const waterBottles =
    waterBottlesRaw !== null && waterBottlesRaw !== ""
      ? clampWaterBottles(Number(waterBottlesRaw))
      : clampWaterBottles(
          (waterGlasses * settings.glassVolumeLiters) / Math.max(0.1, settings.bottleVolumeLiters)
        );

  const waterLiters = computeWaterLiters(
    waterMode,
    waterGlasses,
    waterBottles,
    settings.glassVolumeLiters,
    settings.bottleVolumeLiters
  );

  // 3. Prayers
  const prayerLines = extractSectionLines(markdown, "Prayers");
  const prayerMap = new Map<PrayerName, PrayerEntry>();
  for (const name of PRAYER_NAMES) {
    prayerMap.set(name, {
      name,
      time: computedTimes[name],
      status: "",
      done: false,
    });
  }
  for (const line of prayerLines) {
    const m = /^\s*-\s*\[([ xX])\]\s*(Fajr|Dhuhr|Asr|Maghrib|Isha)\b/.exec(line);
    if (!m) continue;
    const checked = m[1]!.toLowerCase() === "x";
    const name = m[2]! as PrayerName;
    const time = extractInlineField(line, "time") || computedTimes[name];
    const status = normalizePrayerStatus(extractInlineField(line, "status"), checked);
    prayerMap.set(name, {
      name,
      time,
      status,
      done: status === "prayed" || status === "jamaah" || status === "late",
    });
  }

  // 4. Habits (excluding Sleep/Water metric lines)
  const habitLines = extractSectionLines(markdown, "Habits");
  const parsedHabits = new Map<string, boolean>();
  for (const line of habitLines) {
    const m = /^\s*-\s*\[([ xX])\]\s*(.+)$/.exec(line);
    if (!m) continue;
    const checked = m[1]!.toLowerCase() === "x";
    const cleanName = m[2]!.replace(/\[[a-zA-Z0-9_-]+::[^\]]*\]/g, "").trim();
    if (cleanName) parsedHabits.set(cleanName, checked);
  }
  const habitOrder = [...settings.customHabits];
  for (const existingName of parsedHabits.keys()) {
    if (!habitOrder.includes(existingName)) {
      habitOrder.push(existingName);
    }
  }
  const habits: HabitItem[] = habitOrder.map((name) => ({
    name,
    done: parsedHabits.get(name) ?? false,
  }));

  // 5. Tasks
  const taskLines = extractSectionLines(markdown, "Tasks");
  const tasks: TaskItem[] = [];
  taskLines.forEach((line, idx) => {
    const parsed = parseTaskLine(line, `task-${idx}`);
    if (!parsed) return;
    parsed.id = `task-${idx}-${parsed.title.slice(0, 12)}`;
    tasks.push(parsed);
  });

  // 6. Timeline
  const timelineLines = extractSectionLines(markdown, "Timeline");
  const timeline: TimelineBlock[] = [];
  timelineLines.forEach((line, idx) => {
    const m = /^\s*-\s*\[([ xX])\]\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s+(.+)$/.exec(line);
    if (!m) return;
    timeline.push({
      id: `block-${idx}-${m[2]}`,
      done: m[1]!.toLowerCase() === "x",
      startTime: m[2]!,
      endTime: m[3]!,
      title: m[4]!.trim(),
    });
  });

  // 7. Daily Journal & Reflection
  const journal = extractSectionLines(markdown, "Daily Journal").join("\n").trim();
  const reflection = extractSectionLines(markdown, "Reflection").join("\n").trim();

  return {
    dateKey,
    isoDate,
    sleepHours,
    waterMode,
    waterGlasses,
    waterBottles,
    waterLiters,
    prayers: PRAYER_NAMES.map((n) => prayerMap.get(n)!),
    habits,
    tasks,
    timeline,
    journal,
    reflection,
  };
}

export function buildPrayerSectionLines(prayers: PrayerEntry[]): string[] {
  return prayers.map((p) => {
    const box = p.done ? "[x]" : "[ ]";
    return `- ${box} ${p.name} [time:: ${p.time}] [status:: ${p.status}]`;
  });
}

export function buildHabitsSectionLines(note: ParsedDailyNote, settings: LifeOSSettings): string[] {
  const lines: string[] = [];
  if (settings.sleepTracking) {
    const sleepVal = note.sleepHours !== null ? String(note.sleepHours) : "";
    lines.push(`- Sleep: [sleep:: ${sleepVal}]`);
  }
  if (settings.waterTracking) {
    const liters = computeWaterLiters(
      note.waterMode,
      note.waterGlasses,
      note.waterBottles,
      settings.glassVolumeLiters,
      settings.bottleVolumeLiters
    );
    const equivGlasses =
      note.waterMode === "bottle"
        ? clampWaterGlasses(Math.round(liters / Math.max(0.1, settings.glassVolumeLiters)))
        : note.waterGlasses;
    lines.push(
      `- Water: [water_mode:: ${note.waterMode}] [water:: ${equivGlasses}] [water_bottles:: ${note.waterBottles}] [water_liters:: ${liters.toFixed(2)}]`
    );
  }
  if (settings.habitTracking) {
    for (const h of note.habits) {
      const box = h.done ? "[x]" : "[ ]";
      lines.push(`- ${box} ${h.name}`);
    }
  }
  return lines;
}

export function parseTaskLine(line: string, id: string): TaskItem | null {
  const m = /^\s*[-*]\s*\[([ xX])\]\s*(.+)$/.exec(line);
  if (!m) return null;
  const done = m[1]!.toLowerCase() === "x";
  let rest = m[2]!.trim();

  let priority: TaskPriority = "none";
  if (/[⏫🔺]/u.test(rest)) {
    priority = "high";
    rest = rest.replace(/[⏫🔺]/gu, "");
  } else if (rest.includes("🔼")) {
    priority = "medium";
    rest = rest.replace(/🔼/g, "");
  } else if (/[🔽⏬]/u.test(rest)) {
    priority = "low";
    rest = rest.replace(/[🔽⏬]/gu, "");
  }

  let startDateIso: string | undefined;
  const startMatch = /🛫\s*(\d{4}-\d{2}-\d{2})/u.exec(rest);
  if (startMatch) {
    startDateIso = startMatch[1];
    rest = rest.replace(startMatch[0], "");
  }

  let scheduledDateIso: string | undefined;
  const scheduledMatch = /⏳\s*(\d{4}-\d{2}-\d{2})/u.exec(rest);
  if (scheduledMatch) {
    scheduledDateIso = scheduledMatch[1];
    rest = rest.replace(scheduledMatch[0], "");
  }

  let dueDateIso: string | undefined;
  const dueMatch = /📅\s*(\d{4}-\d{2}-\d{2})/u.exec(rest);
  if (dueMatch) {
    dueDateIso = dueMatch[1];
    rest = rest.replace(dueMatch[0], "");
  }

  let doneDateIso: string | undefined;
  const doneMatch = /✅\s*(\d{4}-\d{2}-\d{2})/u.exec(rest);
  if (doneMatch) {
    doneDateIso = doneMatch[1];
    rest = rest.replace(doneMatch[0], "");
  }

  let recurrence: string | undefined;
  const repeatMatch = /🔁\s*([^\s📅✅⏳🛫⏫🔼🔽🔺⏬🔁]+(?:\s+[^\s📅✅⏳🛫⏫🔼🔽🔺⏬🔁]+)*)/u.exec(rest);
  if (repeatMatch && repeatMatch[1]) {
    recurrence = repeatMatch[1].trim();
    rest = rest.replace(repeatMatch[0], "");
  }

  const title = rest.replace(/\s+/g, " ").trim();
  if (!title) return null;

  const tagSet = new Set<string>();
  const tagRe = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(title)) !== null) {
    if (tm[1]) tagSet.add(tm[1].toLowerCase());
  }
  const tags = tagSet.size > 0 ? Array.from(tagSet) : undefined;

  return {
    id,
    title,
    done,
    priority,
    dueDateIso,
    scheduledDateIso,
    startDateIso,
    doneDateIso,
    recurrence,
    tags,
  };
}

export function serializeTaskLine(task: TaskItem, indent = ""): string {
  const box = task.done ? "[x]" : "[ ]";
  const prio =
    task.priority === "high" ? " ⏫" : task.priority === "medium" ? " 🔼" : task.priority === "low" ? " 🔽" : "";
  const repeat = task.recurrence ? ` 🔁 ${task.recurrence}` : "";
  const start = task.startDateIso ? ` 🛫 ${task.startDateIso}` : "";
  const scheduled = task.scheduledDateIso ? ` ⏳ ${task.scheduledDateIso}` : "";
  const due = task.dueDateIso ? ` 📅 ${task.dueDateIso}` : "";
  const doneSuffix = task.done && task.doneDateIso ? ` ✅ ${task.doneDateIso}` : "";
  return `${indent}- ${box} ${task.title}${prio}${repeat}${start}${scheduled}${due}${doneSuffix}`;
}

export function buildTasksSectionLines(tasks: TaskItem[]): string[] {
  return tasks.map((t) => serializeTaskLine(t));
}

export function buildTimelineSectionLines(blocks: TimelineBlock[]): string[] {
  return blocks
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((b) => `- [${b.done ? "x" : " "}] ${b.startTime} - ${b.endTime} ${b.title}`);
}

function syncFrontmatterBlock(
  markdown: string,
  note: ParsedDailyNote,
  settings: LifeOSSettings
): string {
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  const hasFrontmatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(markdown);

  if (settings.storageMode === "inline-only") {
    // Strip YAML frontmatter when inline-only mode is selected, keeping inline metadata header
    const withoutFm = hasFrontmatter
      ? markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
      : markdown;
    if (/\[life-os::/.test(withoutFm)) {
      return withoutFm;
    }
    return `[life-os:: 3] [date:: ${note.dateKey}]${eol}${eol}${withoutFm.trimStart()}`;
  }

  // inline-and-frontmatter mode: emit valid ISO YYYY-MM-DD date so Obsidian Properties parses cleanly
  const liters = computeWaterLiters(
    note.waterMode,
    note.waterGlasses,
    note.waterBottles,
    settings.glassVolumeLiters,
    settings.bottleVolumeLiters
  );
  const fmLines = [
    "---",
    "life-os: 3",
    `date: ${note.isoDate}`,
    `sleep: ${note.sleepHours !== null ? note.sleepHours : ""}`,
    `water: ${note.waterGlasses}`,
    `water_liters: ${liters.toFixed(2)}`,
    "---",
  ].join(eol);

  if (hasFrontmatter) {
    return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---/, fmLines);
  }
  return `${fmLines}${eol}${eol}${markdown.trimStart()}`;
}

export function createInitialDailyNoteContent(dateKey: string, settings: LifeOSSettings): string {
  const isoDate = toISOKey(dateKey) ?? dateKey;
  const times = computePrayerTimesWithAdhan(dateKey, settings.prayer);
  const emptyNote: ParsedDailyNote = {
    dateKey,
    isoDate,
    sleepHours: null,
    waterMode: settings.waterUnit,
    waterGlasses: 0,
    waterBottles: 0,
    waterLiters: 0,
    prayers: PRAYER_NAMES.map((name) => ({
      name,
      time: times[name],
      status: "",
      done: false,
    })),
    habits: settings.customHabits.map((name) => ({ name, done: false })),
    tasks: [
      {
        id: "task-0",
        title: "Review top 3 priorities",
        done: false,
        priority: "medium",
        dueDateIso: isoDate,
      },
    ],
    timeline: [],
    journal: "",
    reflection: "",
  };

  const headerLines =
    settings.storageMode === "inline-only"
      ? [`[life-os:: 3] [date:: ${dateKey}]`, ""]
      : [
          "---",
          "life-os: 3",
          `date: ${isoDate}`,
          "sleep: ",
          "water: 0",
          "water_liters: 0.00",
          "---",
          "",
        ];

  return [
    ...headerLines,
    "## Prayers",
    ...buildPrayerSectionLines(emptyNote.prayers),
    "",
    "## Habits",
    ...buildHabitsSectionLines(emptyNote, settings),
    "",
    "## Tasks",
    ...buildTasksSectionLines(emptyNote.tasks),
    "",
    "## Timeline",
    "",
    "## Daily Journal",
    "",
    "## Reflection",
    "",
  ].join("\n");
}

export function applyParsedNoteToMarkdown(
  existingMarkdown: string,
  note: ParsedDailyNote,
  settings: LifeOSSettings
): string {
  let out = syncFrontmatterBlock(existingMarkdown, note, settings);
  out = replaceBoundedSection(out, "Prayers", buildPrayerSectionLines(note.prayers));
  out = replaceBoundedSection(out, "Habits", buildHabitsSectionLines(note, settings));
  out = replaceBoundedSection(out, "Tasks", buildTasksSectionLines(note.tasks));
  out = replaceBoundedSection(out, "Timeline", buildTimelineSectionLines(note.timeline));
  out = replaceBoundedSection(out, "Daily Journal", note.journal ? note.journal.split(/\r?\n/) : []);
  out = replaceBoundedSection(out, "Reflection", note.reflection ? note.reflection.split(/\r?\n/) : []);
  return out;
}
