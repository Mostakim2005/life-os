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
import {
  formatMMSS,
  logFocusToDailyNote,
  PomodoroEngine,
  type PomodoroSnapshot,
} from "./core/pomodoro-engine";

export default class LifeOSPlugin extends Plugin {
  settings: LifeOSSettings = {
    ...DEFAULT_SETTINGS,
    prayer: { ...DEFAULT_SETTINGS.prayer },
    customHabits: [...DEFAULT_SETTINGS.customHabits],
    pomodoro: { ...DEFAULT_SETTINGS.pomodoro },
  };
  private settingsReady: Promise<void> = Promise.resolve();
  private pomodoroEngine: PomodoroEngine | null = null;
  private statusEl: HTMLElement | null = null;
  private unsubscribeStatus: (() => void) | null = null;

  onload(): void {
    this.settingsReady = this.loadSettings().then(() => {
      this.applyThemePreferences();
    });

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

    this.addCommand({
      id: "toggle-pomodoro-timer",
      name: "Start or pause focus timer",
      callback: () => {
        const engine = this.ensurePomodoroEngine();
        engine.toggleStartPause();
      },
    });

    this.addCommand({
      id: "toggle-zen-focus-mode",
      name: "Toggle distraction-free focus mode",
      callback: async () => {
        await this.activateCockpitView(true);
      },
    });

    this.app.workspace.onLayoutReady(() => {
      void this.settingsReady.then(() =>
        reconcileMobileInbox(this.app, this.settings, (dk) => this.ensureNoteForDate(dk)).then(
          (count) => {
            if (count > 0) new Notice(`Life OS synced ${count} companion event(s).`);
          }
        )
      );
    });

    const statusEl = this.addStatusBarItem();
    this.statusEl = statusEl;
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
    if (this.unsubscribeStatus) {
      this.unsubscribeStatus();
      this.unsubscribeStatus = null;
    }
    this.pomodoroEngine?.destroy();
    this.pomodoroEngine = null;
  }

  private updateStatusBarPill(snap?: PomodoroSnapshot): void {
    if (!this.statusEl) return;
    if (!snap || snap.status === "idle") {
      this.statusEl.removeClass("is-focus-running", "is-focus-paused");
      this.statusEl.setText("Life OS: Cockpit");
      return;
    }
    const clock = formatMMSS(snap.remainingSeconds);
    const phaseGlyph = snap.phase === "work" ? "🍅" : "☕";
    const statusPrefix = snap.status === "paused" ? "⏸" : phaseGlyph;
    const labelSuffix = snap.targetTitle ? ` · ${snap.targetTitle.slice(0, 18)}` : "";
    this.statusEl.toggleClass("is-focus-running", snap.status === "running");
    this.statusEl.toggleClass("is-focus-paused", snap.status === "paused");
    this.statusEl.setText(`${statusPrefix} ${clock}${labelSuffix}`);
  }

  ensurePomodoroEngine(): PomodoroEngine {
    if (!this.pomodoroEngine) {
      this.pomodoroEngine = new PomodoroEngine(
        () => this.settings.pomodoro,
        async (payload) => {
          if (payload.phase === "work") {
            const summary = await logFocusToDailyNote(
              this.app,
              this.settings,
              () => this.ensureTodayNote(),
              payload.elapsedMinutes,
              1,
              payload.targetTitle,
              payload.startedAtMs,
              payload.endedAtMs
            );
            new Notice(
              `Focus session complete (+${payload.elapsedMinutes}m · ${summary.totalMinutes}m today)`
            );
          } else {
            new Notice("Break complete. Ready for next focus sprint.");
          }
          await this.refreshOpenCockpitViews();
        }
      );
      this.unsubscribeStatus = this.pomodoroEngine.subscribe((snap) => {
        this.updateStatusBarPill(snap);
      });
    }
    return this.pomodoroEngine;
  }

