import type { App, TFile } from "obsidian";
import type { LifeOSSettings, PomodoroPhase, PomodoroSettings } from "../types";
import { todayDMY } from "./date-format";
import {
  applyParsedNoteToMarkdown,
  clampFocusMinutes,
  clampFocusSessions,
  parseDailyNote,
} from "./note-parser";

export type PomodoroStatus = "idle" | "running" | "paused";

export interface PomodoroSnapshot {
  status: PomodoroStatus;
  phase: PomodoroPhase;
  remainingSeconds: number;
  plannedMinutes: number;
  targetTitle: string;
  targetTaskId?: string;
  completedCycles: number;
  sessionStartedAtMs: number | null;
}

export interface PomodoroCompletePayload {
  phase: PomodoroPhase;
  elapsedMinutes: number;
  plannedMinutes: number;
  targetTitle: string;
  startedAtMs: number;
  endedAtMs: number;
}

export type PomodoroListener = (snap: PomodoroSnapshot) => void;

export function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatMinutesCompact(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  if (safe < 60) return `${safe}m`;
  const hrs = Math.floor(safe / 60);
  const rem = safe % 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

function formatHHMMFromMs(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function playPomodoroChime(isWorkComplete: boolean): void {
  try {
    const win = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtx = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const notes = isWorkComplete ? [523.25, 659.25, 783.99] : [659.25, 523.25];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.38);
    });

    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 1100);
  } catch {
    // Ignore audio context blocks in headless or restricted environments
  }
}

export async function logFocusToDailyNote(
  app: App,
  settings: LifeOSSettings,
  ensureTodayNote: () => Promise<TFile>,
  addMinutes: number,
  addSessions: number,
  sessionLabel?: string,
  startedAtMs?: number | null,
  endedAtMs?: number | null
): Promise<{ totalMinutes: number; totalSessions: number }> {
  const file = await ensureTodayNote();
  const dateKey = todayDMY();
  let totalMinutes = 0;
  let totalSessions = 0;

  await app.vault.process(file, (content) => {
    const parsed = parseDailyNote(content, dateKey, settings);
    parsed.focusMinutes = clampFocusMinutes(parsed.focusMinutes + Math.max(0, Math.round(addMinutes)));
    parsed.focusSessions = clampFocusSessions(
      parsed.focusSessions + Math.max(0, Math.round(addSessions))
    );
    totalMinutes = parsed.focusMinutes;
    totalSessions = parsed.focusSessions;

    if (
      settings.pomodoro.logTimeblockOnComplete &&
      addMinutes >= 1 &&
      startedAtMs &&
      endedAtMs &&
      endedAtMs > startedAtMs
    ) {
      const startTime = formatHHMMFromMs(startedAtMs);
      let endTime = formatHHMMFromMs(endedAtMs);
      if (startTime === endTime) {
        endTime = formatHHMMFromMs(startedAtMs + Math.max(1, addMinutes) * 60_000);
      }
      const cleanLabel = sessionLabel?.trim() || "Deep Focus";
      parsed.timeline.push({
        id: `pomo-${Date.now().toString(36)}`,
        startTime,
        endTime,
        title: `🍅 ${cleanLabel}`,
        done: true,
      });
    }

    return applyParsedNoteToMarkdown(content, parsed, settings);
  });

  return { totalMinutes, totalSessions };
}

/**
 * Wall-clock accurate Pomodoro engine with zero background timers while idle.
 */
export class PomodoroEngine {
  private status: PomodoroStatus = "idle";
  private phase: PomodoroPhase = "work";
  private remainingSeconds: number;
  private plannedMinutes: number;
  private targetTitle = "";
  private targetTaskId?: string;
  private completedCycles = 0;
  private sessionStartedAtMs: number | null = null;
  private targetEndMs: number | null = null;
  private tickTimer: number | null = null;
  private isFinishing = false;
  private listeners = new Set<PomodoroListener>();

