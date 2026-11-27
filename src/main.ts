import {
  App,
  ItemView,
  normalizePath,
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";
import type { LifeOSChartsChunk } from "./chunks/charts";
import type { LifeOSCockpitChunk } from "./chunks/cockpit";
import { clearLoadedChunks, loadPluginChunkAsync, scheduleIdleTask } from "./core/chunk-loader";
import { todayDMY } from "./core/date-format";
import type { PomodoroEngine, PomodoroSnapshot } from "./core/pomodoro-engine";
import { DEFAULT_SETTINGS } from "./settings";
import type { LifeOSSettings } from "./types";
import type { LifeOSCockpitController } from "./views";

export const VIEW_TYPE_LIFE_OS = "life-os-cockpit-view";

const COCKPIT_CHUNK = "lifeos-cockpit.chunk.js";
const CHARTS_CHUNK = "lifeos-charts.chunk.js";

function formatClockMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export class LifeOSCockpitView extends ItemView {
  private plugin: LifeOSPlugin;
  private controller: LifeOSCockpitController | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LifeOSPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_LIFE_OS;
  }

  getDisplayText(): string {
    return "Life OS Cockpit";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    await this.plugin.ensureSettingsReady();
    const chunk = await this.plugin.ensureCockpitChunk();
    this.controller = chunk.createCockpitController(this, this.plugin);
    await this.controller.onOpen();
  }

  async onClose(): Promise<void> {
    if (this.controller) {
      await this.controller.onClose();
      this.controller = null;
    }
  }

  async refreshView(): Promise<void> {
    await this.controller?.refreshView();
  }

  async toggleZenFocusMode(force?: boolean): Promise<void> {
    await this.controller?.toggleZenFocusMode(force);
  }
}

class LazyLifeOSSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: LifeOSPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const loadingEl = containerEl.createEl("p", { text: "Loading Life OS settings..." });
    void (async () => {
      await this.plugin.ensureSettingsReady();
      const chunk = await this.plugin.ensureCockpitChunk();
      loadingEl.remove();
      chunk.renderLifeOSSettingsUI(containerEl, this.app, this.plugin);
    })();
  }
}

export default class LifeOSPlugin extends Plugin {
  settings: LifeOSSettings = {
    ...DEFAULT_SETTINGS,
    prayer: { ...DEFAULT_SETTINGS.prayer },
    customHabits: [...DEFAULT_SETTINGS.customHabits],
    pomodoro: { ...DEFAULT_SETTINGS.pomodoro },
  };
  private settingsReady: Promise<void> = Promise.resolve();
  private cockpitChunk: LifeOSCockpitChunk | null = null;
  private cockpitPromise: Promise<LifeOSCockpitChunk> | null = null;
  private chartsPromise: Promise<LifeOSChartsChunk> | null = null;
  private pomodoroEngine: PomodoroEngine | null = null;
  private statusEl: HTMLElement | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private cancelIdleTask: (() => void) | null = null;

