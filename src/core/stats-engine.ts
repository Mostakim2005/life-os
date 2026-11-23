import { normalizePath, TFile, type App } from "obsidian";
import type { LifeOSSettings } from "../types";
import { formatDateDMY, toISOKey } from "./date-format";
import { parseDailyNote } from "./note-parser";

export interface DayStatSummary {
  dateKey: string;
  isoDate: string;
  exists: boolean;
  sleepHours: number | null;
  waterLiters: number;
  waterGlasses: number;
  prayersDone: number;
  prayersJamaah: number;
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  timelineCount: number;
  hasJournal: boolean;
}

export interface AggregateStats {
  trackedDays: number;
  avgSleep: number | null;
  avgWaterLiters: number;
  prayerCompletionPct: number;
  jamaahPct: number;
  prayerStreakDays: number;
  habitCompletionPct: number;
  tasksDoneTotal: number;
  tasksAllTotal: number;
}

function getDailyNoteFile(app: App, folder: string, dateKey: string): TFile | null {
  const cleanFolder = normalizePath(folder || "Life OS");
  const dmyPath = normalizePath(`${cleanFolder}/${dateKey}.md`);
  const dmyFile = app.vault.getAbstractFileByPath(dmyPath);
  if (dmyFile instanceof TFile) return dmyFile;

  const iso = toISOKey(dateKey);
  if (iso) {
    const isoPath = normalizePath(`${cleanFolder}/${iso}.md`);
    const isoFile = app.vault.getAbstractFileByPath(isoPath);
    if (isoFile instanceof TFile) return isoFile;
  }
  return null;
}

export async function summarizeSingleDay(
  app: App,
  settings: LifeOSSettings,
  dateKey: string
): Promise<DayStatSummary> {
  const isoDate = toISOKey(dateKey) ?? dateKey;
  const file = getDailyNoteFile(app, settings.dailyNotesFolder, dateKey);
  if (!file) {
    return {
      dateKey,
      isoDate,
      exists: false,
      sleepHours: null,
      waterLiters: 0,
      waterGlasses: 0,
      prayersDone: 0,
      prayersJamaah: 0,
      habitsDone: 0,
      habitsTotal: settings.customHabits.length,
      tasksDone: 0,
      tasksTotal: 0,
      timelineCount: 0,
      hasJournal: false,
    };
  }

  const content = await app.vault.cachedRead(file);
  const parsed = parseDailyNote(content, dateKey, settings);
  const prayersDone = parsed.prayers.filter((p) => p.done).length;
  const prayersJamaah = parsed.prayers.filter((p) => p.status === "jamaah").length;
  const habitsDone = parsed.habits.filter((h) => h.done).length;
  const tasksDone = parsed.tasks.filter((t) => t.done).length;

  return {
    dateKey,
    isoDate,
    exists: true,
    sleepHours: parsed.sleepHours,
    waterLiters: parsed.waterLiters,
    waterGlasses: parsed.waterGlasses,
    prayersDone,
    prayersJamaah,
    habitsDone,
    habitsTotal: parsed.habits.length,
    tasksDone,
    tasksTotal: parsed.tasks.length,
    timelineCount: parsed.timeline.length,
    hasJournal: Boolean(parsed.journal.trim() || parsed.reflection.trim()),
  };
}

export async function collectRecentSummaries(
  app: App,
  settings: LifeOSSettings,
  days: number,
  anchorDate: Date = new Date()
): Promise<DayStatSummary[]> {
  const out: DayStatSummary[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - i);
    const key = formatDateDMY(d);
    out.push(await summarizeSingleDay(app, settings, key));
  }
  return out;
}

export async function collectMonthSummaries(
  app: App,
  settings: LifeOSSettings,
  year: number,
  monthZeroBased: number
): Promise<Map<string, DayStatSummary>> {
  const daysInMonth = new Date(year, monthZeroBased + 1, 0).getDate();
  const map = new Map<string, DayStatSummary>();
  for (let day = 1; day <= daysInMonth; day++) {
    const key = formatDateDMY(new Date(year, monthZeroBased, day));
    map.set(key, await summarizeSingleDay(app, settings, key));
  }
  return map;
}

