# Product Intent & Feature Map (`PRODUCT.md`)
> **1-Line Summary:** High-density personal operating cockpit for prayer, habits, sleep, hydration, exercise, and tasks with universal Obsidian interoperability.

## 1. Core Vision & User Experience Intent
* **What This App Does (Plain English):** Consolidates daily life tracking into a single zero-scroll cockpit inside Obsidian, writing data cleanly into standard markdown daily notes.
* **How It Must Feel to Use:** High-density, minimal typing, discrete 15-minute timebox selectors, quick-steppers, and zero layout shifting.

## 2. Active Features (Do Not Break)

### [FEATURE: Full-Window-Life-OS-Cockpit] | Aliases: cockpit view, life os cockpit, full window workspace
> **1-Line Summary:** Dedicated full-window ItemView tab with close protection (auto-pin), ribbon icon, and tabbed navigation across Cockpit, Tasks, Schedule & Calendar, and Stats & Tracker.
* **Code Anchors (Grep Targets):**
  * `src/views.ts` -> `LifeOSCockpitView`
  * `src/views.ts` -> `renderCockpitTab`
  * `src/views.ts` -> `renderTasksTab`
  * `src/views.ts` -> `renderCalendarTab`
  * `src/views.ts` -> `renderStatsTab`

### [FEATURE: Sleep-And-Hydration-Vitals] | Aliases: sleep stepped pills, hydration bottle glass toggle
> **1-Line Summary:** Strict stepped sleep tracking (1.0h to 10.0h in 0.5h increments) and dual hydration tracking (glasses 0-10 or bottles 0-5.0 with configurable liter capacity).
* **Code Anchors (Grep Targets):**
  * `src/core/note-parser.ts` -> `clampSleepHours`
  * `src/core/note-parser.ts` -> `computeWaterLiters`
  * `src/views.ts` -> `renderSleepCard`
  * `src/views.ts` -> `renderWaterCard`

### [FEATURE: Dual-Storage-Mode-Parser] | Aliases: inline only, inline and frontmatter, markdown parser
> **1-Line Summary:** Non-destructive daily note parser defaulting to inline-only syntax with an optional dual frontmatter mode preserving DD-MM-YYYY note naming.
* **Code Anchors (Grep Targets):**
  * `src/core/note-parser.ts` -> `parseDailyNote`
  * `src/core/note-parser.ts` -> `applyParsedNoteToMarkdown`

### [FEATURE: Zero-Dependency-Stats-Engine] | Aliases: svg charts, streak calculator, calendar heat dots
> **1-Line Summary:** Computes 30-day streak metrics, habit adherence, and zero-dependency SVG bar/line charts directly inside the cockpit.
* **Code Anchors (Grep Targets):**
  * `src/core/stats-engine.ts` -> `computeAggregateStats`
  * `src/core/stats-engine.ts` -> `renderMetricBarChart`

### [FEATURE: External-Companion-Sync-And-Inbox] | Aliases: inbox reconciler, loop habits export, super productivity export
> **1-Line Summary:** Reconciles mobile `.inbox/*.jsonl` mutations on startup and exports habit/task datasets for Loop Habits and Super Productivity.
* **Code Anchors (Grep Targets):**
  * `src/interop/inbox-reconciler.ts` -> `reconcileMobileInbox`
  * `src/interop/inbox-reconciler.ts` -> `writeSuperProductivityExport`
  * `src/interop/inbox-reconciler.ts` -> `writeLoopHabitsExport`

### [FEATURE: Interactive-ChartJS-Canvases] | Aliases: chart.js renderer, interactive stats charts
> **1-Line Summary:** Tree-shaken Chart.js canvas charts with hover tooltips, goal reference lines, and dynamic theme palette detection.
* **Code Anchors (Grep Targets):**
  * `src/core/chartjs-renderer.ts` -> `renderInteractiveChart`
  * `src/views.ts` -> `renderStatsTab`

### [FEATURE: Natural-Language-Dates-And-Recurrence] | Aliases: chrono node, rrule, recurring tasks
> **1-Line Summary:** Natural-language date extraction in task quick-add via chrono-node and recurring task rescheduling via rrule.
* **Code Anchors (Grep Targets):**
  * `src/core/task-nlp.ts` -> `parseNaturalLanguageTask`
  * `src/core/task-nlp.ts` -> `computeNextRecurringDate`
  * `src/views.ts` -> `renderTasksPane`

### [FEATURE: Offline-Python-Analytics] | Aliases: python pandas script, monthly health summary
> **1-Line Summary:** Offline Python CLI script parsing standard inline fields to output monthly trend charts and CSV reports with desktop Obsidian command trigger.
* **Code Anchors (Grep Targets):**
  * `scripts/life_os_analytics.py` -> `main`
  * `src/main.ts` -> `runPythonAnalytics`

## 3. Planned Features & App-Merge Wishlist

