import { normalizePath, TFile, type App } from "obsidian";
import type { DailyRecord, LifeOSSettings, PrayerName, PrayerStatus } from "../types";
import { formatDateDMY, parseAnyDateKey, toISOKey } from "../core/date-format";
import {
  applyParsedNoteToMarkdown,
  clampSleepHours,
  clampWaterBottles,
  clampWaterGlasses,
  computeWaterLiters,
  parseDailyNote,
} from "../core/note-parser";
import { exportToLoopHabitsCSV, exportToSuperProductivityJSON } from "./companion-export";

interface InboxEvent {
  ts?: string;
  date?: string;
  type: "prayer" | "water" | "sleep" | "habit";
  name?: string;
  status?: PrayerStatus;
  delta?: number;
  value?: number;
  unit?: "glasses" | "bottle";
  done?: boolean;
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const norm = normalizePath(folderPath);
  if (!app.vault.getAbstractFileByPath(norm)) {
    await app.vault.createFolder(norm);
  }
}

function resolveEventDateKey(ev: InboxEvent): string {
  if (ev.date) {
    const parsed = parseAnyDateKey(ev.date);
    if (parsed) return formatDateDMY(parsed);
  }
  if (ev.ts) {
    const d = new Date(ev.ts);
    if (!Number.isNaN(d.getTime())) return formatDateDMY(d);
  }
  return formatDateDMY(new Date());
}

/**
 * Conflict-free startup reconciler for Syncthing companion widgets (Guide 03).
 * Reads Life OS/.inbox/*.jsonl, applies events via vault.process(), and moves processed files.
 */
export async function reconcileMobileInbox(
  app: App,
  settings: LifeOSSettings,
  ensureNoteForDate: (dateKey: string) => Promise<TFile>
): Promise<number> {
  const baseFolder = normalizePath(settings.dailyNotesFolder || "Life OS");
  const inboxPrefix = `${baseFolder}/.inbox/`;
  const processedFolder = normalizePath(`${baseFolder}/.inbox/processed`);

  const jsonlFiles = app.vault
    .getFiles()
    .filter(
      (f) =>
        f.path.startsWith(inboxPrefix) &&
        !f.path.startsWith(`${processedFolder}/`) &&
        f.extension === "jsonl"
    );

  if (jsonlFiles.length === 0) return 0;
  await ensureFolder(app, processedFolder);

  let appliedEvents = 0;

  for (const file of jsonlFiles) {
    const raw = await app.vault.read(file);
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const byDate = new Map<string, InboxEvent[]>();
    for (const line of lines) {
      try {
        const ev = JSON.parse(line) as InboxEvent;
        if (!ev || !ev.type) continue;
        const dk = resolveEventDateKey(ev);
        const list = byDate.get(dk) ?? [];
        list.push(ev);
        byDate.set(dk, list);
      } catch {
        // Skip malformed lines without halting reconciliation
      }
    }

    for (const [dateKey, events] of byDate.entries()) {
      const noteFile = await ensureNoteForDate(dateKey);
      await app.vault.process(noteFile, (content) => {
        const note = parseDailyNote(content, dateKey, settings);
        for (const ev of events) {
          if (ev.type === "prayer" && ev.name) {
            const target = note.prayers.find(
              (p) => p.name.toLowerCase() === ev.name!.toLowerCase()
            );
            if (target) {
              const st = (ev.status ?? "prayed") as PrayerStatus;
              target.status = st;
              target.done = st === "prayed" || st === "jamaah" || st === "late";
              appliedEvents++;
            }
          } else if (ev.type === "water") {
            if (ev.unit === "bottle") {
              note.waterMode = "bottle";
              note.waterBottles = clampWaterBottles(
                ev.value !== undefined ? ev.value : note.waterBottles + (ev.delta ?? 0.5)
              );
            } else {
              note.waterMode = "glasses";
              note.waterGlasses = clampWaterGlasses(
                ev.value !== undefined ? ev.value : note.waterGlasses + (ev.delta ?? 1)
              );
            }
            note.waterLiters = computeWaterLiters(
              note.waterMode,
              note.waterGlasses,
              note.waterBottles,
              settings.glassVolumeLiters,
              settings.bottleVolumeLiters
            );
            appliedEvents++;
          } else if (ev.type === "sleep" && ev.value !== undefined) {
            note.sleepHours = clampSleepHours(ev.value);
            appliedEvents++;
          } else if (ev.type === "habit" && ev.name) {
            const existing = note.habits.find(
              (h) => h.name.toLowerCase() === ev.name!.toLowerCase()
            );
            if (existing) {
              existing.done = ev.done ?? true;
            } else {
              note.habits.push({ name: ev.name, done: ev.done ?? true });
            }
            appliedEvents++;
          }
        }
        return applyParsedNoteToMarkdown(content, note, settings);
      });
    }

    const destPath = normalizePath(`${processedFolder}/${file.name}`);
    const existingDest = app.vault.getAbstractFileByPath(destPath);
    if (existingDest instanceof TFile) {
      const stamped = normalizePath(`${processedFolder}/${Date.now()}-${file.name}`);
      await app.fileManager.renameFile(file, stamped);
    } else {
      await app.fileManager.renameFile(file, destPath);
    }
  }

  return appliedEvents;
}

