import { normalizePath, Notice, TFile, type App } from "obsidian";
import { replaceBoundedSection } from "../core/markdown-surgery";
import { createInitialDailyNoteContent } from "../core/note-parser";
import { formatMMSS, logFocusToDailyNote, PomodoroEngine } from "../core/pomodoro-engine";
import { computePrayerTimesWithAdhan } from "../core/prayer-adhan";
import { toDMYKey, todayDMY } from "../core/date-format";
import { exportToLoopHabitsCSV, exportToSuperProductivityJSON } from "../interop/companion-export";
import {
  reconcileMobileInbox,
  writeLoopHabitsExport,
  writeSuperProductivityExport,
} from "../interop/inbox-reconciler";
import type LifeOSPlugin from "../main";
import type { LifeOSSettings } from "../types";
import { ConfirmModal } from "../ui/confirm-modal";
import { renderLifeOSSettingsUI } from "../ui/settings-tab";
import { LifeOSCockpitController, type CockpitViewHost } from "../views";

export function createCockpitController(
  host: CockpitViewHost,
  plugin: LifeOSPlugin
): LifeOSCockpitController {
  return new LifeOSCockpitController(host, plugin);
}

export async function ensureNoteForDate(
  app: App,
  settings: LifeOSSettings,
  dateKey: string
): Promise<TFile> {
  const folder = normalizePath(settings.dailyNotesFolder || "Life OS");
  if (!app.vault.getAbstractFileByPath(folder)) {
    await app.vault.createFolder(folder);
  }
  const path = normalizePath(`${folder}/${dateKey}.md`);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  const body = createInitialDailyNoteContent(dateKey, settings);
  return await app.vault.create(path, body);
}

export async function recalculatePrayersForToday(
  app: App,
  settings: LifeOSSettings
): Promise<void> {
  const dateKey = todayDMY();
  const times = computePrayerTimesWithAdhan(dateKey, settings.prayer);
  const file = await ensureNoteForDate(app, settings, dateKey);
  const lines = (["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const).map(
    (p) => `- [ ] ${p} [time:: ${times[p]}] [status:: ]`
  );
  await app.vault.process(file, (content) => replaceBoundedSection(content, "Prayers", lines));
  new Notice(`Updated prayer times for ${dateKey} via adhan-js.`);
}

export function openLegacyMigrationModal(app: App, settings: LifeOSSettings): void {
  new ConfirmModal(app, {
    title: "Migrate legacy daily notes to DD-MM-YYYY?",
    message:
      "This will rename matching YYYY-MM-DD daily notes in your configured folder to DD-MM-YYYY.",
    confirmLabel: "Run migration",
    destructive: true,
    cssPrefix: "lifeos",
    onConfirm: async () => {
      const folder = normalizePath(settings.dailyNotesFolder || "Life OS");
      const prefix = `${folder}/`;
      const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix));
      let migrated = 0;
      for (const file of files) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(file.basename)) {
          const dmy = toDMYKey(file.basename);
          if (!dmy) continue;
          const targetPath = normalizePath(`${folder}/${dmy}.md`);
          if (!app.vault.getAbstractFileByPath(targetPath)) {
            await app.fileManager.renameFile(file, targetPath);
            migrated++;
          }
        }
      }
      new Notice(`Migrated ${migrated} legacy YYYY-MM-DD note(s) to DD-MM-YYYY.`);
    },
  }).open();
}

export {
  exportToLoopHabitsCSV,
  exportToSuperProductivityJSON,
  formatMMSS,
  logFocusToDailyNote,
  PomodoroEngine,
  reconcileMobileInbox,
  renderLifeOSSettingsUI,
  writeLoopHabitsExport,
  writeSuperProductivityExport,
};

export type LifeOSCockpitChunk = {
  createCockpitController: typeof createCockpitController;
  ensureNoteForDate: typeof ensureNoteForDate;
  recalculatePrayersForToday: typeof recalculatePrayersForToday;
  openLegacyMigrationModal: typeof openLegacyMigrationModal;
  renderLifeOSSettingsUI: typeof renderLifeOSSettingsUI;
  reconcileMobileInbox: typeof reconcileMobileInbox;
  writeSuperProductivityExport: typeof writeSuperProductivityExport;
  writeLoopHabitsExport: typeof writeLoopHabitsExport;
  exportToSuperProductivityJSON: typeof exportToSuperProductivityJSON;
  exportToLoopHabitsCSV: typeof exportToLoopHabitsCSV;
  PomodoroEngine: typeof PomodoroEngine;
  logFocusToDailyNote: typeof logFocusToDailyNote;
  formatMMSS: typeof formatMMSS;
};
