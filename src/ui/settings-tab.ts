import { App, Setting } from "obsidian";
import { detectObsidianEcosystem } from "../interop/bridges";
import type LifeOSPlugin from "../main";
import type { PrayerMethodKey, StorageMode, WaterUnit } from "../types";

export function renderLifeOSSettingsUI(
  containerEl: HTMLElement,
  app: App,
  plugin: LifeOSPlugin
): void {
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
        .setValue(plugin.settings.storageMode)
        .onChange(async (val) => {
          plugin.settings.storageMode = val as StorageMode;
          await plugin.saveSettings();
        })
    );

  new Setting(containerEl)
    .setName("Auto-pin cockpit tab (close protection)")
    .setDesc("Automatically pins the Life OS Cockpit tab so it stays open while you browse notes.")
    .addToggle((t) =>
      t.setValue(plugin.settings.autoPinCockpitTab).onChange(async (val) => {
        plugin.settings.autoPinCockpitTab = val;
        await plugin.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName("Glassmorphic theme styling")
    .setDesc("Enable frosted glass surfaces and vibrant module color accents.")
    .addToggle((t) =>
      t.setValue(plugin.settings.glassmorphism).onChange(async (val) => {
        plugin.settings.glassmorphism = val;
        await plugin.saveSettings();
        await plugin.refreshOpenCockpitViews();
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
        .setValue(plugin.settings.waterUnit)
        .onChange(async (val) => {
          plugin.settings.waterUnit = val as WaterUnit;
          await plugin.saveSettings();
        })
    );

  new Setting(containerEl)
    .setName("Water bottle capacity (liters)")
    .setDesc("Capacity of your water bottle in liters (e.g., 1.1 for a bottle slightly over 1L).")
    .addText((t) =>
      t.setValue(String(plugin.settings.bottleVolumeLiters)).onChange(async (val) => {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 0.25 && n <= 5) {
          plugin.settings.bottleVolumeLiters = n;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl)
    .setName("Daily water target (liters)")
    .addText((t) =>
      t.setValue(String(plugin.settings.waterTargetLiters)).onChange(async (val) => {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 0.5 && n <= 10) {
          plugin.settings.waterTargetLiters = n;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl)
    .setName("Daily sleep target (hours, 1–10)")
    .addText((t) =>
      t.setValue(String(plugin.settings.sleepTargetHours)).onChange(async (val) => {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= 1 && n <= 10) {
          plugin.settings.sleepTargetHours = Math.round(n * 2) / 2;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl)
    .setName("Default daily habits")
    .setDesc("Comma-separated list of habits shown in every new daily note.")
    .addText((t) =>
      t.setValue(plugin.settings.customHabits.join(", ")).onChange(async (val) => {
        const parsed = val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parsed.length > 0) {
          plugin.settings.customHabits = parsed;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl).setName("Prayer schedule (adhan-js)").setHeading();

  const eco = detectObsidianEcosystem(app);
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
        .setValue(plugin.settings.prayer.method)
        .onChange(async (val) => {
          plugin.settings.prayer.method = val as PrayerMethodKey;
          await plugin.saveSettings();
        })
    );

  new Setting(containerEl)
    .setName("Asr Madhab")
    .addDropdown((d) =>
      d
        .addOption("hanafi", "Hanafi")
        .addOption("shafi", "Shafi / Standard")
        .setValue(plugin.settings.prayer.madhab)
        .onChange(async (val) => {
          plugin.settings.prayer.madhab = val as "hanafi" | "shafi";
          await plugin.saveSettings();
        })
    );

  new Setting(containerEl)
    .setName("Latitude")
    .addText((t) =>
      t.setValue(String(plugin.settings.prayer.latitude)).onChange(async (val) => {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= -90 && n <= 90) {
          plugin.settings.prayer.latitude = n;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl)
    .setName("Longitude")
    .addText((t) =>
      t.setValue(String(plugin.settings.prayer.longitude)).onChange(async (val) => {
        const n = Number(val);
        if (!Number.isNaN(n) && n >= -180 && n <= 180) {
          plugin.settings.prayer.longitude = n;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl).setName("Pomodoro & focus timer").setHeading();

  new Setting(containerEl)
    .setName("Focus duration (minutes)")
    .setDesc("Length of each work sprint (1–180 minutes).")
    .addText((t) =>
      t.setValue(String(plugin.settings.pomodoro.workMinutes)).onChange(async (val) => {
        const n = Math.round(Number(val));
        if (!Number.isNaN(n) && n >= 1 && n <= 180) {
          plugin.settings.pomodoro.workMinutes = n;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl)
    .setName("Short break (minutes)")
    .addText((t) =>
      t.setValue(String(plugin.settings.pomodoro.shortBreakMinutes)).onChange(async (val) => {
        const n = Math.round(Number(val));
        if (!Number.isNaN(n) && n >= 1 && n <= 60) {
          plugin.settings.pomodoro.shortBreakMinutes = n;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl)
    .setName("Long break (minutes)")
    .addText((t) =>
      t.setValue(String(plugin.settings.pomodoro.longBreakMinutes)).onChange(async (val) => {
        const n = Math.round(Number(val));
        if (!Number.isNaN(n) && n >= 1 && n <= 90) {
          plugin.settings.pomodoro.longBreakMinutes = n;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl)
    .setName("Daily focus goal (minutes)")
    .setDesc("Goal target line displayed on the Focus Minutes chart and progress bar.")
    .addText((t) =>
      t.setValue(String(plugin.settings.pomodoro.dailyFocusTargetMinutes)).onChange(async (val) => {
        const n = Math.round(Number(val));
        if (!Number.isNaN(n) && n >= 10 && n <= 720) {
          plugin.settings.pomodoro.dailyFocusTargetMinutes = n;
          await plugin.saveSettings();
        }
      })
    );

  new Setting(containerEl)
    .setName("Play completion chime")
    .setDesc("Play a soft gentle chime when a focus sprint or break ends.")
    .addToggle((t) =>
      t.setValue(plugin.settings.pomodoro.soundEnabled).onChange(async (val) => {
        plugin.settings.pomodoro.soundEnabled = val;
        await plugin.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName("Log completed sessions to timeline")
    .setDesc("Automatically append finished focus sprints to today's Timeline section.")
    .addToggle((t) =>
      t.setValue(plugin.settings.pomodoro.logTimeblockOnComplete).onChange(async (val) => {
        plugin.settings.pomodoro.logTimeblockOnComplete = val;
        await plugin.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName("Auto-start breaks")
    .addToggle((t) =>
      t.setValue(plugin.settings.pomodoro.autoStartBreaks).onChange(async (val) => {
        plugin.settings.pomodoro.autoStartBreaks = val;
        await plugin.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName("Auto-start next focus session")
    .addToggle((t) =>
      t.setValue(plugin.settings.pomodoro.autoStartWork).onChange(async (val) => {
        plugin.settings.pomodoro.autoStartWork = val;
        await plugin.saveSettings();
      })
    );
}