  async refreshOpenCockpitViews(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LIFE_OS);
    for (const leaf of leaves) {
      if (leaf.view instanceof LifeOSCockpitView) {
        await leaf.view.refreshView();
      }
    }
  }

  applyThemePreferences(): void {
    document.body.toggleClass("life-os-glassmorphic", this.settings.glassmorphism !== false);
  }

  async activateCockpitView(toggleZenFocus = false): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_LIFE_OS);
    if (existing.length > 0) {
      const targetLeaf = existing[0]!;
      await this.app.workspace.revealLeaf(targetLeaf);
      if (toggleZenFocus && targetLeaf.view instanceof LifeOSCockpitView) {
        await targetLeaf.view.toggleZenFocusMode();
      }
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_LIFE_OS, active: true });
    if (this.settings.autoPinCockpitTab) {
      leaf.setPinned(true);
    }
    await this.app.workspace.revealLeaf(leaf);
    if (toggleZenFocus && leaf.view instanceof LifeOSCockpitView) {
      await leaf.view.toggleZenFocusMode(true);
    }
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
    this.settings.pomodoro = Object.assign({}, DEFAULT_SETTINGS.pomodoro, raw.pomodoro ?? {});
    if (!Array.isArray(this.settings.customHabits) || this.settings.customHabits.length === 0) {
      this.settings.customHabits = [...DEFAULT_SETTINGS.customHabits];
    }
  }

  async saveSettings(): Promise<void> {
    await this.settingsReady;
    await this.saveData(this.settings);
    this.pomodoroEngine?.syncSettingsDefaultsIfIdle();
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

    new Setting(containerEl).setName("Pomodoro & focus timer").setHeading();

    new Setting(containerEl)
      .setName("Focus duration (minutes)")
      .setDesc("Length of each work sprint (1–180 minutes).")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.pomodoro.workMinutes)).onChange(async (val) => {
          const n = Math.round(Number(val));
          if (!Number.isNaN(n) && n >= 1 && n <= 180) {
            this.plugin.settings.pomodoro.workMinutes = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Short break (minutes)")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.pomodoro.shortBreakMinutes)).onChange(async (val) => {
          const n = Math.round(Number(val));
          if (!Number.isNaN(n) && n >= 1 && n <= 60) {
            this.plugin.settings.pomodoro.shortBreakMinutes = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Long break (minutes)")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.pomodoro.longBreakMinutes)).onChange(async (val) => {
          const n = Math.round(Number(val));
          if (!Number.isNaN(n) && n >= 1 && n <= 90) {
            this.plugin.settings.pomodoro.longBreakMinutes = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Daily focus goal (minutes)")
      .setDesc("Goal target line displayed on the Focus Minutes chart and progress bar.")
      .addText((t) =>
        t
          .setValue(String(this.plugin.settings.pomodoro.dailyFocusTargetMinutes))
          .onChange(async (val) => {
            const n = Math.round(Number(val));
            if (!Number.isNaN(n) && n >= 10 && n <= 720) {
              this.plugin.settings.pomodoro.dailyFocusTargetMinutes = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Play completion chime")
      .setDesc("Play a soft gentle chime when a focus sprint or break ends.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.pomodoro.soundEnabled).onChange(async (val) => {
          this.plugin.settings.pomodoro.soundEnabled = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Log completed sessions to timeline")
      .setDesc("Automatically append finished focus sprints to today's Timeline section.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.pomodoro.logTimeblockOnComplete)
          .onChange(async (val) => {
            this.plugin.settings.pomodoro.logTimeblockOnComplete = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto-start breaks")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.pomodoro.autoStartBreaks).onChange(async (val) => {
          this.plugin.settings.pomodoro.autoStartBreaks = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Auto-start next focus session")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.pomodoro.autoStartWork).onChange(async (val) => {
          this.plugin.settings.pomodoro.autoStartWork = val;
          await this.plugin.saveSettings();
        })
      );
  }
}