export function computeAggregateStats(days: DayStatSummary[]): AggregateStats {
  const existing = days.filter((d) => d.exists);
  const sleepLogged = existing.filter((d) => d.sleepHours !== null);
  const avgSleep =
    sleepLogged.length > 0
      ? Math.round(
          (sleepLogged.reduce((acc, d) => acc + (d.sleepHours ?? 0), 0) / sleepLogged.length) * 10
        ) / 10
      : null;

  const avgWaterLiters =
    existing.length > 0
      ? Math.round((existing.reduce((acc, d) => acc + d.waterLiters, 0) / existing.length) * 100) /
        100
      : 0;

  const totalPossiblePrayers = existing.length * 5;
  const totalPrayersDone = existing.reduce((acc, d) => acc + d.prayersDone, 0);
  const totalJamaah = existing.reduce((acc, d) => acc + d.prayersJamaah, 0);
  const prayerCompletionPct =
    totalPossiblePrayers > 0 ? Math.round((totalPrayersDone / totalPossiblePrayers) * 100) : 0;
  const jamaahPct =
    totalPossiblePrayers > 0 ? Math.round((totalJamaah / totalPossiblePrayers) * 100) : 0;

  let prayerStreakDays = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]!.prayersDone >= 5) {
      prayerStreakDays++;
    } else if (i < days.length - 1) {
      break;
    }
  }

  const habitsAll = existing.reduce((acc, d) => acc + d.habitsTotal, 0);
  const habitsDone = existing.reduce((acc, d) => acc + d.habitsDone, 0);
  const habitCompletionPct = habitsAll > 0 ? Math.round((habitsDone / habitsAll) * 100) : 0;

  const tasksDoneTotal = existing.reduce((acc, d) => acc + d.tasksDone, 0);
  const tasksAllTotal = existing.reduce((acc, d) => acc + d.tasksTotal, 0);

  return {
    trackedDays: existing.length,
    avgSleep,
    avgWaterLiters,
    prayerCompletionPct,
    jamaahPct,
    prayerStreakDays,
    habitCompletionPct,
    tasksDoneTotal,
    tasksAllTotal,
  };
}

/**
 * Renders a theme-aware SVG bar/line chart into a target container element
 * with zero external runtime dependencies.
 */
export function renderMetricBarChart(
  container: HTMLElement,
  days: DayStatSummary[],
  opts: {
    maxValue: number;
    targetValue?: number;
    unit: string;
    barClass: string;
    getValue: (d: DayStatSummary) => number | null;
  }
): void {
  const svgNS = "http://www.w3.org/2000/svg";
  const width = 560;
  const height = 160;
  const padLeft = 34;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "life-os-chart-svg");

  // Horizontal reference grid lines (0, 50%, 100%)
  for (const frac of [0, 0.5, 1]) {
    const y = padTop + plotH * (1 - frac);
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", String(padLeft));
    line.setAttribute("x2", String(width - padRight));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("class", "life-os-chart-grid");
    svg.appendChild(line);

    const lbl = document.createElementNS(svgNS, "text");
    lbl.setAttribute("x", String(padLeft - 6));
    lbl.setAttribute("y", String(y + 4));
    lbl.setAttribute("text-anchor", "end");
    lbl.setAttribute("class", "life-os-chart-axis");
    lbl.textContent = String(Math.round(opts.maxValue * frac * 10) / 10);
    svg.appendChild(lbl);
  }

  // Optional target dashed line
  if (opts.targetValue && opts.targetValue <= opts.maxValue) {
    const ty = padTop + plotH * (1 - opts.targetValue / opts.maxValue);
    const tline = document.createElementNS(svgNS, "line");
    tline.setAttribute("x1", String(padLeft));
    tline.setAttribute("x2", String(width - padRight));
    tline.setAttribute("y1", String(ty));
    tline.setAttribute("y2", String(ty));
    tline.setAttribute("class", "life-os-chart-target");
    svg.appendChild(tline);
  }

  const count = Math.max(1, days.length);
  const slotW = plotW / count;
  const barW = Math.max(4, Math.min(28, slotW * 0.62));
  const labelEvery = count > 14 ? 5 : count > 7 ? 2 : 1;

  days.forEach((day, idx) => {
    const val = opts.getValue(day);
    const xCenter = padLeft + slotW * idx + slotW / 2;

    if (val !== null && val > 0) {
      const clamped = Math.min(opts.maxValue, val);
      const h = (clamped / opts.maxValue) * plotH;
      const y = padTop + plotH - h;

      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(xCenter - barW / 2));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(barW));
      rect.setAttribute("height", String(Math.max(2, h)));
      rect.setAttribute("rx", "3");
      rect.setAttribute("class", `life-os-chart-bar ${opts.barClass}`);

      const title = document.createElementNS(svgNS, "title");
      title.textContent = `${day.dateKey}: ${val}${opts.unit}`;
      rect.appendChild(title);
      svg.appendChild(rect);
    }

    if (idx % labelEvery === 0 || idx === count - 1) {
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", String(xCenter));
      text.setAttribute("y", String(height - 8));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("class", "life-os-chart-axis");
      text.textContent = day.dateKey.slice(0, 5);
      svg.appendChild(text);
    }
  });

  container.appendChild(svg);
}
