import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type LifeOSPlugin from "./main";
import type { ParsedDailyNote, PrayerStatus, TaskPriority, WaterUnit } from "./types";
import { formatDateDMY, parseAnyDateKey, todayDMY, toISOKey } from "./core/date-format";
import {
  applyParsedNoteToMarkdown,
  clampSleepHours,
  clampWaterBottles,
  clampWaterGlasses,
  computeWaterLiters,
  parseDailyNote,
  SLEEP_MAX_HOURS,
  SLEEP_MIN_HOURS,
  SLEEP_STEP_HOURS,
  WATER_GLASS_MAX,
} from "./core/note-parser";
import {
  collectMonthSummaries,
  collectRecentSummaries,
  computeAggregateStats,
  renderMetricBarChart,
} from "./core/stats-engine";

export const VIEW_TYPE_LIFE_OS = "life-os-cockpit-view";

type CockpitTab = "cockpit" | "calendar" | "stats";
type TaskFilter = "all" | "open" | "done";

const SLEEP_PRESETS = [5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const BOTTLE_PRESETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
const PRAYER_STATUS_OPTIONS: Array<{ value: PrayerStatus; label: string }> = [
  { value: "prayed", label: "Prayed" },
  { value: "jamaah", label: "Jamaah" },
  { value: "late", label: "Late" },
  { value: "missed", label: "Missed" },
];

export class LifeOSCockpitView extends ItemView {
  private plugin: LifeOSPlugin;
  private activeTab: CockpitTab = "cockpit";
  private selectedDateKey: string = todayDMY();
  private calendarYear: number = new Date().getFullYear();
  private calendarMonth: number = new Date().getMonth();
  private statsWindowDays: 7 | 30 = 7;
  private taskFilter: TaskFilter = "all";
  private currentNote: ParsedDailyNote | null = null;
  private saveTimer: number | null = null;
  private countdownTimer: number | null = null;

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
    if (this.plugin.settings.autoPinCockpitTab) {
      this.leaf.setPinned(true);
    }
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.basename === this.selectedDateKey && this.saveTimer === null) {
          void this.refreshView();
        }
      })
    );
    this.countdownTimer = window.setInterval(() => {
      if (this.activeTab === "cockpit") {
        this.updatePrayerCountdownBadge();
      }
    }, 60_000);
    await this.refreshView();
  }

  async onClose(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.countdownTimer !== null) {
      window.clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  async setDateKey(dateKey: string): Promise<void> {
    this.selectedDateKey = dateKey;
    const d = parseAnyDateKey(dateKey);
    if (d) {
      this.calendarYear = d.getFullYear();
      this.calendarMonth = d.getMonth();
    }
    await this.refreshView();
  }

  private shiftDate(deltaDays: number): void {
    const d = parseAnyDateKey(this.selectedDateKey) ?? new Date();
    d.setDate(d.getDate() + deltaDays);
    void this.setDateKey(formatDateDMY(d));
  }

  private async loadSelectedNote(): Promise<ParsedDailyNote> {
    const file = await this.plugin.ensureNoteForDate(this.selectedDateKey);
    const content = await this.app.vault.read(file);
    return parseDailyNote(content, this.selectedDateKey, this.plugin.settings);
  }

  private async persistCurrentNote(rerender = true): Promise<void> {
    if (!this.currentNote) return;
    const file = await this.plugin.ensureNoteForDate(this.selectedDateKey);
    const snapshot = this.currentNote;
    await this.app.vault.process(file, (content) =>
      applyParsedNoteToMarkdown(content, snapshot, this.plugin.settings)
    );
    if (rerender) {
      await this.refreshView();
    }
  }

  private scheduleDebouncedSave(statusEl?: HTMLElement): void {
    if (statusEl) statusEl.setText("Saving...");
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(async () => {
      this.saveTimer = null;
      await this.persistCurrentNote(false);
      if (statusEl) statusEl.setText("Saved");
    }, 550);
  }

  async refreshView(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("life-os-viewport");

    const root = container.createDiv({ cls: "life-os-root" });
    this.renderTopBar(root);

    if (this.activeTab === "cockpit") {
      this.currentNote = await this.loadSelectedNote();
      this.renderCockpitTab(root, this.currentNote);
    } else if (this.activeTab === "calendar") {
      await this.renderCalendarTab(root);
    } else {
      await this.renderStatsTab(root);
    }
  }

  private renderTopBar(root: HTMLElement): void {
    const bar = root.createDiv({ cls: "life-os-datebar" });

    // Date navigation
    const nav = bar.createDiv({ cls: "life-os-date-nav" });
    const prevBtn = nav.createEl("button", { text: "◀", cls: "life-os-nav-arrow" });
    prevBtn.setAttr("aria-label", "Previous day");
    prevBtn.addEventListener("click", () => this.shiftDate(-1));

    const parsedDate = parseAnyDateKey(this.selectedDateKey) ?? new Date();
    const weekday = parsedDate.toLocaleDateString(undefined, { weekday: "short" });
    const titleEl = nav.createDiv({
      text: `${this.selectedDateKey} (${weekday})`,
      cls: "life-os-date-title",
    });
    titleEl.addEventListener("click", () => {
      this.activeTab = "calendar";
      void this.refreshView();
    });

    const nextBtn = nav.createEl("button", { text: "▶", cls: "life-os-nav-arrow" });
    nextBtn.setAttr("aria-label", "Next day");
    nextBtn.addEventListener("click", () => this.shiftDate(1));

    if (this.selectedDateKey !== todayDMY()) {
      const todayBtn = nav.createEl("button", { text: "Today", cls: "life-os-badge-today" });
      todayBtn.addEventListener("click", () => void this.setDateKey(todayDMY()));
    }

    // Center mode tabs
    const tabs = bar.createDiv({ cls: "life-os-mode-tabs" });
    const tabDefs: Array<{ id: CockpitTab; label: string }> = [
      { id: "cockpit", label: "Cockpit" },
      { id: "calendar", label: "Calendar" },
      { id: "stats", label: "Stats & Tracker" },
    ];
    for (const def of tabDefs) {
      const btn = tabs.createEl("button", {
        text: def.label,
        cls: `life-os-mode-tab ${this.activeTab === def.id ? "is-active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.activeTab = def.id;
        void this.refreshView();
      });
    }

    // Right actions: Pin (close protection) + Open raw note
    const actions = bar.createDiv({ cls: "life-os-datebar-actions" });
    const isPinned = Boolean((this.leaf as unknown as { pinned?: boolean }).pinned);
    const pinBtn = actions.createEl("button", {
      text: isPinned ? "Pinned" : "Pin Tab",
      cls: `life-os-btn-subtle ${isPinned ? "is-pinned" : ""}`,
    });
    pinBtn.setAttr("title", "Pin tab to protect against accidental close or navigation overwrite");
    pinBtn.addEventListener("click", () => {
      this.leaf.setPinned(!isPinned);
      void this.refreshView();
    });

    const openBtn = actions.createEl("button", { text: "Open Note", cls: "life-os-btn-primary" });
    openBtn.addEventListener("click", async () => {
      const file = await this.plugin.ensureNoteForDate(this.selectedDateKey);
      await this.app.workspace.getLeaf("split").openFile(file);
    });
  }

  private renderCockpitTab(root: HTMLElement, note: ParsedDailyNote): void {
    const settings = this.plugin.settings;

    // Row 1: Sleep & Water Barometer
    if (settings.sleepTracking || settings.waterTracking) {
      const vitalsRow = root.createDiv({ cls: "life-os-wellness-row" });
      if (settings.sleepTracking) this.renderSleepCard(vitalsRow, note);
      if (settings.waterTracking) this.renderWaterCard(vitalsRow, note);
    }

    // Row 2: Prayer Strip
    if (settings.prayerEnabled) {
      this.renderPrayerCard(root, note);
    }

    // Row 3: Custom Habits Grid
    if (settings.habitTracking) {
      this.renderHabitsCard(root, note);
    }

    // Row 4: Tasks & Timeline Split Panes
    if (settings.taskTracking || settings.studyTracking) {
      const split = root.createDiv({ cls: "life-os-cockpit-split" });
      this.renderTasksPane(split, note);
      this.renderTimelinePane(split, note);
    }

    // Row 5: Daily Journal & Reflection
    this.renderJournalReflectionCard(root, note);
  }

  private renderSleepCard(parent: HTMLElement, note: ParsedDailyNote): void {
    const card = parent.createDiv({ cls: "life-os-card life-os-accent-sleep" });
    const header = card.createDiv({ cls: "life-os-card-header" });
    header.createDiv({ text: "Sleep (1–10h)", cls: "life-os-card-title" });

    const badge = header.createDiv({ cls: "life-os-pill-badge" });
    if (note.sleepHours === null) {
      badge.setText("Not logged");
      badge.addClass("is-muted");
    } else {
      const quality =
        note.sleepHours < 6
          ? "Low"
          : note.sleepHours < 7
          ? "Fair"
          : note.sleepHours <= 9
          ? "Optimal"
          : "Long";
      badge.setText(`${note.sleepHours}h · ${quality}`);
      badge.addClass(
        note.sleepHours < 6
          ? "is-warn"
          : note.sleepHours <= 9
          ? "is-good"
          : "is-info"
      );
    }

    // Quick-select preset pills
    const presetsRow = card.createDiv({ cls: "life-os-pill-row" });
    for (const preset of SLEEP_PRESETS) {
      const btn = presetsRow.createEl("button", {
        text: `${preset}h`,
        cls: `life-os-preset-btn ${note.sleepHours === preset ? "is-active" : ""}`,
      });
      btn.addEventListener("click", () => {
        note.sleepHours = clampSleepHours(preset);
        void this.persistCurrentNote(true);
      });
    }

    // Stepped range slider + +/-0.5h stepper
    const sliderRow = card.createDiv({ cls: "life-os-slider-row" });
    const minusBtn = sliderRow.createEl("button", { text: "−0.5", cls: "life-os-btn-mini" });
    minusBtn.addEventListener("click", () => {
      const base = note.sleepHours ?? this.plugin.settings.sleepTargetHours;
      note.sleepHours = clampSleepHours(base - SLEEP_STEP_HOURS);
      void this.persistCurrentNote(true);
    });

    const slider = sliderRow.createEl("input", {
      type: "range",
      cls: "life-os-range-slider",
    });
    slider.min = String(SLEEP_MIN_HOURS);
    slider.max = String(SLEEP_MAX_HOURS);
    slider.step = String(SLEEP_STEP_HOURS);
    slider.value = String(note.sleepHours ?? this.plugin.settings.sleepTargetHours);
    slider.addEventListener("change", () => {
      note.sleepHours = clampSleepHours(Number(slider.value));
      void this.persistCurrentNote(true);
    });

    const plusBtn = sliderRow.createEl("button", { text: "+0.5", cls: "life-os-btn-mini" });
    plusBtn.addEventListener("click", () => {
      const base = note.sleepHours ?? this.plugin.settings.sleepTargetHours;
      note.sleepHours = clampSleepHours(base + SLEEP_STEP_HOURS);
      void this.persistCurrentNote(true);
    });

    if (note.sleepHours !== null) {
      const clearBtn = sliderRow.createEl("button", { text: "Reset", cls: "life-os-btn-mini" });
      clearBtn.addEventListener("click", () => {
        note.sleepHours = null;
        void this.persistCurrentNote(true);
      });
    }
  }

  private renderWaterCard(parent: HTMLElement, note: ParsedDailyNote): void {
    const settings = this.plugin.settings;
    const card = parent.createDiv({ cls: "life-os-card life-os-accent-water" });
    const header = card.createDiv({ cls: "life-os-card-header" });
    header.createDiv({ text: "Hydration", cls: "life-os-card-title" });

    // Mode switcher: Glasses vs Bottle
    const switcher = header.createDiv({ cls: "life-os-segmented" });
    const modes: Array<{ id: WaterUnit; label: string }> = [
      { id: "glasses", label: "Glasses (0–10)" },
      { id: "bottle", label: `Bottle (${settings.bottleVolumeLiters}L)` },
    ];
    for (const m of modes) {
      const btn = switcher.createEl("button", {
        text: m.label,
        cls: `life-os-seg-btn ${note.waterMode === m.id ? "is-active" : ""}`,
      });
      btn.addEventListener("click", () => {
        note.waterMode = m.id;
        note.waterLiters = computeWaterLiters(
          note.waterMode,
          note.waterGlasses,
          note.waterBottles,
          settings.glassVolumeLiters,
          settings.bottleVolumeLiters
        );
        void this.persistCurrentNote(true);
      });
    }

    const liters = computeWaterLiters(
      note.waterMode,
      note.waterGlasses,
      note.waterBottles,
      settings.glassVolumeLiters,
      settings.bottleVolumeLiters
    );
    const pct = Math.min(100, Math.round((liters / Math.max(0.5, settings.waterTargetLiters)) * 100));

    const summary = card.createDiv({ cls: "life-os-water-summary" });
    summary.createSpan({
      text:
        note.waterMode === "bottle"
          ? `${note.waterBottles} bottle(s) · ${liters.toFixed(2)} L`
          : `${note.waterGlasses} / ${WATER_GLASS_MAX} glasses · ${liters.toFixed(2)} L`,
      cls: "life-os-water-readout",
    });
    summary.createSpan({ text: `${pct}% of ${settings.waterTargetLiters}L goal`, cls: "life-os-muted-text" });

    // Progress bar
    const track = card.createDiv({ cls: "life-os-progress-track" });
    const fill = track.createDiv({ cls: "life-os-progress-fill life-os-fill-water" });
    fill.style.width = `${pct}%`;

    if (note.waterMode === "glasses") {
      // 10 clickable glass icons + stepper
      const grid = card.createDiv({ cls: "life-os-glass-grid" });
      for (let i = 1; i <= WATER_GLASS_MAX; i++) {
        const filled = i <= note.waterGlasses;
        const gBtn = grid.createEl("button", {
          text: String(i),
          cls: `life-os-glass-btn ${filled ? "is-filled" : ""}`,
        });
        gBtn.setAttr("title", `Set ${i} glass(es)`);
        gBtn.addEventListener("click", () => {
          note.waterGlasses = note.waterGlasses === i ? i - 1 : i;
          note.waterLiters = computeWaterLiters(
            "glasses",
            note.waterGlasses,
            note.waterBottles,
            settings.glassVolumeLiters,
            settings.bottleVolumeLiters
          );
          void this.persistCurrentNote(true);
        });
      }

      const stepRow = card.createDiv({ cls: "life-os-water-controls" });
      const minus = stepRow.createEl("button", { text: "−1 Glass", cls: "life-os-btn-mini" });
      minus.addEventListener("click", () => {
        note.waterGlasses = clampWaterGlasses(note.waterGlasses - 1);
        note.waterLiters = computeWaterLiters(
          "glasses",
          note.waterGlasses,
          note.waterBottles,
          settings.glassVolumeLiters,
          settings.bottleVolumeLiters
        );
        void this.persistCurrentNote(true);
      });
      const plus = stepRow.createEl("button", { text: "+1 Glass", cls: "life-os-btn-mini" });
      plus.addEventListener("click", () => {
        note.waterGlasses = clampWaterGlasses(note.waterGlasses + 1);
        note.waterLiters = computeWaterLiters(
          "glasses",
          note.waterGlasses,
          note.waterBottles,
          settings.glassVolumeLiters,
          settings.bottleVolumeLiters
        );
        void this.persistCurrentNote(true);
      });
    } else {
      // Bottle mode: 0.5-bottle presets + +/-0.5 stepper
      const pills = card.createDiv({ cls: "life-os-pill-row" });
      for (const b of BOTTLE_PRESETS) {
        const btn = pills.createEl("button", {
          text: `${b}×`,
          cls: `life-os-preset-btn ${note.waterBottles === b ? "is-active" : ""}`,
        });
        btn.addEventListener("click", () => {
          note.waterBottles = clampWaterBottles(b);
          note.waterLiters = computeWaterLiters(
            "bottle",
            note.waterGlasses,
            note.waterBottles,
            settings.glassVolumeLiters,
            settings.bottleVolumeLiters
          );
          void this.persistCurrentNote(true);
        });
      }

      const stepRow = card.createDiv({ cls: "life-os-water-controls" });
      const minus = stepRow.createEl("button", { text: "−0.5 Bottle", cls: "life-os-btn-mini" });
      minus.addEventListener("click", () => {
        note.waterBottles = clampWaterBottles(note.waterBottles - 0.5);
        note.waterLiters = computeWaterLiters(
          "bottle",
          note.waterGlasses,
          note.waterBottles,
          settings.glassVolumeLiters,
          settings.bottleVolumeLiters
        );
        void this.persistCurrentNote(true);
      });
      const plus = stepRow.createEl("button", { text: "+0.5 Bottle", cls: "life-os-btn-mini" });
      plus.addEventListener("click", () => {
        note.waterBottles = clampWaterBottles(note.waterBottles + 0.5);
        note.waterLiters = computeWaterLiters(
          "bottle",
          note.waterGlasses,
          note.waterBottles,
          settings.glassVolumeLiters,
          settings.bottleVolumeLiters
        );
        void this.persistCurrentNote(true);
      });
      const reset = stepRow.createEl("button", { text: "0", cls: "life-os-btn-mini" });
      reset.addEventListener("click", () => {
        note.waterBottles = 0;
        note.waterLiters = 0;
        void this.persistCurrentNote(true);
      });
    }
  }

  private renderPrayerCard(root: HTMLElement, note: ParsedDailyNote): void {
    const card = root.createDiv({ cls: "life-os-card life-os-accent-prayer" });
    const header = card.createDiv({ cls: "life-os-card-header" });
    header.createDiv({ text: "Prayers (adhan-js)", cls: "life-os-card-title" });

    const right = header.createDiv({ cls: "life-os-header-right" });
    right.createDiv({ cls: "life-os-prayer-countdown", attr: { "data-life-os-countdown": "1" } });

    const strip = card.createDiv({ cls: "life-os-prayer-strip" });
    for (const p of note.prayers) {
      const statusCls =
        p.status === "jamaah"
          ? "is-jamaah"
          : p.status === "prayed"
          ? "is-done"
          : p.status === "late"
          ? "is-late"
          : p.status === "missed"
          ? "is-missed"
          : "";
      const item = strip.createDiv({ cls: `life-os-prayer-item ${statusCls}` });
      const top = item.createDiv({ cls: "life-os-prayer-top" });
      top.createDiv({ text: p.name, cls: "life-os-prayer-name" });
      top.createDiv({ text: p.time, cls: "life-os-prayer-time" });

      const pillRow = item.createDiv({ cls: "life-os-prayer-pills" });
      for (const opt of PRAYER_STATUS_OPTIONS) {
        const btn = pillRow.createEl("button", {
          text: opt.label,
          cls: `life-os-status-pill ${p.status === opt.value ? "is-active" : ""}`,
        });
        btn.addEventListener("click", () => {
          p.status = p.status === opt.value ? "" : opt.value;
          p.done = p.status === "prayed" || p.status === "jamaah" || p.status === "late";
          void this.persistCurrentNote(true);
        });
      }
    }

    this.updatePrayerCountdownBadge();
  }

  private updatePrayerCountdownBadge(): void {
    const el = this.containerEl.querySelector("[data-life-os-countdown]") as HTMLElement | null;
    if (!el || !this.currentNote) return;

    if (this.selectedDateKey !== todayDMY()) {
      const doneCount = this.currentNote.prayers.filter((p) => p.done).length;
      el.setText(`${doneCount} / 5 completed`);
      return;
    }

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let nextLabel = "All prayers passed for today";
    for (const p of this.currentNote.prayers) {
      const parts = p.time.split(":").map(Number);
      if (parts.length !== 2) continue;
      const pMin = parts[0]! * 60 + parts[1]!;
      if (pMin > nowMin) {
        const diff = pMin - nowMin;
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        nextLabel = `Next: ${p.name} in ${h > 0 ? `${h}h ` : ""}${m}m`;
        break;
      }
    }
    el.setText(nextLabel);
  }

  private renderHabitsCard(root: HTMLElement, note: ParsedDailyNote): void {
    const card = root.createDiv({ cls: "life-os-card life-os-accent-habits" });
    const header = card.createDiv({ cls: "life-os-card-header" });
    const doneCount = note.habits.filter((h) => h.done).length;
    header.createDiv({
      text: `Daily Habits (${doneCount}/${note.habits.length})`,
      cls: "life-os-card-title",
    });

    const addForm = header.createDiv({ cls: "life-os-inline-add" });
    const input = addForm.createEl("input", {
      type: "text",
      placeholder: "Add habit...",
      cls: "life-os-input-compact",
    });
    const addBtn = addForm.createEl("button", { text: "+ Add", cls: "life-os-btn-mini" });
    const submitHabit = (): void => {
      const name = input.value.trim();
      if (!name) return;
      if (!note.habits.some((h) => h.name.toLowerCase() === name.toLowerCase())) {
        note.habits.push({ name, done: false });
      }
      input.value = "";
      void this.persistCurrentNote(true);
    };
    addBtn.addEventListener("click", submitHabit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitHabit();
    });

    const grid = card.createDiv({ cls: "life-os-habits-grid" });
    for (const h of note.habits) {
      const chip = grid.createDiv({ cls: `life-os-habit-chip ${h.done ? "is-done" : ""}` });
      const label = chip.createEl("label", { cls: "life-os-habit-toggle" });
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = h.done;
      cb.addEventListener("change", () => {
        h.done = cb.checked;
        void this.persistCurrentNote(true);
      });
      label.createSpan({ text: h.name, cls: "life-os-habit-name" });
    }
  }

  private renderTasksPane(parent: HTMLElement, note: ParsedDailyNote): void {
    const pane = parent.createDiv({ cls: "life-os-pane life-os-accent-tasks" });
    const header = pane.createDiv({ cls: "life-os-pane-header" });
    header.createDiv({ text: "Tasks", cls: "life-os-pane-title" });

    const filters = header.createDiv({ cls: "life-os-segmented" });
    for (const f of ["all", "open", "done"] as TaskFilter[]) {
      const btn = filters.createEl("button", {
        text: f[0]!.toUpperCase() + f.slice(1),
        cls: `life-os-seg-btn ${this.taskFilter === f ? "is-active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.taskFilter = f;
        void this.refreshView();
      });
    }

    // Quick-add task bar
    const addBar = pane.createDiv({ cls: "life-os-quick-bar" });
    const titleInput = addBar.createEl("input", {
      type: "text",
      placeholder: "New task...",
      cls: "life-os-input-flex",
    });
    const prioSelect = addBar.createEl("select", { cls: "life-os-select-compact" });
    prioSelect.createEl("option", { value: "medium", text: "🔼 Med" });
    prioSelect.createEl("option", { value: "high", text: "⏫ High" });
    prioSelect.createEl("option", { value: "low", text: "🔽 Low" });
    prioSelect.createEl("option", { value: "none", text: "Normal" });

    const addBtn = addBar.createEl("button", { text: "+ Task", cls: "life-os-btn-primary" });
    const submitTask = (): void => {
      const title = titleInput.value.trim();
      if (!title) return;
      note.tasks.push({
        id: `task-${Date.now()}`,
        title,
        done: false,
        priority: prioSelect.value as TaskPriority,
        dueDateIso: toISOKey(this.selectedDateKey) ?? undefined,
      });
      titleInput.value = "";
      void this.persistCurrentNote(true);
    };
    addBtn.addEventListener("click", submitTask);
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitTask();
    });

    const list = pane.createDiv({ cls: "life-os-tasks-list" });
    const visible = note.tasks.filter((t) =>
      this.taskFilter === "all" ? true : this.taskFilter === "open" ? !t.done : t.done
    );
    if (visible.length === 0) {
      list.createDiv({ text: "No tasks in this filter.", cls: "life-os-empty-state" });
      return;
    }

    for (const task of visible) {
      const row = list.createDiv({ cls: `life-os-task-row ${task.done ? "is-done" : ""}` });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = task.done;
      cb.addEventListener("change", () => {
        task.done = cb.checked;
        task.doneDateIso = task.done ? toISOKey(todayDMY()) ?? undefined : undefined;
        void this.persistCurrentNote(true);
      });

      const prioIcon =
        task.priority === "high" ? "⏫" : task.priority === "medium" ? "🔼" : task.priority === "low" ? "🔽" : "";
      if (prioIcon) row.createSpan({ text: prioIcon, cls: "life-os-priority-badge" });

      row.createSpan({ text: task.title, cls: "life-os-task-title" });
      if (task.dueDateIso) {
        row.createSpan({ text: task.dueDateIso, cls: "life-os-task-due" });
      }

      const delBtn = row.createEl("button", { text: "×", cls: "life-os-btn-del" });
      delBtn.setAttr("aria-label", "Remove task");
      delBtn.addEventListener("click", () => {
        note.tasks = note.tasks.filter((t) => t !== task);
        void this.persistCurrentNote(true);
      });
    }
  }

  private renderTimelinePane(parent: HTMLElement, note: ParsedDailyNote): void {
    const pane = parent.createDiv({ cls: "life-os-pane life-os-accent-timeline" });
    const header = pane.createDiv({ cls: "life-os-pane-header" });
    header.createDiv({ text: "Timeline (Day Planner)", cls: "life-os-pane-title" });

    const addBar = pane.createDiv({ cls: "life-os-quick-bar" });
    const startInput = addBar.createEl("input", { type: "time", cls: "life-os-time-input" });
    startInput.value = "09:00";
    const endInput = addBar.createEl("input", { type: "time", cls: "life-os-time-input" });
    endInput.value = "10:00";
    const titleInput = addBar.createEl("input", {
      type: "text",
      placeholder: "Focus block...",
      cls: "life-os-input-flex",
    });
    const addBtn = addBar.createEl("button", { text: "+ Block", cls: "life-os-btn-primary" });

    const submitBlock = (): void => {
      const title = titleInput.value.trim();
      if (!title || !startInput.value || !endInput.value) return;
      note.timeline.push({
        id: `blk-${Date.now()}`,
        startTime: startInput.value,
        endTime: endInput.value,
        title,
        done: false,
      });
      titleInput.value = "";
      void this.persistCurrentNote(true);
    };
    addBtn.addEventListener("click", submitBlock);
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitBlock();
    });

    const list = pane.createDiv({ cls: "life-os-timeline-list" });
    if (note.timeline.length === 0) {
      list.createDiv({ text: "No timeblocks scheduled yet.", cls: "life-os-empty-state" });
      return;
    }

    for (const blk of note.timeline) {
      const row = list.createDiv({ cls: `life-os-block-row ${blk.done ? "is-done" : ""}` });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = blk.done;
      cb.addEventListener("change", () => {
        blk.done = cb.checked;
        void this.persistCurrentNote(true);
      });
      row.createSpan({ text: `${blk.startTime}–${blk.endTime}`, cls: "life-os-block-time" });
      row.createSpan({ text: blk.title, cls: "life-os-task-title" });

      const delBtn = row.createEl("button", { text: "×", cls: "life-os-btn-del" });
      delBtn.addEventListener("click", () => {
        note.timeline = note.timeline.filter((b) => b !== blk);
        void this.persistCurrentNote(true);
      });
    }
  }

  private renderJournalReflectionCard(root: HTMLElement, note: ParsedDailyNote): void {
    const card = root.createDiv({ cls: "life-os-card life-os-accent-journal" });
    const header = card.createDiv({ cls: "life-os-card-header" });
    header.createDiv({ text: "Daily Journal & Reflection", cls: "life-os-card-title" });
    const saveStatus = header.createDiv({ text: "Synced", cls: "life-os-muted-text" });

    const grid = card.createDiv({ cls: "life-os-cockpit-split" });

    const journalBox = grid.createDiv({ cls: "life-os-field" });
    journalBox.createEl("label", { text: "Daily Journal", cls: "life-os-metric-label" });
    const journalArea = journalBox.createEl("textarea", {
      cls: "life-os-reflection-input",
      attr: { placeholder: "Notes, wins, study logs, thoughts for today..." },
    });
    journalArea.value = note.journal;
    journalArea.addEventListener("input", () => {
      note.journal = journalArea.value;
      this.scheduleDebouncedSave(saveStatus);
    });

    const reflBox = grid.createDiv({ cls: "life-os-field" });
    reflBox.createEl("label", { text: "Evening Reflection", cls: "life-os-metric-label" });
    const reflArea = reflBox.createEl("textarea", {
      cls: "life-os-reflection-input",
      attr: { placeholder: "What went well? What will you improve tomorrow?" },
    });
    reflArea.value = note.reflection;
    reflArea.addEventListener("input", () => {
      note.reflection = reflArea.value;
      this.scheduleDebouncedSave(saveStatus);
    });
  }

  private async renderCalendarTab(root: HTMLElement): Promise<void> {
    const card = root.createDiv({ cls: "life-os-card life-os-calendar-card" });
    const head = card.createDiv({ cls: "life-os-cal-head" });

    const prevBtn = head.createEl("button", { text: "◀ Prev", cls: "life-os-btn-subtle" });
    prevBtn.addEventListener("click", () => {
      this.calendarMonth--;
      if (this.calendarMonth < 0) {
        this.calendarMonth = 11;
        this.calendarYear--;
      }
      void this.refreshView();
    });

    const monthTitle = new Date(this.calendarYear, this.calendarMonth, 1).toLocaleDateString(
      undefined,
      { month: "long", year: "numeric" }
    );
    head.createDiv({ text: monthTitle, cls: "life-os-date-title" });

    const nextBtn = head.createEl("button", { text: "Next ▶", cls: "life-os-btn-subtle" });
    nextBtn.addEventListener("click", () => {
      this.calendarMonth++;
      if (this.calendarMonth > 11) {
        this.calendarMonth = 0;
        this.calendarYear++;
      }
      void this.refreshView();
    });

    const summaries = await collectMonthSummaries(
      this.app,
      this.plugin.settings,
      this.calendarYear,
      this.calendarMonth
    );

    const grid = card.createDiv({ cls: "life-os-cal-grid" });
    for (const dow of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      grid.createDiv({ text: dow, cls: "life-os-cal-dow" });
    }

    const firstWeekday = new Date(this.calendarYear, this.calendarMonth, 1).getDay();
    for (let i = 0; i < firstWeekday; i++) {
      grid.createDiv({ cls: "life-os-cal-empty" });
    }

    const daysInMonth = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();
    const today = todayDMY();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateDMY(new Date(this.calendarYear, this.calendarMonth, day));
      const stat = summaries.get(dateKey);
      const cell = grid.createEl("button", {
        cls: `life-os-cal-day ${dateKey === today ? "is-today" : ""} ${
          dateKey === this.selectedDateKey ? "is-selected" : ""
        }`,
      });

      cell.createDiv({ text: String(day), cls: "life-os-cal-num" });
      const dots = cell.createDiv({ cls: "life-os-cal-dots" });
      if (stat?.exists) {
        if (stat.prayersDone > 0) {
          dots.createSpan({
            cls: `life-os-dot dot-prayer ${stat.prayersDone >= 5 ? "is-full" : ""}`,
            attr: { title: `Prayers: ${stat.prayersDone}/5` },
          });
        }
        if (stat.sleepHours !== null) {
          dots.createSpan({
            cls: "life-os-dot dot-sleep",
            attr: { title: `Sleep: ${stat.sleepHours}h` },
          });
        }
        if (stat.waterLiters > 0) {
          dots.createSpan({
            cls: "life-os-dot dot-water",
            attr: { title: `Water: ${stat.waterLiters}L` },
          });
        }
        if (stat.hasJournal) {
          dots.createSpan({
            cls: "life-os-dot dot-journal",
            attr: { title: "Journal logged" },
          });
        }
      }

      cell.addEventListener("click", () => {
        this.activeTab = "cockpit";
        void this.setDateKey(dateKey);
      });
    }

    const legend = card.createDiv({ cls: "life-os-cal-legend" });
    legend.createSpan({ text: "● Prayers", cls: "legend-prayer" });
    legend.createSpan({ text: "● Sleep", cls: "legend-sleep" });
    legend.createSpan({ text: "● Water", cls: "legend-water" });
    legend.createSpan({ text: "● Journal", cls: "legend-journal" });
  }

  private async renderStatsTab(root: HTMLElement): Promise<void> {
    const controls = root.createDiv({ cls: "life-os-stats-header" });
    controls.createDiv({ text: "Statistics & Progress Tracker", cls: "life-os-card-title" });

    const winSwitch = controls.createDiv({ cls: "life-os-segmented" });
    for (const days of [7, 30] as const) {
      const btn = winSwitch.createEl("button", {
        text: `Last ${days} Days`,
        cls: `life-os-seg-btn ${this.statsWindowDays === days ? "is-active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.statsWindowDays = days;
        void this.refreshView();
      });
    }

    const anchor = parseAnyDateKey(this.selectedDateKey) ?? new Date();
    const summaries = await collectRecentSummaries(
      this.app,
      this.plugin.settings,
      this.statsWindowDays,
      anchor
    );
    const agg = computeAggregateStats(summaries);

    // 4 KPI Cards
    const kpiGrid = root.createDiv({ cls: "life-os-kpi-grid" });
    const kpis: Array<{ label: string; value: string; sub: string; cls: string }> = [
      {
        label: "Avg Sleep",
        value: agg.avgSleep !== null ? `${agg.avgSleep} h` : "—",
        sub: `Goal: ${this.plugin.settings.sleepTargetHours}h`,
        cls: "life-os-accent-sleep",
      },
      {
        label: "Avg Hydration",
        value: `${agg.avgWaterLiters.toFixed(2)} L`,
        sub: `Goal: ${this.plugin.settings.waterTargetLiters}L/day`,
        cls: "life-os-accent-water",
      },
      {
        label: "Prayer Consistency",
        value: `${agg.prayerCompletionPct}%`,
        sub: `Jamaah: ${agg.jamaahPct}% · Streak: ${agg.prayerStreakDays}d`,
        cls: "life-os-accent-prayer",
      },
      {
        label: "Habits & Tasks",
        value: `${agg.habitCompletionPct}%`,
        sub: `Tasks done: ${agg.tasksDoneTotal}/${agg.tasksAllTotal}`,
        cls: "life-os-accent-habits",
      },
    ];
    for (const k of kpis) {
      const box = kpiGrid.createDiv({ cls: `life-os-card life-os-kpi-card ${k.cls}` });
      box.createDiv({ text: k.label, cls: "life-os-metric-label" });
      box.createDiv({ text: k.value, cls: "life-os-kpi-value" });
      box.createDiv({ text: k.sub, cls: "life-os-muted-text" });
    }

    // Charts Grid
    const chartsGrid = root.createDiv({ cls: "life-os-charts-grid" });

    const sleepChartCard = chartsGrid.createDiv({ cls: "life-os-card life-os-accent-sleep" });
    sleepChartCard.createDiv({ text: "Sleep Hours Trend (Target Dashed)", cls: "life-os-card-title" });
    renderMetricBarChart(sleepChartCard, summaries, {
      maxValue: 10,
      targetValue: this.plugin.settings.sleepTargetHours,
      unit: "h",
      barClass: "bar-sleep",
      getValue: (d) => d.sleepHours,
    });

    const waterChartCard = chartsGrid.createDiv({ cls: "life-os-card life-os-accent-water" });
    waterChartCard.createDiv({ text: "Hydration Trend (Liters)", cls: "life-os-card-title" });
    renderMetricBarChart(waterChartCard, summaries, {
      maxValue: Math.max(4, this.plugin.settings.waterTargetLiters + 1.5),
      targetValue: this.plugin.settings.waterTargetLiters,
      unit: "L",
      barClass: "bar-water",
      getValue: (d) => (d.exists ? d.waterLiters : null),
    });

    const prayerChartCard = chartsGrid.createDiv({ cls: "life-os-card life-os-accent-prayer" });
    prayerChartCard.createDiv({ text: "Daily Prayers Completed (0–5)", cls: "life-os-card-title" });
    renderMetricBarChart(prayerChartCard, summaries, {
      maxValue: 5,
      targetValue: 5,
      unit: "/5",
      barClass: "bar-prayer",
      getValue: (d) => (d.exists ? d.prayersDone : null),
    });

    // Quick Export Footer
    const exportRow = root.createDiv({ cls: "life-os-card life-os-export-row" });
    exportRow.createDiv({
      text: `Tracked ${agg.trackedDays} note(s) in the selected ${this.statsWindowDays}-day window.`,
      cls: "life-os-muted-text",
    });
    const exportBtns = exportRow.createDiv({ cls: "life-os-datebar-actions" });
    const spBtn = exportBtns.createEl("button", {
      text: "Export Super Productivity JSON",
      cls: "life-os-btn-subtle",
    });
    spBtn.addEventListener("click", async () => {
      const outPath = await this.plugin.runSuperProductivityExport(this.selectedDateKey);
      new Notice(`Exported tasks to ${outPath}`);
    });
    const loopBtn = exportBtns.createEl("button", {
      text: "Export Loop Habits CSV",
      cls: "life-os-btn-subtle",
    });
    loopBtn.addEventListener("click", async () => {
      const outPath = await this.plugin.runLoopHabitsExport();
      new Notice(`Exported habits to ${outPath}`);
    });
  }
}