  onload(): void {
    this.settingsReady = this.loadSettings();

    this.registerView(VIEW_TYPE_LIFE_OS, (leaf) => new LifeOSCockpitView(leaf, this));

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
        await this.settingsReady;
        const file = await this.ensureTodayNote();
        await this.app.workspace.getLeaf(false).openFile(file);
      },
    });

    this.addCommand({
      id: "recalculate-prayers-adhan",
      name: "Recalculate today's prayer times (adhan-js)",
      callback: async () => {
        await this.settingsReady;
        const chunk = await this.ensureCockpitChunk();
        await chunk.recalculatePrayersForToday(this.app, this.settings);
      },
    });

    this.addCommand({
      id: "migrate-dates-to-dmy",
      name: "Migrate legacy daily notes to DD-MM-YYYY",
      callback: async () => {
        await this.settingsReady;
        const chunk = await this.ensureCockpitChunk();
        chunk.openLegacyMigrationModal(this.app, this.settings);
      },
    });

    this.addCommand({
      id: "export-super-productivity-json",
      name: "Export today's tasks to Super Productivity JSON",
      callback: async () => {
        await this.settingsReady;
        const outPath = await this.runSuperProductivityExport(todayDMY());
        new Notice(`Exported Super Productivity JSON to ${outPath}`);
      },
    });

    this.addCommand({
      id: "export-loop-habits-csv",
      name: "Export habits to Loop Habit Tracker CSV",
      callback: async () => {
        await this.settingsReady;
        const outPath = await this.runLoopHabitsExport();
        new Notice(`Exported Loop Habit Tracker CSV to ${outPath}`);
      },
    });

    this.addCommand({
      id: "reconcile-mobile-inbox",
      name: "Reconcile mobile companion .inbox/*.jsonl events",
      callback: async () => {
        await this.settingsReady;
        const chunk = await this.ensureCockpitChunk();
        const count = await chunk.reconcileMobileInbox(this.app, this.settings, (dk) =>
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
        await this.settingsReady;
        await this.runPythonAnalytics();
      },
    });

    this.addCommand({
      id: "toggle-pomodoro-timer",
      name: "Start or pause focus timer",
      callback: async () => {
        await this.settingsReady;
        const chunk = await this.ensureCockpitChunk();
        const engine = this.ensurePomodoroEngineWithChunk(chunk);
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
      this.cancelIdleTask = scheduleIdleTask(() => {
        void this.settingsReady.then(async () => {
          const baseFolder = normalizePath(this.settings.dailyNotesFolder || "Life OS");
          const inboxFolder = this.app.vault.getAbstractFileByPath(normalizePath(`${baseFolder}/.inbox`));
          if (!(inboxFolder instanceof TFolder)) return;
          const hasPendingJsonl = inboxFolder.children.some(
            (child) => child instanceof TFile && child.extension === "jsonl"
          );
          if (!hasPendingJsonl) return;

          const chunk = await this.ensureCockpitChunk();
          const count = await chunk.reconcileMobileInbox(this.app, this.settings, (dk) =>
            this.ensureNoteForDate(dk)
          );
          if (count > 0) new Notice(`Life OS synced ${count} companion event(s).`);
        });
      }, 2000);
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

    this.addSettingTab(new LazyLifeOSSettingTab(this.app, this));
  }

  onunload(): void {
    this.cancelIdleTask?.();
    this.cancelIdleTask = null;
    if (this.unsubscribeStatus) {
      this.unsubscribeStatus();
      this.unsubscribeStatus = null;
    }
    this.pomodoroEngine?.destroy();
    this.pomodoroEngine = null;
    this.cockpitChunk = null;
    this.cockpitPromise = null;
    this.chartsPromise = null;
    clearLoadedChunks(this.manifest.id);
  }

  ensureSettingsReady(): Promise<void> {
    return this.settingsReady;
  }

  async ensureCockpitChunk(): Promise<LifeOSCockpitChunk> {
    if (this.cockpitChunk) return this.cockpitChunk;
    if (!this.cockpitPromise) {
      this.cockpitPromise = loadPluginChunkAsync<LifeOSCockpitChunk>(this, COCKPIT_CHUNK)
        .then((mod) => {
          this.cockpitChunk = mod;
          return mod;
        })
        .catch((err) => {
          this.cockpitPromise = null;
          throw err;
        });
    }
    return this.cockpitPromise;
  }

  async ensureChartsChunk(): Promise<LifeOSChartsChunk> {
    if (!this.chartsPromise) {
      this.chartsPromise = loadPluginChunkAsync<LifeOSChartsChunk>(this, CHARTS_CHUNK).catch((err) => {
        this.chartsPromise = null;
        throw err;
      });
    }
    return this.chartsPromise;
  }

  private updateStatusBarPill(snap?: PomodoroSnapshot): void {
    if (!this.statusEl) return;
    if (!snap || snap.status === "idle") {
      this.statusEl.removeClass("is-focus-running", "is-focus-paused");
      this.statusEl.setText("Life OS: Cockpit");
      return;
    }
    const clock = formatClockMMSS(snap.remainingSeconds);
    const phaseGlyph = snap.phase === "work" ? "🍅" : "☕";
    const statusPrefix = snap.status === "paused" ? "⏸" : phaseGlyph;
    const labelSuffix = snap.targetTitle ? ` · ${snap.targetTitle.slice(0, 18)}` : "";
    this.statusEl.toggleClass("is-focus-running", snap.status === "running");
    this.statusEl.toggleClass("is-focus-paused", snap.status === "paused");
    this.statusEl.setText(`${statusPrefix} ${clock}${labelSuffix}`);
  }

  ensurePomodoroEngine(): PomodoroEngine {
    if (!this.cockpitChunk) {
      throw new Error("Cockpit chunk must be loaded before creating PomodoroEngine.");
    }
    return this.ensurePomodoroEngineWithChunk(this.cockpitChunk);
  }

  private ensurePomodoroEngineWithChunk(chunk: LifeOSCockpitChunk): PomodoroEngine {
    if (!this.pomodoroEngine) {
      this.pomodoroEngine = new chunk.PomodoroEngine(
        () => this.settings.pomodoro,
        async (payload) => {
          if (payload.phase === "work") {
            const summary = await chunk.logFocusToDailyNote(
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

  async activateCockpitView(toggleZenFocus = false): Promise<void> {
    await this.settingsReady;
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
    const chunk = await this.ensureCockpitChunk();
    return chunk.ensureNoteForDate(this.app, this.settings, dateKey);
  }

  async runSuperProductivityExport(dateKey: string): Promise<string> {
    const chunk = await this.ensureCockpitChunk();
    const file = await this.ensureNoteForDate(dateKey);
    return chunk.writeSuperProductivityExport(this.app, this.settings, dateKey, file);
  }

  async runLoopHabitsExport(): Promise<string> {
    const chunk = await this.ensureCockpitChunk();
    return chunk.writeLoopHabitsExport(this.app, this.settings);
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
}
