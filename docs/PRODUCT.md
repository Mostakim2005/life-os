# Product Intent & Feature Map (`PRODUCT.md`)
> **1-Line Summary:** High-density personal operating cockpit for prayer, habits, sleep, hydration, exercise, and tasks with universal Obsidian interoperability.

## 1. Core Vision & User Experience Intent
* **What This App Does (Plain English):** Consolidates daily life tracking into a single zero-scroll cockpit inside Obsidian, writing data cleanly into standard markdown daily notes.
* **How It Must Feel to Use:** High-density, minimal typing, discrete 15-minute timebox selectors, quick-steppers, and zero layout shifting.

## 2. Active Features (Do Not Break)

### [FEATURE: Single-Pane-Daily-Cockpit] | Aliases: dashboard view, life os tracker, habit cockpit
> **1-Line Summary:** High-density dashboard displaying prayer times, hydration counters, habit toggles, and sleep scores.
* **Code Anchors (Grep Targets):**
  * `src/views.ts` -> `renderCockpitView`

### [FEATURE: Non-Destructive-Markdown-Note-Sync] | Aliases: section surgery, daily note updater
> **1-Line Summary:** Surgically updates habit and tracking tables in markdown notes without wiping user comments or nested lists.
* **Code Anchors (Grep Targets):**
  * `src/main.ts` -> `updateDailyNoteSection`

## 3. Planned Features & App-Merge Wishlist

### [WISHLIST: Wearable-Health-Auto-Sync] | Aliases: google fit sync, sleep data import
> **1-Line Summary:** Local bridge to import sleep hours and step count from exported health archives.
