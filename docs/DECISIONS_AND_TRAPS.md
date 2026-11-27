# Architectural Decisions, Pivots & Landmines (`DECISIONS_AND_TRAPS.md`)
> **1-Line Summary:** Architectural decisions and markdown preservation traps for Life OS.

## 1. Architectural Decisions & Pivot History

### [DECISION: Markdown-As-Sole-Database] | Aliases: no sqlite, zero lock-in
> **1-Line Summary:** Refused proprietary database or SQLite stores in favor of transparent local Markdown note parsing.
* **Decision Maker:** `[DECIDED BY: HUMAN]`
* **Original User Intention:** All personal habits and wellness notes must remain readable and versionable in standard Git repositories forever.

### [DECISION: Native-Zero-Dependency-Cockpit] | Aliases: no multi plugin sprawl, native svg charts
> **1-Line Summary:** Embedded calendar dots, SVG charts, task filters, and timeline blocks natively rather than depending on 5 disparate Obsidian community plugins.
* **Decision Maker:** `[DECIDED BY: HUMAN]`
* **Original User Intention:** A self-contained, robust all-in-one Life OS cockpit without installation hurdles or plugin conflicts.

### [DECISION: Inline-Only-Default-Storage] | Aliases: dataview inline fields, clean notes
> **1-Line Summary:** Default storage uses inline field syntax `[field:: value]` to prevent cluttering frontmatter while supporting an optional dual frontmatter toggle.
* **Decision Maker:** `[DECIDED BY: HUMAN]`
* **Original User Intention:** Notes look clean in Live Preview while remaining 100% queryable by Dataview.

## 2. Do-Not-Touch Engineering Landmines (Traps)

### [TRAP: Non-Destructive-Section-Surgery-Corruption] | Aliases: section parser destruction, note wipe
> **1-Line Summary:** Whole-file rewriting can accidentally erase user daily reflections, callouts, and manual notes.
* **Strict Rule:** **NEVER** overwrite an entire daily note file; parse existing content, merge fields, and update bounded sections.
* **Protected Code Anchors (Grep Targets):**
  * `src/core/note-parser.ts` -> `applyParsedNoteToMarkdown`

### [TRAP: Daily-Note-Date-Format-Mismatch] | Aliases: YYYY-MM-DD vs DD-MM-YYYY, filename collision
> **1-Line Summary:** Life OS uses `DD-MM-YYYY.md` filename convention while task metadata uses ISO `YYYY-MM-DD`.
* **Strict Rule:** Note files must always format as `DD-MM-YYYY.md` via `formatDateDdMmYyyy()`. Never use ISO format for daily note filenames.
* **Protected Code Anchors (Grep Targets):**
  * `src/core/date-format.ts` -> `formatDateDdMmYyyy`
  * `src/core/note-parser.ts` -> `parseDailyNote`

### [TRAP: ChartJS-Canvas-Memory-Leaks] | Aliases: chart destroy, memory leak prevention
> **1-Line Summary:** Re-rendering stats or closing cockpit without destroying Chart instances leaks canvas references and event listeners.
* **Strict Rule:** Every mounted Chart instance must be registered in `this.activeCharts` and destroyed via `c.destroy()` upon re-render and `onClose()`.
* **Protected Code Anchors (Grep Targets):**
  * `src/views.ts` -> `destroyActiveCharts`
  * `src/views.ts` -> `onClose`

### [DECISION: Non-Blocking-Startup-Hydration] | Aliases: startup latency, non-blocking onload, deferred settings
> **1-Line Summary:** Hydrated settings asynchronously via settingsReady and gated onLayoutReady inbox reconciliation on settingsReady so onload() is non-blocking.
* **Decision Maker:** `[DECIDED BY: HUMAN]`
* **Protected Code Anchors (Grep Targets):** `src/main.ts` -> `onload`, `settingsReady`


