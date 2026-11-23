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