  constructor(
    private getSettings: () => PomodoroSettings,
    private onComplete: (payload: PomodoroCompletePayload) => Promise<void>
  ) {
    const workMin = this.getPhaseMinutes("work");
    this.plannedMinutes = workMin;
    this.remainingSeconds = workMin * 60;
  }

  private getPhaseMinutes(phase: PomodoroPhase): number {
    const s = this.getSettings();
    if (phase === "work") return Math.max(1, Math.min(180, Math.round(s.workMinutes || 25)));
    if (phase === "shortBreak") {
      return Math.max(1, Math.min(60, Math.round(s.shortBreakMinutes || 5)));
    }
    return Math.max(1, Math.min(90, Math.round(s.longBreakMinutes || 15)));
  }

  subscribe(fn: PomodoroListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) {
      fn(snap);
    }
  }

  getSnapshot(): PomodoroSnapshot {
    return {
      status: this.status,
      phase: this.phase,
      remainingSeconds: this.remainingSeconds,
      plannedMinutes: this.plannedMinutes,
      targetTitle: this.targetTitle,
      targetTaskId: this.targetTaskId,
      completedCycles: this.completedCycles,
      sessionStartedAtMs: this.sessionStartedAtMs,
    };
  }

  setTarget(title: string, taskId?: string): void {
    this.targetTitle = title.trim();
    this.targetTaskId = taskId;
    this.emit();
  }

  setPhase(phase: PomodoroPhase): void {
    this.stopTicker();
    this.status = "idle";
    this.phase = phase;
    this.plannedMinutes = this.getPhaseMinutes(phase);
    this.remainingSeconds = this.plannedMinutes * 60;
    this.sessionStartedAtMs = null;
    this.targetEndMs = null;
    this.emit();
  }

  syncSettingsDefaultsIfIdle(): void {
    if (this.status !== "idle") return;
    this.plannedMinutes = this.getPhaseMinutes(this.phase);
    this.remainingSeconds = this.plannedMinutes * 60;
    this.emit();
  }

  start(overridePhase?: PomodoroPhase, targetTitle?: string, taskId?: string): void {
    if (overridePhase && (this.phase !== overridePhase || this.status === "idle")) {
      this.stopTicker();
      this.phase = overridePhase;
      this.plannedMinutes = this.getPhaseMinutes(overridePhase);
      this.remainingSeconds = this.plannedMinutes * 60;
      this.sessionStartedAtMs = null;
    }
    if (targetTitle !== undefined) {
      this.targetTitle = targetTitle.trim();
      this.targetTaskId = taskId;
    }
    if (this.remainingSeconds <= 0) {
      this.plannedMinutes = this.getPhaseMinutes(this.phase);
      this.remainingSeconds = this.plannedMinutes * 60;
    }

    const now = Date.now();
    if (!this.sessionStartedAtMs) {
      this.sessionStartedAtMs = now;
    }
    this.targetEndMs = now + this.remainingSeconds * 1000;
    this.status = "running";
    this.startTicker();
    this.emit();
  }

  pause(): void {
    if (this.status !== "running") return;
    if (this.targetEndMs !== null) {
      this.remainingSeconds = Math.max(0, Math.ceil((this.targetEndMs - Date.now()) / 1000));
    }
    this.targetEndMs = null;
    this.status = "paused";
    this.stopTicker();
    this.emit();
  }

  resume(): void {
    if (this.status !== "paused") return;
    if (this.remainingSeconds <= 0) {
      void this.finishPhase(false);
      return;
    }
    this.targetEndMs = Date.now() + this.remainingSeconds * 1000;
    this.status = "running";
    this.startTicker();
    this.emit();
  }

  toggleStartPause(): void {
    if (this.status === "running") {
      this.pause();
    } else if (this.status === "paused") {
      this.resume();
    } else {
      this.start();
    }
  }

  extendMinutes(minutes = 5): void {
    const deltaSec = Math.round(minutes * 60);
    this.remainingSeconds = Math.max(60, this.remainingSeconds + deltaSec);
    if (this.status === "idle") {
      this.plannedMinutes = Math.max(1, Math.round(this.remainingSeconds / 60));
    }
    if (this.targetEndMs !== null) {
      this.targetEndMs += deltaSec * 1000;
    }
    this.emit();
  }

  reset(): void {
    this.stopTicker();
    this.status = "idle";
    this.plannedMinutes = this.getPhaseMinutes(this.phase);
    this.remainingSeconds = this.plannedMinutes * 60;
    this.sessionStartedAtMs = null;
    this.targetEndMs = null;
    this.emit();
  }

  skipPhase(): void {
    this.stopTicker();
    const nextPhase = this.computeNextPhase(false);
    this.status = "idle";
    this.phase = nextPhase;
    this.plannedMinutes = this.getPhaseMinutes(nextPhase);
    this.remainingSeconds = this.plannedMinutes * 60;
    this.sessionStartedAtMs = null;
    this.targetEndMs = null;
    this.emit();
  }

  async completeNow(): Promise<void> {
    if (this.status === "idle") return;
    await this.finishPhase(true);
  }

  destroy(): void {
    this.stopTicker();
    this.listeners.clear();
  }

  private startTicker(): void {
    this.stopTicker();
    this.tickTimer = window.setInterval(() => {
      this.onTick();
    }, 1000);
  }

  private stopTicker(): void {
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private onTick(): void {
    if (this.status !== "running" || this.targetEndMs === null) return;
    const rem = Math.max(0, Math.ceil((this.targetEndMs - Date.now()) / 1000));
    this.remainingSeconds = rem;
    if (rem <= 0) {
      void this.finishPhase(false);
    } else {
      this.emit();
    }
  }

  private computeNextPhase(incrementWorkCount: boolean): PomodoroPhase {
    if (this.phase === "work") {
      if (incrementWorkCount) {
        this.completedCycles += 1;
      }
      const interval = Math.max(1, Math.round(this.getSettings().longBreakInterval || 4));
      return this.completedCycles > 0 && this.completedCycles % interval === 0
        ? "longBreak"
        : "shortBreak";
    }
    return "work";
  }

  private async finishPhase(earlyCompletion: boolean): Promise<void> {
    if (this.isFinishing) return;
    this.isFinishing = true;
    this.stopTicker();

    const completedPhase = this.phase;
    const endedAtMs = Date.now();
    const startedAtMs = this.sessionStartedAtMs ?? endedAtMs - this.plannedMinutes * 60_000;
    const rawElapsedMin = Math.round((endedAtMs - startedAtMs) / 60_000);
    const elapsedMinutes = earlyCompletion
      ? Math.max(1, Math.min(this.plannedMinutes, rawElapsedMin))
      : this.plannedMinutes;

    const settings = this.getSettings();
    if (settings.soundEnabled) {
      playPomodoroChime(completedPhase === "work");
    }

    const payload: PomodoroCompletePayload = {
      phase: completedPhase,
      elapsedMinutes,
      plannedMinutes: this.plannedMinutes,
      targetTitle: this.targetTitle,
      startedAtMs,
      endedAtMs,
    };

    this.status = "idle";
    this.remainingSeconds = 0;
    this.targetEndMs = null;
    this.sessionStartedAtMs = null;

    try {
      await this.onComplete(payload);
    } catch (err) {
      console.error("Pomodoro completion error:", err);
    } finally {
      const nextPhase = this.computeNextPhase(completedPhase === "work");
      this.phase = nextPhase;
      this.plannedMinutes = this.getPhaseMinutes(nextPhase);
      this.remainingSeconds = this.plannedMinutes * 60;
      this.isFinishing = false;

      const shouldAutoStart =
        (completedPhase === "work" && settings.autoStartBreaks) ||
        (completedPhase !== "work" && settings.autoStartWork);

      if (shouldAutoStart) {
        this.start();
      } else {
        this.emit();
      }
    }
  }
}
