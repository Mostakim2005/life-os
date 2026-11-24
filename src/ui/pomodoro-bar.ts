import type { PomodoroPhase, TaskItem } from "../types";
import {
  formatMinutesCompact,
  formatMMSS,
  type PomodoroEngine,
  type PomodoroSnapshot,
} from "../core/pomodoro-engine";

export interface FocusBarHost {
  engine: PomodoroEngine;
  todayMinutes: number;
  todaySessions: number;
  dailyGoalMinutes: number;
  availableTasks: TaskItem[];
  isZenMode: boolean;
  onToggleZenMode: () => void;
  onQuickLogMinutes: (minutes: number, label?: string) => Promise<void>;
}

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  work: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

function populateTaskSelect(selectEl: HTMLSelectElement, tasks: TaskItem[], currentTitle: string): void {
  selectEl.empty();
  selectEl.createEl("option", { value: "", text: "Link an open task…" });
  const openTasks = tasks.filter((t) => !t.done).slice(0, 25);
  for (const t of openTasks) {
    const opt = selectEl.createEl("option", { value: t.title, text: t.title });
    if (t.title === currentTitle) {
      opt.selected = true;
    }
  }
}

function wireTargetInputs(
  engine: PomodoroEngine,
  inputEl: HTMLInputElement,
  selectEl: HTMLSelectElement,
  tasks: TaskItem[],
  initialTitle: string
): void {
  inputEl.value = initialTitle;
  populateTaskSelect(selectEl, tasks, initialTitle);

  inputEl.addEventListener("input", () => {
    engine.setTarget(inputEl.value);
  });

  selectEl.addEventListener("change", () => {
    const val = selectEl.value.trim();
    if (!val) return;
    inputEl.value = val;
    const matched = tasks.find((t) => t.title === val);
    engine.setTarget(val, matched?.id);
  });
}

function getActionButtonText(snap: PomodoroSnapshot): string {
  if (snap.status === "running") return "Pause";
  if (snap.status === "paused") return "Resume";
  return snap.phase === "work" ? "Start" : "Start break";
}

function getProgressRatio(snap: PomodoroSnapshot): number {
  const totalSec = Math.max(1, snap.plannedMinutes * 60);
  const ratio = 1 - snap.remainingSeconds / totalSec;
  return Math.max(0, Math.min(1, ratio));
}

/**
 * Renders the single-row Pomodoro & focus bar below the cockpit header.
 * Returns a cleanup callback to detach the Pomodoro engine subscription.
 */
