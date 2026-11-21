# System Architecture (`ARCHITECTURE.md`)
> **1-Line Summary:** Modular TypeScript full-window cockpit writing transparently to local Markdown daily notes.

## 1. High-Level Visual System Map

```mermaid
flowchart TB
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff
    classDef bridgeNode fill:#7c3aed,stroke:#5b21b6,color:#ffffff

    User([User Habit / Metric / Tab Action]):::startNode --> Cockpit[LifeOSCockpitView]:::processNode
    Cockpit --> NoteParser[Note Parser & Section Builder]:::processNode
    NoteParser -->|non-destructive inline update| NoteFile[(Daily Note DD-MM-YYYY.md)]:::outputNode
    NoteFile -->|reads history across days| Stats[StatsEngine]:::processNode
    Stats -->|renders zero-dependency SVG charts & calendar dots| Cockpit
    Inbox[(.inbox/*.jsonl mutations)]:::bridgeNode --> Reconciler[InboxReconciler]:::processNode
    Reconciler -->|reconciles mobile edits on load| NoteFile

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = User Interaction]):::startNode
        L2[Teal = Internal Processing Engine]:::processNode
        L3[(Green = Markdown Daily Note Storage)]:::outputNode
        L4[(Purple = External Sync & Mobile Inbox)]:::bridgeNode
    end
```

## 2. Tech Stack & Why We Chose It

| Layer | Tool / Library | Plain-English Reason Why |
| --- | --- | --- |
| Host / UI | Obsidian Plugin API (`ItemView`) | Full-window tabbed cockpit with left-ribbon shortcut and pinned-tab close protection. |
| Prayer Calculation | `adhan` (`^4.4.3`) | Pure offline astronomical prayer calculation without external network calls. |
| Data Store | Plain Markdown Files (`DD-MM-YYYY.md`) | Offline-first, transparent, git-versionable personal notes with inline fields (`[field:: value]`). |
| Visual Charts | Native SVG (`src/core/stats-engine.ts`) | Zero runtime dependency SVG bar/line charts matching light and dark themes. |
| Bundler | `esbuild` | Fast modular build compiling TypeScript to `main.js`. |

## 3. Core Subsystems & Engineering Mechanics

### [SUBSYSTEM: Full-Window-Cockpit-View] | Aliases: cockpit tab router, item view manager
> **1-Line Summary:** Full-window view holding five tabs: Daily Cockpit, Calendar View, Stats & Tracker, Tasks & Timeblocks, and Settings.
* **Code Anchors (Grep Targets):**
  * `src/views.ts` -> `LifeOSCockpitView`
  * `src/main.ts` -> `activateCockpitView`

### [SUBSYSTEM: Note-Parser-And-Section-Builder] | Aliases: note parser, inline field extractor
> **1-Line Summary:** Surgical regex and block parser extracting and updating sleep, water, prayers, habits, tasks, and timeblocks.
* **Code Anchors (Grep Targets):**
  * `src/core/note-parser.ts` -> `parseDailyNote`
  * `src/core/note-parser.ts` -> `applyParsedNoteToMarkdown`

### [SUBSYSTEM: Builtin-Stats-Engine] | Aliases: stats calculator, svg chart generator
> **1-Line Summary:** Computes 30-day aggregate stats and SVG chart elements for vitals and habit consistency.
* **Code Anchors (Grep Targets):**
  * `src/core/stats-engine.ts` -> `computeAggregateStats`
  * `src/core/stats-engine.ts` -> `renderMetricBarChart`

### [SUBSYSTEM: Mobile-Inbox-Reconciler] | Aliases: jsonl reconciler, companion export
> **1-Line Summary:** Ingests external offline `.inbox/*.jsonl` mutations upon workspace layout ready and exports to Super Productivity & Loop Habits.
* **Code Anchors (Grep Targets):**
  * `src/interop/inbox-reconciler.ts` -> `reconcileMobileInbox`
