# Product Intent & Feature Map (`PRODUCT.md`)
> **1-Line Summary:** High-density personal operating cockpit for prayer, habits, sleep, hydration, exercise, and tasks with universal Obsidian interoperability.

## 1. Core Vision & User Experience Intent
* **What This App Does (Plain English):** Consolidates daily life tracking into a single zero-scroll cockpit inside Obsidian, writing data cleanly into standard markdown daily notes.
* **How It Must Feel to Use:** High-density, minimal typing, discrete 15-minute timebox selectors, quick-steppers, and zero layout shifting.

## 2. Active Features (Do Not Break)

### [FEATURE: Full-Window-Life-OS-Cockpit] | Aliases: cockpit view, life os cockpit, full window workspace
> **1-Line Summary:** Dedicated full-window ItemView tab with close protection (auto-pin), ribbon icon, and tabbed navigation across Cockpit, Calendar, Stats, Tasks, and Settings.
* **Code Anchors (Grep Targets):**
  * `src/views.ts` -> `LifeOSCockpitView`
  * `src/views.ts` -> `renderCockpitTab`
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

## 3. Planned Features & App-Merge Wishlist

### [WISHLIST: Interactive-ChartJS-Overlay] | Aliases: chart.js upgrade, multi-series trend charts
> **1-Line Summary:** Optional Phase 2 Chart.js integration for canvas-based tooltips and multi-series health overlays.

### [WISHLIST: Natural-Language-Dates-And-Recurrence] | Aliases: chrono node, rrule, recurring tasks
> **1-Line Summary:** Optional natural-language task creation via chrono-node and recurring task scheduling via rrule.

### [WISHLIST: Offline-Python-Analytics] | Aliases: python pandas script, monthly health pdf
> **1-Line Summary:** Offline Python CLI script parsing standard inline fields to output monthly trend charts and CSV reports.