export function renderCompactFocusBar(container: HTMLElement, host: FocusBarHost): () => void {
  const { engine } = host;
  const snap0 = engine.getSnapshot();

  const bar = container.createDiv({ cls: "life-os-pomo-bar" });
  const left = bar.createDiv({ cls: "life-os-pomo-left" });

  const phasePill = left.createEl("button", {
    text: PHASE_LABELS[snap0.phase],
    cls: "life-os-pomo-phase-pill",
    attr: { type: "button", title: "Cycle Pomodoro phase when idle" },
  });
  phasePill.addEventListener("click", () => {
    const cur = engine.getSnapshot();
    if (cur.status !== "idle") return;
    const next: PomodoroPhase =
      cur.phase === "work" ? "shortBreak" : cur.phase === "shortBreak" ? "longBreak" : "work";
    engine.setPhase(next);
  });

  const clockWrap = left.createDiv({ cls: "life-os-pomo-clock-wrap" });
  const clockEl = clockWrap.createDiv({ cls: "life-os-pomo-clock", text: formatMMSS(snap0.remainingSeconds) });
  const miniTrack = clockWrap.createDiv({ cls: "life-os-pomo-mini-track" });
  const miniFill = miniTrack.createDiv({ cls: "life-os-pomo-mini-fill" });

  const targetWrap = bar.createDiv({ cls: "life-os-pomo-target-wrap" });
  const targetInput = targetWrap.createEl("input", {
    cls: "life-os-input-flex life-os-pomo-target-input",
    attr: { type: "text", placeholder: "Focus intention (optional)…" },
  });
  const taskSelect = targetWrap.createEl("select", { cls: "life-os-select-compact life-os-pomo-task-select" });
  wireTargetInputs(engine, targetInput, taskSelect, host.availableTasks, snap0.targetTitle);

  const controls = bar.createDiv({ cls: "life-os-pomo-controls" });
  const startPauseBtn = controls.createEl("button", {
    text: getActionButtonText(snap0),
    cls: "life-os-btn-primary life-os-pomo-primary-btn",
    attr: { type: "button" },
  });
  startPauseBtn.addEventListener("click", () => {
    engine.setTarget(targetInput.value);
    engine.toggleStartPause();
  });

  const doneLogBtn = controls.createEl("button", {
    text: "Done & log",
    cls: "life-os-btn-subtle",
    attr: { type: "button", title: "Finish now and log elapsed focus minutes" },
  });
  doneLogBtn.addEventListener("click", () => {
    void engine.completeNow();
  });

  const plusFiveBtn = controls.createEl("button", {
    text: "+5m",
    cls: "life-os-btn-subtle",
    attr: { type: "button", title: "Add 5 minutes to current timer" },
  });
  plusFiveBtn.addEventListener("click", () => engine.extendMinutes(5));

  const resetBtn = controls.createEl("button", {
    text: "Reset",
    cls: "life-os-btn-subtle",
    attr: { type: "button" },
  });
  resetBtn.addEventListener("click", () => engine.reset());

  const statsWrap = bar.createDiv({ cls: "life-os-pomo-stats-wrap" });
  const todayText = formatMinutesCompact(host.todayMinutes);
  const goalText = formatMinutesCompact(host.dailyGoalMinutes);
  statsWrap.createSpan({
    text: `🍅 ${todayText} / ${goalText}`,
    cls: "life-os-pomo-today-badge",
    attr: { title: `${host.todaySessions} focus session(s) logged today` },
  });

  const quickLogBtn = statsWrap.createEl("button", {
    text: "+25m",
    cls: "life-os-btn-mini",
    attr: { type: "button", title: "Log an offline 25-minute focus sprint to today's note" },
  });
  quickLogBtn.addEventListener("click", () => {
    void host.onQuickLogMinutes(25, targetInput.value.trim() || "Deep Focus");
  });

  const zenBtn = statsWrap.createEl("button", {
    text: "Zen focus ⤢",
    cls: "life-os-btn-subtle",
    attr: { type: "button", title: "Open distraction-free Focus mode" },
  });
  zenBtn.addEventListener("click", () => host.onToggleZenMode());

  const applySnap = (snap: PomodoroSnapshot): void => {
    bar.toggleClass("is-running", snap.status === "running");
    bar.toggleClass("is-paused", snap.status === "paused");
    bar.toggleClass("is-break", snap.phase !== "work");

    phasePill.setText(PHASE_LABELS[snap.phase]);
    clockEl.setText(formatMMSS(snap.remainingSeconds));
    miniFill.style.width = `${Math.round(getProgressRatio(snap) * 100)}%`;

    startPauseBtn.setText(getActionButtonText(snap));
    const activeWork = snap.status !== "idle" && snap.phase === "work";
    doneLogBtn.toggleClass("is-hidden", !activeWork);
    resetBtn.toggleClass("is-hidden", snap.status === "idle");

    if (document.activeElement !== targetInput && targetInput.value !== snap.targetTitle) {
      targetInput.value = snap.targetTitle;
    }
  };

  applySnap(snap0);
  return engine.subscribe(applySnap);
}

/**
 * Renders the distraction-free Zen Focus view inspired by TaskNotes.
 * Returns a cleanup callback to detach the Pomodoro engine subscription.
 */
