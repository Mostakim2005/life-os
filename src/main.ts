import { Plugin, Notice } from "obsidian";
import { DEFAULT_SETTINGS } from "./settings";
import type { LifeOSSettings } from "./types";
// Fresh Nihon 1.3.0-derived entry (3329-line bundle). Full split
// (Store, DashboardView, TimelineView, Tasks/Planner/Dataview bridges) is incremental — see README.
export default class LifeOSPlugin extends Plugin {
  settings!: LifeOSSettings;
  store: any = null;

  async onload() {
    await this.loadSettings();
    this.applyThemePreferences();
    console.warn("[life-os] Store/Views/Bridges split pending — entry lifecycle only in pilot.");

    this.addRibbonIcon("layout-dashboard", "Open Life OS Cockpit", () => new Notice("Life OS — pilot build."));
    this.addCommand({ id: "open-dashboard", name: "Open Cockpit Dashboard", callback: () => new Notice("Dashboard — full port pending.") });
    this.addCommand({ id: "open-timeline", name: "Open Standalone Timeline / Calendar", callback: () => new Notice("Timeline — full port pending.") });
    this.addCommand({ id: "quick-log-habit", name: "Quick Log Habit / Activity", callback: () => new Notice("Quick log — full port pending.") });
    this.addCommand({ id: "quick-add-task", name: "Quick Add Daily Task", callback: () => new Notice("Quick add — full port pending.") });

    this.addSettingTab(new LifeOSSettingPlaceholder(this.app, this));
  }

  onunload() {
    document.body.removeClass("life-os-glassmorphic");
  }

  applyThemePreferences() {
    document.body.toggleClass("life-os-glassmorphic", (this.settings as any).glassmorphism !== false);
  }

  async loadSettings() {
    const raw = ((await this.loadData()) ?? {}) as Partial<LifeOSSettings>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

import { PluginSettingTab, App } from "obsidian";
class LifeOSSettingPlaceholder extends PluginSettingTab {
  constructor(app: App, private plugin: LifeOSPlugin) { super(app, plugin); }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Life OS — pilot" });
    containerEl.createEl("p", { text: "Full settings UI port is next split step. Defaults match Nihon 1.3.0." });
  }
}