export async function writeSuperProductivityExport(
  app: App,
  settings: LifeOSSettings,
  dateKey: string,
  noteFile: TFile
): Promise<string> {
  const baseFolder = normalizePath(settings.dailyNotesFolder || "Life OS");
  const exportFolder = normalizePath(`${baseFolder}/exports`);
  await ensureFolder(app, exportFolder);

  const content = await app.vault.read(noteFile);
  const parsed = parseDailyNote(content, dateKey, settings);
  const payload = exportToSuperProductivityJSON(
    dateKey,
    parsed.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done, estimateMin: 30 }))
  );

  const outPath = normalizePath(`${exportFolder}/sp-${dateKey}.json`);
  const existing = app.vault.getAbstractFileByPath(outPath);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, payload);
  } else {
    await app.vault.create(outPath, payload);
  }
  return outPath;
}

export async function writeLoopHabitsExport(
  app: App,
  settings: LifeOSSettings
): Promise<string> {
  const baseFolder = normalizePath(settings.dailyNotesFolder || "Life OS");
  const exportFolder = normalizePath(`${baseFolder}/exports`);
  await ensureFolder(app, exportFolder);

  const prefix = `${baseFolder}/`;
  const mdFiles = app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith(prefix) && parseAnyDateKey(f.basename) !== null)
    .sort((a, b) => (toISOKey(a.basename) ?? "").localeCompare(toISOKey(b.basename) ?? ""));

  const habitKeySet = new Set<string>(settings.customHabits);
  const records: DailyRecord[] = [];

  for (const f of mdFiles) {
    const raw = await app.vault.cachedRead(f);
    const parsed = parseDailyNote(raw, f.basename, settings);
    const habitMap: Record<string, boolean> = {};
    for (const h of parsed.habits) {
      habitKeySet.add(h.name);
      habitMap[h.name] = h.done;
    }
    for (const p of parsed.prayers) {
      const key = `Prayer:${p.name as PrayerName}`;
      habitKeySet.add(key);
      habitMap[key] = p.done;
    }
    records.push({
      dateKey: parsed.dateKey,
      isoDate: parsed.isoDate,
      sleep: parsed.sleepHours ?? undefined,
      water: parsed.waterGlasses,
      waterLiters: parsed.waterLiters,
      habits: habitMap,
    });
  }

  const csv = exportToLoopHabitsCSV(records, Array.from(habitKeySet));
  const outPath = normalizePath(`${exportFolder}/loop-checkmarks.csv`);
  const existing = app.vault.getAbstractFileByPath(outPath);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, csv);
  } else {
    await app.vault.create(outPath, csv);
  }
  return outPath;
}
