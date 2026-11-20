# Architectural Decisions, Pivots & Landmines (`DECISIONS_AND_TRAPS.md`)
> **1-Line Summary:** Architectural decisions and markdown preservation traps for Life OS.

## 1. Architectural Decisions & Pivot History

### [DECISION: Markdown-As-Sole-Database] | Aliases: no sqlite, zero lock-in
> **1-Line Summary:** Refused proprietary database or SQLite stores in favor of transparent local Markdown note parsing.
* **Decision Maker:** `[DECIDED BY: HUMAN]`
* **Original User Intention:** All personal habits and wellness notes must remain readable and versionable in standard Git repositories forever.

## 2. Do-Not-Touch Engineering Landmines (Traps)

### [TRAP: Non-Destructive-Section-Surgery-Corruption] | Aliases: section parser destruction, note wipe
> **1-Line Summary:** Whole-file rewriting can accidentally erase user daily reflections and callouts.
* **Strict Rule:** **NEVER** overwrite an entire daily note file; always use bounded regex section replacement.
* **Protected Code Anchors (Grep Targets):**
  * `src/main.ts` -> `SECTION_BOUNDARY_GUARD`