### [DECISION: Pure-TS-Schedule-And-Lazy-Chart-NLP] | Aliases: lazy chartjs, lazy chrono, pure ts timeline, no react svelte bloat, chunk splitting
> **1-Line Summary:** Split `Life OS` into a 13 KB `main.js` startup shell plus on-demand chunks (`lifeos-cockpit.chunk.js`, tree-shaken `lifeos-charts.chunk.js` with Bar+Line only, and `lifeos-nlp.chunk.js` for `chrono-node`/`rrule`), scoped `.life-os-glassmorphic` off `document.body`, replaced `vault.getFiles()` inbox scans with direct `.inbox` `TFolder` lookup on `requestIdleCallback`, and fixed the `onOpen()` `settingsReady` await race.
* **Decision Maker:** `[DECIDED BY: HUMAN]`
* **Protected Code Anchors (Grep Targets):**
  * `src/core/chunk-loader.ts :: loadPluginChunkAsync`
  * `src/core/chartjs-renderer.ts :: getChartConstructor`
  * `src/core/task-nlp.ts :: parseNaturalLanguageTask`
  * `src/interop/inbox-reconciler.ts :: reconcileMobileInbox`
  * `src/views.ts :: LifeOSCockpitController.onOpen`
  * `src/core/timeline-layout.ts :: computeOverlapLayout`

### [DECISION: Lazy-Mtime-Vault-Task-Index] | Aliases: vault tasks scan, lazy task index, startup zero cost
> **1-Line Summary:** Deferred vault-wide Markdown task scanning completely out of `onload()` into an on-demand `VaultTaskIndex` instantiated only when opening the `Tasks` tab, using per-file `mtime` caching and skipping fenced code blocks and daily-note `## Prayers` / `## Habits` / `## Timeline` sections.
* **Decision Maker:** `[DECIDED BY: HUMAN]`
* **Protected Code Anchors (Grep Targets):** `src/core/vault-task-index.ts` -> `VaultTaskIndex.scan`, `src/views.ts` -> `LifeOSCockpitView.renderTasksTab`

### [TRAP: Task-Line-In-Place-Mutation-And-Emoji-Ordering] | Aliases: recurrence regex swallow, stale line number mutation
> **1-Line Summary:** Two task-mutation hazards: recurrence regexes must exclude `⏳`/`🛫`/`📅`/`✅` so trailing dates are not captured into `recurrence`, and direct vault line edits must re-verify line identity against `rawLine`/title inside `app.vault.process` instead of trusting potentially stale line indices.
* **Strict Rule:** Always parse `🛫`, `⏳`, `📅`, `✅`, and priority emojis before matching `🔁` (and exclude them from its character class), and always resolve target task indices via `findMatchingLineIndex` inside `app.vault.process`.
* **Protected Code Anchors (Grep Targets):** `src/core/note-parser.ts` -> `parseTaskLine`, `src/core/vault-task-index.ts` -> `findMatchingLineIndex`

### [DECISION: Lazy-WallClock-Pomodoro-Engine] | Aliases: pomodoro timer, focus engine, zero idle interval, status bar timer
> **1-Line Summary:** Hosted `PomodoroEngine` lazily on `LifeOSPlugin` using wall-clock `targetEndMs` timestamps and zero active intervals when idle, preserving timer continuity across tab switches and displaying live countdowns in Obsidian's status bar pill.
* **Decision Maker:** `[DECIDED BY: AGENT]` (Following user zero-startup-cost mandate)
* **Protected Code Anchors (Grep Targets):** `src/core/pomodoro-engine.ts` -> `PomodoroEngine`, `src/main.ts` -> `ensurePomodoroEngine`

### [TRAP: Reentrant-Timer-Tick-And-DOM-Focus-Stealing] | Aliases: double log focus, timer input focus loss
> **1-Line Summary:** Naive `setInterval` timers double-log slow async vault writes at 00:00 and re-rendering the bar every second blurs active text inputs.
* **Strict Rule:** Always stop the interval and set `isFinishing` before awaiting `logFocusToDailyNote`, and update only countdown text, progress fills, and button states in place via subscribed callbacks (cleaning up via returned unsubscribe hooks in `cleanupFocusBar`).
* **Protected Code Anchors (Grep Targets):** `src/core/pomodoro-engine.ts` -> `finishPhase`, `src/ui/pomodoro-bar.ts` -> `renderCompactFocusBar`, `src/views.ts` -> `cleanupFocusBar`
