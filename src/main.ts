import { App, normalizePath, Notice, Platform, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { DEFAULT_SETTINGS } from "./settings";
import type { LifeOSSettings, PrayerMethodKey, StorageMode, WaterUnit } from "./types";
import { todayDMY, toDMYKey } from "./core/date-format";
import { computePrayerTimesWithAdhan } from "./core/prayer-adhan";
import { replaceBoundedSection } from "./core/markdown-surgery";
import { createInitialDailyNoteContent } from "./core/note-parser";
import { detectObsidianEcosystem } from "./interop/bridges";
import { exportToLoopHabitsCSV, exportToSuperProductivityJSON } from "./interop/companion-export";
import {
  reconcileMobileInbox,
  writeLoopHabitsExport,
  writeSuperProductivityExport,
} from "./interop/inbox-reconciler";
import { LifeOSCockpitView, VIEW_TYPE_LIFE_OS } from "./views";
import { ConfirmModal } from "./ui/confirm-modal";

export default class LifeOSPlugin extends Plugin {
  settings!: LifeOSSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.applyThemePreferences();

    this.registerView(VIEW_TYPE_LIFE_OS, (leaf) => new LifeOSCockpitView(leaf, this));

    // Dedicated left-ribbon button to open the full-window Life OS Cockpit
    this.addRibbonIcon("layout-dashboard", "Open cockpit", () => {
      void this.activateCockpitView();
    });

    this.addCommand({
      id: "open-cockpit",
      name: "Open cockpit (full-window interactive UI)",
      callback: async () => {
        await this.activateCockpitView();
      },
    });

    this.addCommand({
      id: "open-today-dmy-note",
      name: "Open or create today's note (DD-MM-YYYY)",
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
      name: "Migrate legacy daily notes to DD-MM-YYYY",
      callback: () => {
        new ConfirmModal(this.app, {
          title: "Migrate legacy daily notes to DD-MM-YYYY?",
          message: "This will rename matching YYYY-MM-DD daily notes in your configured folder to DD-MM-YYYY.",
          confirmLabel: "Run migration",
          destructive: true,
          cssPrefix: "lifeos",
          onConfirm: () => this.migrateLegacyDateFilenames(),
        }).open();
      },
    });

    this.addCommand({
      id: "export-super-productivity-json",
      name: "Export today's tasks to Super Productivity JSON",
      callback: async () => {
        const outPath = await this.runSuperProductivityExport(todayDMY());
        new Notice(`Exported Super Productivity JSON to ${outPath}`);
      },
    });

    this.addCommand({
      id: "export-loop-habits-csv",
      name: "Export habits to Loop Habit Tracker CSV",
      callback: async () => {
        const outPath = await this.runLoopHabitsExport();
        new Notice(`Exported Loop Habit Tracker CSV to ${outPath}`);
      },
    });

    this.addCommand({
      id: "reconcile-mobile-inbox",
      name: "Reconcile mobile companion .inbox/*.jsonl events",
      callback: async () => {
        const count = await reconcileMobileInbox(this.app, this.settings, (dk) =>
          this.ensureNoteForDate(dk)
        );
        new Notice(
          count > 0
            ? `Reconciled ${count} companion event(s) into Life OS notes.`
            : "No pending .inbox/*.jsonl events found."
        );
      },
    });

    this.addCommand({
      id: "run-python-analytics",
      name: "Generate monthly analytics report (python)",
      callback: async () => {
        if (!Platform.isDesktop) {
          new Notice("Python analytics is only available on desktop.");
          return;
        }
        await this.runPythonAnalytics();
      },
    });

    this.app.workspace.onLayoutReady(() => {
      void reconcileMobileInbox(this.app, this.settings, (dk) => this.ensureNoteForDate(dk)).then(
        (count) => {
          if (count > 0) new Notice(`Life OS synced ${count} companion event(s).`);
        }
      );
    });

    const statusEl = this.addStatusBarItem();
    statusEl.addClass("lifeos-status-pill");
    statusEl.setText("Life OS: Cockpit");
    statusEl.setAttribute("role", "button");
    statusEl.setAttribute("tabindex", "0");
    statusEl.setAttribute("aria-label", "Open Life OS Cockpit");
    statusEl.addEventListener("click", () => void this.activateCockpitView());
    statusEl.addEventListener("keydown", (evt: KeyboardEvent) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        void this.activateCockpitView();
      }
    });

    this.addSettingTab(new LifeOSSettingTab(this.app, this));
  }

  onunload(): void {
    document.body.removeClass("life-os-glassmorphic");
  }

  applyThemePreferences(): void {
    document.body.toggleClass("life-os-glassmorphic", this.settings.glassmorphism !== false);
  }

  async activateCockpitView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_LIFE_OS);
    if (existing.length > 0) {
      await this.app.workspace.revealLeaf(existing[0]!);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_LIFE_OS, active: true });
    if (this.settings.autoPinCockpitTab) {
      leaf.setPinned(true);
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  async ensureTodayNote(): Promise<TFile> {
    return this.ensureNoteForDate(todayDMY());
  }

  async ensureNoteForDate(dateKey: string): Promise<TFile> {
    const folder = normalizePath(this.settings.dailyNotesFolder || "Life OS");
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const path = normalizePath(`${folder}/${dateKey}.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;

    const body = createInitialDailyNoteContent(dateKey, this.settings);
    return await this.app.vault.create(path, body);
  }

  async runSuperProductivityExport(dateKey: string): Promise<string> {
    const file = await this.ensureNoteForDate(dateKey);
    return writeSuperProductivityExport(this.app, this.settings, dateKey, file);
  }

  async runLoopHabitsExport(): Promise<string> {
    return writeLoopHabitsExport(this.app, this.settings);
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

  async runPythonAnalytics(): Promise<void> {
    if (!Platform.isDesktop) {
      new Notice("Python analytics is only available on desktop.");
      return;
    }
    const nodeReq = (
      window as unknown as {
        require?: (id: string) => { execFile: typeof import("child_process").execFile };
      }
    ).require;
    if (!nodeReq) {
      new Notice("Node runtime environment is unavailable.");
      return;
    }
    const { execFile } = nodeReq("child_process");
    const folder = normalizePath(this.settings.dailyNotesFolder || "Life OS");
    const adapter = this.app.vault.adapter as { getBasePath?: () => string };
    const basePath = adapter.getBasePath ? adapter.getBasePath() : ".";
    const scriptPath = normalizePath(`${basePath}/.obsidian/plugins/life-os/scripts/life_os_analytics.py`);

    new Notice("Generating monthly analytics report...");
    execFile(
      "python",
      [scriptPath, "--vault-folder", folder, "--days", "30"],
      { cwd: basePath },
      (err, _stdout, stderr) => {
        if (err) {
          new Notice(`Analytics failed: ${err.message}`);
          console.error("Python analytics error:", err, stderr);
        } else {
          new Notice(`Analytics generated in ${folder}/exports`);
        }
      }
    );
  }

  async loadSettings(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as Partial<LifeOSSettings>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    this.settings.prayer = Object.assign({}, DEFAULT_SETTINGS.prayer, raw.prayer ?? {});
    if (!Array.isArray(this.settings.customHabits) || this.settings.customHabits.length === 0) {
      this.settings.customHabits = [...DEFAULT_SETTINGS.customHabits];
    }
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

    new Setting(containerEl).setName("Cockpit & Markdown storage").setHeading();

    new Setting(containerEl)
      .setName("Markdown data storage mode")
      .setDesc(
        "Choose inline-only (no YAML properties block, dataview/tracker compatible) or inline + YAML frontmatter."
      )
      .addDropdown((d) =>
        d
          .addOption("inline-only", "Inline data only (no YAML properties)")
          .addOption("inline-and-frontmatter", "Inline data + YAML frontmatter (iso date)")
          .setValue(this.plugin.settings.storageMode)
          .onChange(async (val) => {
            this.plugin.settings.storageMode = val as StorageMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto-pin cockpit tab (close protection)")
      .setDesc("Automatically pins the Life OS Cockpit tab so it stays open while you browse notes.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoPinCockpitTab).onChange(async (val) => {
          this.plugin.settings.autoPinCockpitTab = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Glassmorphic theme styling")
      .setDesc("Enable frosted glass surfaces and vibrant module color accents.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.glassmorphism).onChange(async (val) => {
          this.plugin.settings.glassmorphism = val;
          this.plugin.applyThemePreferences();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("Hydration & sleep targets").setHeading();

    new Setting(containerEl)
      .setName("Default hydration unit")
      .setDesc("Switch between glasses (0–10) and water bottles (0.5-bottle increments).")
      .addDropdown((d) =>
        d
          .addOption("glasses", "Glasses (0–10)")
          .addOption("bottle", "Water Bottle (0.5 increments)")
          .setValue(this.plugin.settings.waterUnit)
          .onChange(async (val) => {
            this.plugin.settings.waterUnit = val as WaterUnit;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Water bottle capacity (liters)")
      .setDesc("Capacity of your water bottle in liters (e.g., 1.1 for a bottle slightly over 1L).")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.bottleVolumeLiters)).onChange(async (val) => {
          const n = Number(val);
          if (!Number.isNaN(n) && n >= 0.25 && n <= 5) {
            this.plugin.settings.bottleVolumeLiters = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Daily water target (liters)")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.waterTargetLiters)).onChange(async (val) => {
          const n = Number(val);
          if (!Number.isNaN(n) && n >= 0.5 && n <= 10) {
            this.plugin.settings.waterTargetLiters = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Daily sleep target (hours, 1–10)")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.sleepTargetHours)).onChange(async (val) => {
          const n = Number(val);
          if (!Number.isNaN(n) && n >= 1 && n <= 10) {
            this.plugin.settings.sleepTargetHours = Math.round(n * 2) / 2;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Default daily habits")
      .setDesc("Comma-separated list of habits shown in every new daily note.")
      .addText((t) =>
        t.setValue(this.plugin.settings.customHabits.join(", ")).onChange(async (val) => {
          const parsed = val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (parsed.length > 0) {
            this.plugin.settings.customHabits = parsed;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl).setName("Prayer schedule (adhan-js)").setHeading();

    const eco = detectObsidianEcosystem(this.app);
    containerEl.createEl("p", {
      text: `Optional companion plugins detected: Tasks(${eco.tasks ? "on" : "off"}), Day Planner(${eco.dayPlanner ? "on" : "off"}), Periodic Notes(${eco.periodicNotes ? "on" : "off"}), Dataview(${eco.dataview ? "on" : "off"}), Tracker(${eco.tracker ? "on" : "off"}). All core features are now built directly into Life OS.`,
    });

    new Setting(containerEl)
      .setName("Prayer calculation method")
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

    new Setting(containerEl)
      .setName("Latitude")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.prayer.latitude)).onChange(async (val) => {
          const n = Number(val);
          if (!Number.isNaN(n) && n >= -90 && n <= 90) {
            this.plugin.settings.prayer.latitude = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Longitude")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.prayer.longitude)).onChange(async (val) => {
          const n = Number(val);
          if (!Number.isNaN(n) && n >= -180 && n <= 180) {
            this.plugin.settings.prayer.longitude = n;
            await this.plugin.saveSettings();
          }
        })
      );
  }
}
