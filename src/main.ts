import { App, normalizePath, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { DEFAULT_SETTINGS } from "./settings";
import type { LifeOSSettings, PrayerMethodKey } from "./types";
import { todayDMY, toDMYKey } from "./core/date-format";
import { computePrayerTimesWithAdhan } from "./core/prayer-adhan";
import { replaceBoundedSection } from "./core/markdown-surgery";
import { detectObsidianEcosystem, formatDataviewMetricLine, formatInteropTaskLine } from "./interop/bridges";
import { exportToLoopHabitsCSV, exportToSuperProductivityJSON } from "./interop/companion-export";

export default class LifeOSPlugin extends Plugin {
  settings!: LifeOSSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.applyThemePreferences();

    this.addCommand({
      id: "open-today-dmy-note",
      name: "Open or create today's Life OS note (DD-MM-YYYY)",
      callback: async () => {
        const file = await this.ensureTodayNote();
        await this.app.workspace.getLeaf(false).openFile(file);
      },
    });

    this.addCommand({
      id: "recalculate-prayers-adhan",
      name: "Recalculate today's prayer times (adhan-js)",
      callback: async () => {
        const dateKey = todayDMY();
        const times = computePrayerTimesWithAdhan(dateKey, this.settings.prayer);
        const file = await this.ensureTodayNote();
        const lines = (["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const).map(
          (p) => `- [ ] ${p} [time:: ${times[p]}] [status:: ]`
        );
        await this.app.vault.process(file, (content) => replaceBoundedSection(content, "Prayers", lines));
        new Notice(`Updated prayer times for ${dateKey} via adhan-js.`);
      },
    });

    this.addCommand({
      id: "migrate-dates-to-dmy",
      name: "Migrate legacy YYYY-MM-DD daily notes to DD-MM-YYYY",
      callback: async () => this.migrateLegacyDateFilenames(),
    });

    this.addSettingTab(new LifeOSSettingTab(this.app, this));
  }

  onunload(): void {
    document.body.removeClass("life-os-glassmorphic");
  }

  applyThemePreferences(): void {
    document.body.toggleClass("life-os-glassmorphic", this.settings.glassmorphism !== false);
  }

  async ensureTodayNote(): Promise<TFile> {
    const folder = normalizePath(this.settings.dailyNotesFolder || "Life OS");
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const dateKey = todayDMY();
    const path = normalizePath(`${folder}/${dateKey}.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;

    const times = computePrayerTimesWithAdhan(dateKey, this.settings.prayer);
    const body = [
      "---",
      "life-os: 2",
      `date: ${dateKey}`,
      "sleep: ",
      "water: 0",
      "---",
      "",
      "## Prayers",
      ...(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const).map((p) => `- [ ] ${p} [time:: ${times[p]}] [status:: ]`),
      "",
      "## Habits",
      formatDataviewMetricLine("Water", "water", 0),
      "",
      "## Tasks",
      formatInteropTaskLine({ title: "Review top 3 priorities", priority: "high", dueDateKey: dateKey }),
      "",
      "## Timeline",
      "",
      "## Reflection",
      "",
    ].join("\n");
    return await this.app.vault.create(path, body);
  }

  async migrateLegacyDateFilenames(): Promise<void> {
    const folder = normalizePath(this.settings.dailyNotesFolder || "Life OS");
    const prefix = `${folder}/`;
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix));
    let migrated = 0;
    for (const file of files) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(file.basename)) {
        const dmy = toDMYKey(file.basename);
        if (!dmy) continue;
        const targetPath = normalizePath(`${folder}/${dmy}.md`);
        if (!this.app.vault.getAbstractFileByPath(targetPath)) {
          await this.app.fileManager.renameFile(file, targetPath);
          migrated++;
        }
      }
    }
    new Notice(`Migrated ${migrated} legacy YYYY-MM-DD note(s) to DD-MM-YYYY.`);
  }

  async loadSettings(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as Partial<LifeOSSettings>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    this.settings.prayer = Object.assign({}, DEFAULT_SETTINGS.prayer, raw.prayer ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  exportSuperProductivity = exportToSuperProductivityJSON;
  exportLoopHabits = exportToLoopHabitsCSV;
}

class LifeOSSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: LifeOSPlugin) {
    super(app, plugin);
  }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("Life OS v2 Settings (adhan-js + DD-MM-YYYY)").setHeading();

    const eco = detectObsidianEcosystem(this.app);
    containerEl.createEl("p", {
      text: `Detected plugins: Tasks(${eco.tasks ? "on" : "off"}), Day Planner(${eco.dayPlanner ? "on" : "off"}), Periodic Notes(${eco.periodicNotes ? "on" : "off"}), Dataview(${eco.dataview ? "on" : "off"}), Tracker(${eco.tracker ? "on" : "off"}).`,
    });

    new Setting(containerEl)
      .setName("Prayer Calculation Method (adhan-js)")
      .addDropdown((d) =>
        d
          .addOption("Karachi", "University of Islamic Sciences, Karachi")
          .addOption("MuslimWorldLeague", "Muslim World League")
          .addOption("UmmAlQura", "Umm al-Qura")
          .addOption("Egyptian", "Egyptian")
          .addOption("NorthAmerica", "ISNA (North America)")
          .setValue(this.plugin.settings.prayer.method)
          .onChange(async (val) => {
            this.plugin.settings.prayer.method = val as PrayerMethodKey;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Asr Madhab")
      .addDropdown((d) =>
        d
          .addOption("hanafi", "Hanafi")
          .addOption("shafi", "Shafi / Standard")
          .setValue(this.plugin.settings.prayer.madhab)
          .onChange(async (val) => {
            this.plugin.settings.prayer.madhab = val as "hanafi" | "shafi";
            await this.plugin.saveSettings();
          })
      );
  }
}