export function renderZenFocusView(container: HTMLElement, host: FocusBarHost): () => void {
  const { engine } = host;
  const snap0 = engine.getSnapshot();

  const shell = container.createDiv({ cls: "life-os-zen-shell" });
  const card = shell.createDiv({ cls: "life-os-zen-card" });

  // Top bar inside Zen card
  const head = card.createDiv({ cls: "life-os-zen-head" });
  const headLeft = head.createDiv({ cls: "life-os-zen-head-left" });
  headLeft.createDiv({ text: "Distraction-free focus", cls: "life-os-zen-title" });
  const cycleBadge = headLeft.createSpan({
    text: `Cycle ${snap0.completedCycles + 1}`,
    cls: "life-os-pill-badge is-muted",
  });

  const exitBtn = head.createEl("button", {
    text: "Exit focus mode",
    cls: "life-os-btn-subtle",
    attr: { type: "button" },
  });
  exitBtn.addEventListener("click", () => host.onToggleZenMode());

  // Phase switcher
  const phaseSeg = card.createDiv({ cls: "life-os-segmented life-os-zen-phases" });
  const phaseButtons = new Map<PomodoroPhase, HTMLButtonElement>();
  const phaseOrder: PomodoroPhase[] = ["work", "shortBreak", "longBreak"];
  for (const ph of phaseOrder) {
    const btn = phaseSeg.createEl("button", {
      text: PHASE_LABELS[ph],
      cls: `life-os-seg-btn ${snap0.phase === ph ? "is-active" : ""}`,
      attr: { type: "button" },
    });
    btn.addEventListener("click", () => engine.setPhase(ph));
    phaseButtons.set(ph, btn);
  }

  // Circular SVG Progress Ring
  const svgNS = "http://www.w3.org/2000/svg";
  const ringWrap = card.createDiv({ cls: "life-os-zen-ring-wrap" });
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.setAttribute("class", "life-os-zen-ring-svg");

  const radius = 84;
  const circumference = 2 * Math.PI * radius;

  const trackCircle = document.createElementNS(svgNS, "circle");
  trackCircle.setAttribute("cx", "100");
  trackCircle.setAttribute("cy", "100");
  trackCircle.setAttribute("r", String(radius));
  trackCircle.setAttribute("class", "life-os-zen-ring-track");
  svg.appendChild(trackCircle);

  const progCircle = document.createElementNS(svgNS, "circle");
  progCircle.setAttribute("cx", "100");
  progCircle.setAttribute("cy", "100");
  progCircle.setAttribute("r", String(radius));
  progCircle.setAttribute("stroke-dasharray", String(circumference));
  progCircle.setAttribute("stroke-dashoffset", String(circumference));
  progCircle.setAttribute("class", "life-os-zen-ring-prog");
  svg.appendChild(progCircle);
  ringWrap.appendChild(svg);

  const centerReadout = ringWrap.createDiv({ cls: "life-os-zen-ring-center" });
  const bigClock = centerReadout.createDiv({
    text: formatMMSS(snap0.remainingSeconds),
    cls: "life-os-zen-clock",
  });
  const subStatus = centerReadout.createDiv({
    text: PHASE_LABELS[snap0.phase],
    cls: "life-os-zen-substatus",
  });

  // Intention + Task picker
  const targetRow = card.createDiv({ cls: "life-os-zen-target-row" });
  const targetInput = targetRow.createEl("input", {
    cls: "life-os-input-flex",
    attr: { type: "text", placeholder: "What are you focusing on right now?" },
  });
  const taskSelect = targetRow.createEl("select", { cls: "life-os-select-compact" });
  wireTargetInputs(engine, targetInput, taskSelect, host.availableTasks, snap0.targetTitle);

  // Action buttons
  const actionsRow = card.createDiv({ cls: "life-os-zen-actions" });
  const mainBtn = actionsRow.createEl("button", {
    text: getActionButtonText(snap0),
    cls: "life-os-btn-primary life-os-zen-main-btn",
    attr: { type: "button" },
  });
  mainBtn.addEventListener("click", () => {
    engine.setTarget(targetInput.value);
    engine.toggleStartPause();
  });

  const doneLogBtn = actionsRow.createEl("button", {
    text: "Done & log",
    cls: "life-os-btn-subtle",
    attr: { type: "button", title: "Finish sprint early and log focus minutes" },
  });
  doneLogBtn.addEventListener("click", () => {
    void engine.completeNow();
  });

  const plusFiveBtn = actionsRow.createEl("button", {
    text: "+5m",
    cls: "life-os-btn-subtle",
    attr: { type: "button" },
  });
  plusFiveBtn.addEventListener("click", () => engine.extendMinutes(5));

  const skipBtn = actionsRow.createEl("button", {
    text: "Skip",
    cls: "life-os-btn-subtle",
    attr: { type: "button" },
  });
  skipBtn.addEventListener("click", () => engine.skipPhase());

  const resetBtn = actionsRow.createEl("button", {
    text: "Reset",
    cls: "life-os-btn-subtle",
    attr: { type: "button" },
  });
  resetBtn.addEventListener("click", () => engine.reset());

  // Today's telemetry footer
  const footer = card.createDiv({ cls: "life-os-zen-footer" });
  const goalPct =
    host.dailyGoalMinutes > 0
      ? Math.min(100, Math.round((host.todayMinutes / host.dailyGoalMinutes) * 100))
      : 0;
  const footTop = footer.createDiv({ cls: "life-os-zen-foot-top" });
  footTop.createSpan({
    text: `Today: ${formatMinutesCompact(host.todayMinutes)} (${host.todaySessions} session${host.todaySessions === 1 ? "" : "s"})`,
  });
  footTop.createSpan({
    text: `Goal: ${formatMinutesCompact(host.dailyGoalMinutes)} (${goalPct}%)`,
    cls: "life-os-muted-text",
  });

  const progressTrack = footer.createDiv({ cls: "life-os-progress-track" });
  const progressFill = progressTrack.createDiv({ cls: "life-os-progress-fill life-os-fill-focus" });
  progressFill.style.width = `${goalPct}%`;

  const manualRow = footer.createDiv({ cls: "life-os-zen-manual-row" });
  manualRow.createSpan({ text: "Log offline sprint:", cls: "life-os-muted-text" });
  for (const mins of [15, 25, 50] as const) {
    const btn = manualRow.createEl("button", {
      text: `+${mins}m`,
      cls: "life-os-btn-mini",
      attr: { type: "button" },
    });
    btn.addEventListener("click", () => {
      void host.onQuickLogMinutes(mins, targetInput.value.trim() || "Deep Focus");
    });
  }

  const applySnap = (snap: PomodoroSnapshot): void => {
    card.toggleClass("is-running", snap.status === "running");
    card.toggleClass("is-paused", snap.status === "paused");
    card.toggleClass("is-break", snap.phase !== "work");

    for (const [ph, btn] of phaseButtons.entries()) {
      btn.toggleClass("is-active", ph === snap.phase);
    }

    bigClock.setText(formatMMSS(snap.remainingSeconds));
    const statusSuffix =
      snap.status === "running"
        ? "Running"
        : snap.status === "paused"
          ? "Paused"
          : "Ready";
    subStatus.setText(`${PHASE_LABELS[snap.phase]} · ${statusSuffix}`);
    cycleBadge.setText(`Cycle ${snap.completedCycles + 1}`);

    const ratio = getProgressRatio(snap);
    progCircle.setAttribute("stroke-dashoffset", String(circumference * (1 - ratio)));

    mainBtn.setText(getActionButtonText(snap));
    const activeWork = snap.status !== "idle" && snap.phase === "work";
    doneLogBtn.toggleClass("is-hidden", !activeWork);
    resetBtn.toggleClass("is-hidden", snap.status === "idle");

    if (document.activeElement !== targetInput && targetInput.value !== snap.targetTitle) {
      targetInput.value = snap.targetTitle;
    }
  };

  applySnap(snap0);
  return engine.subscribe(applySnap);
}
