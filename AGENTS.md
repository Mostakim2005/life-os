# Project Operating Instructions (`AGENTS.md`)
> **Notice:** This project inherits user persona, confirmation gates, visual standards, and documentation blueprints from the global master `AGENTS.md`. Do not duplicate those rules here.

## 1. Project Tech Stack & Environment
* **Runtime / Language:** Node.js v20+, TypeScript 5+, esbuild
* **Framework / Host:** Obsidian Plugin API (`obsidian`)
* **Target OS / Build Output:** Desktop & Mobile (`runtime/main.js`, `runtime/manifest.json`, `runtime/styles.css`)

## 2. Mandatory Verification & Build Commands
* **Type Check:** `npx tsc --noEmit`
* **Build / Package:** `npm run build`

## 3. Repository Directory Structure & Conventions
* `src/` - Modular source files (`main.ts`, `settings.ts`, `types.ts`, `views.ts`).
* `runtime/` - Compiled plug-and-play deliverable files for vault deployment.
* `docs/` - Core Markdown documentation suite (`PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS_AND_TRAPS.md`, `VISUAL_LOG.md`).

## 4. Critical Trap Pointers (1-Line Warnings Only)
* **TRAP 1:** Never use destructive regex rewrites on daily notes; always isolate habit sections with surgical bounds — see `docs/DECISIONS_AND_TRAPS.md` -> `[TRAP: Non-Destructive-Section-Surgery-Corruption]`.
* **TRAP 2:** Never assume local midnight rollover without refreshing prayer timetable cache — see `docs/DECISIONS_AND_TRAPS.md` -> `[TRAP: Day-Boundary-Midnight-Rollover]`.