### [WISHLIST: Phased-Calendar-Timeline-Tasks-Absorption] | Aliases: day planner, schedule calendar, full calendar remastered, tasknotes, tasks plugin, pomodoro, time blocking
> **1-Line Summary:** Phased, lazy-loaded absorption of high-value features from 6 external plugins (`obsidian-full-calendar`, `full-calendar-remastered`, `obsidian-day-planner`, `schedule-calendar`, `tasknotes`, `obsidian-tasks-plugin`) into Life OS's existing Cockpit/Calendar/Tasks tabs with strong UI/UX craft and zero startup penalty.
* **Decision Maker:** `[DECIDED BY: HUMAN]` (Locked in 2026-11-23; reference sources archived in gitignored `_reference-plugins/`).
* **Phased Rollout Plan:**
  * **Phase 1 — Visual Time-Blocking Timeline & Drag-and-Drop Schedule Grid *(Implemented in v2.1.0)*:** Hourly vertical timeline + 7-day cross-day drag-and-drop week grid + schedule-badged month calendar synced to daily note timeblocks & `adhan-js` prayer windows.
  * **Phase 2 — Unified Smart Tasks Engine *(Implemented in v2.2.0)*:** Full Tasks-plugin metadata (`⏫`/`🔼`/`🔽`, `🔁` recurrence, `🛫` start, `⏳` scheduled, `📅` due, `✅` done, `#tags`), vault-wide lazy `mtime`-cached task hub, and 1-click timeline scheduling loaded on demand when opening the `Tasks` tab.
  * **Phase 3 — Built-In Pomodoro & Focus Time Tracker *(Implemented in v2.3.0)*:** Wall-clock Pomodoro session timer + compact Focus Bar + distraction-free Zen Focus mode (inspired by `tasknotes`), live Obsidian status bar countdown, direct `[focus_minutes::]` / `[focus_sessions::]` logging & completed timeline blocks, and Focus Minutes KPI + interactive Chart.js trend.
  * **Phase 4 — Lazy External Calendar Feeds (ICS / Optional CalDAV):** On-demand `.ics` URL / Google Calendar overlay inside the Calendar tab (lazy-loaded only when Sync is triggered).

### [WISHLIST: Wearable-Health-Auto-Sync] | Aliases: google fit sync, sleep data import
> **1-Line Summary:** Local bridge to import sleep hours and step count from exported health archives.

### [FEATURE: Interactive-Timeline-And-Week-Schedule] | Aliases: day planner, schedule calendar, time blocking, week grid, overlap layout
> **1-Line Summary:** Visual hourly Day Timeline (with 15-min drag/resize, side-by-side overlap packing, prayer window markers, current-time line, and task-to-timeline drag-and-drop), 7-day cross-day Week Grid, and schedule-badged Month Calendar inside the Schedule & Calendar tab.
* **Code Anchors (Grep Targets):**
  * `src/core/timeline-layout.ts` -> `computeOverlapLayout`, `getWeekDates`, `detectBlockTone`
  * `src/ui/schedule-planner.ts` -> `renderScheduleView`, `ScheduleSubMode`
  * `src/views.ts` -> `LifeOSCockpitView.renderCalendarTab`, `LifeOSCockpitView.readNoteIfExists`

### [FEATURE: UI-UX-Parity-And-Accessibility] | Aliases: confirm modal, cockpit status bar, focus visible, reduced motion
> **1-Line Summary:** Adds ConfirmModal confirmation guardrail for irreversible migrations, clickable Cockpit Status Bar pill, and WCAG accessibility compliance.
* **User Intention (Non-Negotiable):** Protect user daily note data against accidental migration or bulk resets and provide one-click status bar access to LifeOS Cockpit.
* **Visual / UI Behavior:** Destructive operations prompt a high-contrast modal with confirm/cancel buttons; status bar pill opens the cockpit view.
* **Code Anchors (Grep Targets):** `src/ui/confirm-modal.ts`, `src/main.ts`, `styles.css`

### [FEATURE: Unified-Smart-Tasks-Hub] | Aliases: tasks hub, vault tasks, obsidian tasks metadata, tasks tab, postpone, recurring tasks
> **1-Line Summary:** Lazy-loaded vault-wide Tasks hub with full Obsidian Tasks emoji metadata (`⏫`/`🔼`/`🔽`, `🔁`, `🛫`, `⏳`, `📅`, `✅`, `#tags`), smart buckets, inline priority cycling, `+1d` postpone, NL quick-add, recurring regeneration, and 1-click timeline scheduling.
* **Code Anchors (Grep Targets):**
  * `src/core/note-parser.ts` -> `parseTaskLine`, `serializeTaskLine`
  * `src/core/vault-task-index.ts` -> `VaultTaskIndex`, `toggleVaultTask`, `cycleVaultTaskPriority`, `postponeVaultTask`
  * `src/ui/tasks-hub.ts` -> `renderTasksHub`
  * `src/views.ts` -> `LifeOSCockpitView.renderTasksTab`

### [FEATURE: Built-In-Pomodoro-And-Focus-Tracker] | Aliases: pomodoro timer, zen focus mode, focus bar, focus chart, study minutes
> **1-Line Summary:** Built-in wall-clock Pomodoro sprint timer, compact persistent Focus Bar, distraction-free Zen Focus mode, live status bar countdown, automatic `[focus_minutes::]` / timeline logging, and interactive Focus Minutes analytics chart.
* **Code Anchors (Grep Targets):**
  * `src/core/pomodoro-engine.ts` -> `PomodoroEngine`, `logFocusToDailyNote`
  * `src/ui/pomodoro-bar.ts` -> `renderCompactFocusBar`, `renderZenFocusView`
  * `src/main.ts` -> `LifeOSPlugin.ensurePomodoroEngine`, `LifeOSPlugin.updateStatusBarPill`
  * `src/core/stats-engine.ts` -> `summarizeSingleDay`, `computeAggregateStats`
  * `src/views.ts` -> `LifeOSCockpitView.toggleZenFocusMode`, `LifeOSCockpitView.renderStatsTab`
