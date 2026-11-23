import { Notice, setIcon, type App } from "obsidian";
import type LifeOSPlugin from "../main";
import type { ParsedDailyNote, TaskItem } from "../types";
import { formatDateDMY, parseAnyDateKey, todayDMY, toISOKey } from "../core/date-format";
import { collectMonthSummaries } from "../core/stats-engine";
import {
  computeOverlapLayout,
  formatDurationLabel,
  formatMinutesHHMM,
  getWeekDates,
  parseTimeMinutes,
  snapMinutes,
} from "../core/timeline-layout";

export type ScheduleSubMode = "day" | "week" | "month";

export interface SchedulePlannerHost {
  selectedDateKey: string;
  calendarYear: number;
  calendarMonth: number;
  scheduleSubMode: ScheduleSubMode;
  fullDayHours: boolean;
  onChangeSubMode: (mode: ScheduleSubMode) => void;
  onToggleFullDayHours: () => void;
  onSelectDate: (dateKey: string) => void;
  onShiftDate: (deltaDays: number) => void;
  onOpenCockpitForDate: (dateKey: string) => void;
  onShiftMonth: (deltaMonths: number) => void;
  loadNoteForDate: (dateKey: string) => Promise<ParsedDailyNote>;
  saveNoteForDate: (dateKey: string, note: ParsedDailyNote) => Promise<void>;
  onRequestRefresh: () => void;
}

const HOUR_HEIGHT_PX = 56;

interface WeekDragPayload {
  kind: "block" | "task";
  sourceDateKey: string;
  itemId: string;
}

function makeBlockId(prefix = "blk"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function findNextOpenSlot(note: ParsedDailyNote, durationMin = 60): { start: string; end: string } {
  const sorted = note.timeline
    .map((b) => ({
      start: parseTimeMinutes(b.startTime),
      end: Math.max(parseTimeMinutes(b.startTime) + 15, parseTimeMinutes(b.endTime)),
    }))
    .sort((a, b) => a.start - b.start);

  const now = new Date();
  let candidate = snapMinutes(Math.max(9 * 60, now.getHours() * 60 + now.getMinutes()), 15);
  if (candidate + durationMin > 23 * 60) candidate = 9 * 60;

  for (const blk of sorted) {
    if (candidate + durationMin <= blk.start) break;
    if (candidate < blk.end) {
      candidate = snapMinutes(blk.end, 15);
    }
  }
  if (candidate + durationMin > 23 * 60 + 45) {
    candidate = Math.max(0, 23 * 60 + 45 - durationMin);
  }
  return {
    start: formatMinutesHHMM(candidate),
    end: formatMinutesHHMM(candidate + durationMin),
  };
}

export async function renderScheduleView(
  root: HTMLElement,
  app: App,
  plugin: LifeOSPlugin,
  host: SchedulePlannerHost
): Promise<void> {
  const shell = root.createDiv({ cls: "life-os-card life-os-sched-shell" });

  // Sub-header bar: Sub-mode switcher + period nav + options
  const header = shell.createDiv({ cls: "life-os-sched-header" });
  const switcher = header.createDiv({ cls: "life-os-segmented" });
  const modes: Array<{ id: ScheduleSubMode; label: string }> = [
    { id: "day", label: "Day timeline" },
    { id: "week", label: "Week grid" },
    { id: "month", label: "Month calendar" },
  ];
  for (const m of modes) {
    const btn = switcher.createEl("button", {
      text: m.label,
      cls: `life-os-seg-btn ${host.scheduleSubMode === m.id ? "is-active" : ""}`,
    });
    btn.addEventListener("click", () => host.onChangeSubMode(m.id));
  }

  const navGroup = header.createDiv({ cls: "life-os-sched-nav" });
  const prevBtn = navGroup.createEl("button", { text: "◀", cls: "life-os-btn-subtle" });
  prevBtn.setAttr("aria-label", "Previous period");
  prevBtn.addEventListener("click", () => {
    if (host.scheduleSubMode === "day") host.onShiftDate(-1);
    else if (host.scheduleSubMode === "week") host.onShiftDate(-7);
    else host.onShiftMonth(-1);
  });

  const anchor = parseAnyDateKey(host.selectedDateKey) ?? new Date();
  let periodLabel = host.selectedDateKey;
  if (host.scheduleSubMode === "day") {
    periodLabel = `${host.selectedDateKey} (${anchor.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })})`;
  } else if (host.scheduleSubMode === "week") {
    const days = getWeekDates(anchor);
    const first = days[0]!;
    const last = days[6]!;
    periodLabel = `${first.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  } else {
    periodLabel = new Date(host.calendarYear, host.calendarMonth, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
  navGroup.createDiv({ text: periodLabel, cls: "life-os-sched-period" });

  const nextBtn = navGroup.createEl("button", { text: "▶", cls: "life-os-btn-subtle" });
  nextBtn.setAttr("aria-label", "Next period");
  nextBtn.addEventListener("click", () => {
    if (host.scheduleSubMode === "day") host.onShiftDate(1);
    else if (host.scheduleSubMode === "week") host.onShiftDate(7);
    else host.onShiftMonth(1);
  });

  const rightGroup = header.createDiv({ cls: "life-os-sched-nav" });
  if (host.scheduleSubMode === "day") {
    const rangeBtn = rightGroup.createEl("button", {
      text: host.fullDayHours ? "24h (00–24)" : "05:00–23:00",
      cls: "life-os-btn-subtle",
    });
    rangeBtn.addEventListener("click", () => host.onToggleFullDayHours());
  }

  if (host.scheduleSubMode === "day") {
    await renderDayTimeline(shell, host);
  } else if (host.scheduleSubMode === "week") {
    await renderWeekGrid(shell, host);
  } else {
    await renderMonthCalendar(shell, app, plugin, host);
  }
}

async function renderDayTimeline(shell: HTMLElement, host: SchedulePlannerHost): Promise<void> {
  const note = await host.loadNoteForDate(host.selectedDateKey);
  const startHour = host.fullDayHours ? 0 : 5;
  const endHour = host.fullDayHours ? 24 : 23;
  const totalMinutes = (endHour - startHour) * 60;
  const totalHeightPx = (endHour - startHour) * HOUR_HEIGHT_PX;
  const minPerPx = 60 / HOUR_HEIGHT_PX;

  // Quick add bar (also prefilled when clicking an empty slot)
  const addBar = shell.createDiv({ cls: "life-os-tl-quickbar" });
  const startIn = addBar.createEl("input", { type: "time", cls: "life-os-time-input" });
  const nextSlot = findNextOpenSlot(note, 60);
  startIn.value = nextSlot.start;
  const endIn = addBar.createEl("input", { type: "time", cls: "life-os-time-input" });
  endIn.value = nextSlot.end;
  const titleIn = addBar.createEl("input", {
    type: "text",
    placeholder: "Add timeblock or click any hour slot below...",
    cls: "life-os-input-flex",
  });
  const addBtn = addBar.createEl("button", { text: "+ Add block", cls: "life-os-btn-primary" });

  const submitQuickBlock = () => {
    const title = titleIn.value.trim();
    if (!title || !startIn.value || !endIn.value) return;
    note.timeline.push({
      id: makeBlockId(),
      startTime: startIn.value,
      endTime: endIn.value,
      title,
      done: false,
    });
    titleIn.value = "";
    void host.saveNoteForDate(host.selectedDateKey, note).then(() => host.onRequestRefresh());
  };
  addBtn.addEventListener("click", submitQuickBlock);
  titleIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitQuickBlock();
  });

  const body = shell.createDiv({ cls: "life-os-tl-layout" });

  // Left: Unscheduled Tasks drawer
  const sidebar = body.createDiv({ cls: "life-os-tl-sidebar" });
  const sideHead = sidebar.createDiv({ cls: "life-os-tl-side-head" });
  sideHead.createSpan({ text: "Unscheduled tasks", cls: "life-os-pane-title" });

  const scheduledTitles = new Set(note.timeline.map((b) => b.title.trim().toLowerCase()));
  const unscheduled = note.tasks.filter(
    (t) => !t.done && !scheduledTitles.has(t.title.trim().toLowerCase())
  );
  sideHead.createSpan({ text: String(unscheduled.length), cls: "life-os-pill-badge is-muted" });

  const sideList = sidebar.createDiv({ cls: "life-os-tl-side-list" });
  if (unscheduled.length === 0) {
    sideList.createDiv({
      text: "All open tasks for this day are scheduled (or add new tasks in Cockpit).",
      cls: "life-os-empty-state",
    });
  } else {
    for (const task of unscheduled) {
      const card = sideList.createDiv({
        cls: "life-os-tl-task-chip",
        attr: { draggable: "true" },
      });
      const grip = card.createSpan({ cls: "life-os-tl-grip" });
      setIcon(grip, "grip-vertical");
      card.createSpan({ text: task.title, cls: "life-os-tl-task-title" });

      const schedBtn = card.createEl("button", {
        text: "+1h",
        cls: "life-os-btn-subtle life-os-tl-sched-btn",
        attr: { title: "Schedule in next open 1-hour slot" },
      });
      schedBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const slot = findNextOpenSlot(note, 60);
        note.timeline.push({
          id: makeBlockId(),
          startTime: slot.start,
          endTime: slot.end,
          title: task.title,
          done: false,
        });
        void host.saveNoteForDate(host.selectedDateKey, note).then(() => {
          new Notice(`Scheduled "${task.title}" at ${slot.start}`);
          host.onRequestRefresh();
        });
      });

      card.addEventListener("dragstart", (ev) => {
        if (!ev.dataTransfer) return;
        ev.dataTransfer.setData("application/x-lifeos-task", task.title);
        ev.dataTransfer.effectAllowed = "copy";
      });
    }
  }

  // Summary strip inside sidebar
  const totalScheduledMin = note.timeline.reduce((sum, b) => {
    const s = parseTimeMinutes(b.startTime);
    const e = Math.max(s + 15, parseTimeMinutes(b.endTime));
    return sum + (e - s);
  }, 0);
  const doneBlocks = note.timeline.filter((b) => b.done).length;
  const statsBox = sidebar.createDiv({ cls: "life-os-tl-side-foot" });
  statsBox.setText(
    `${note.timeline.length} block(s) · ${formatDurationLabel(totalScheduledMin)} planned · ${doneBlocks} done`
  );

  // Right: Hourly Grid Canvas
  const canvasWrap = body.createDiv({ cls: "life-os-tl-canvas-wrap" });
  const grid = canvasWrap.createDiv({ cls: "life-os-tl-grid" });
  grid.setCssProps({ height: `${totalHeightPx}px` });

  const axisCol = grid.createDiv({ cls: "life-os-tl-axis" });
  const trackCol = grid.createDiv({ cls: "life-os-tl-track" });

  for (let h = startHour; h < endHour; h++) {
    const topPx = (h - startHour) * HOUR_HEIGHT_PX;
    const label = axisCol.createDiv({
      text: `${String(h).padStart(2, "0")}:00`,
      cls: "life-os-tl-hour-label",
    });
    label.setCssProps({ top: `${topPx}px` });

    const line = trackCol.createDiv({ cls: "life-os-tl-hour-line" });
    line.setCssProps({ top: `${topPx}px`, height: `${HOUR_HEIGHT_PX}px` });

    // Half-hour hairline
    const half = trackCol.createDiv({ cls: "life-os-tl-half-line" });
    half.setCssProps({ top: `${topPx + HOUR_HEIGHT_PX / 2}px` });
  }

  // Prayer markers (adhan-js)
  for (const p of note.prayers) {
    const pMin = parseTimeMinutes(p.time);
    const relMin = pMin - startHour * 60;
    if (relMin < 0 || relMin > totalMinutes) continue;
    const marker = trackCol.createDiv({
      cls: `life-os-tl-prayer-line ${p.done ? "is-done" : ""}`,
    });
    marker.setCssProps({ top: `${(relMin / 60) * HOUR_HEIGHT_PX}px` });
    marker.createSpan({
      text: `${p.name} · ${p.time}`,
      cls: "life-os-tl-prayer-pill",
    });
  }

  // Live current-time indicator if viewing today
  if (host.selectedDateKey === todayDMY()) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const rel = nowMin - startHour * 60;
    if (rel >= 0 && rel <= totalMinutes) {
      const nowLine = trackCol.createDiv({ cls: "life-os-tl-now-line" });
      nowLine.setCssProps({ top: `${(rel / 60) * HOUR_HEIGHT_PX}px` });
      nowLine.createSpan({ cls: "life-os-tl-now-dot" });
    }
  }

  // Click empty track to prefill start/end and focus input
  trackCol.addEventListener("click", (ev) => {
    if (ev.target !== trackCol && !(ev.target as HTMLElement).classList.contains("life-os-tl-hour-line")) {
      return;
    }
    const rect = trackCol.getBoundingClientRect();
    const offsetY = Math.max(0, ev.clientY - rect.top);
    const clickedMin = snapMinutes(startHour * 60 + offsetY * minPerPx, 15);
    const clampedStart = Math.max(startHour * 60, Math.min(endHour * 60 - 15, clickedMin));
    const clampedEnd = Math.min(23 * 60 + 45, clampedStart + 60);
    startIn.value = formatMinutesHHMM(clampedStart);
    endIn.value = formatMinutesHHMM(clampedEnd);
    titleIn.focus();
  });

  // Drop unscheduled task onto timeline track
  trackCol.addEventListener("dragover", (ev) => {
    if (ev.dataTransfer?.types.includes("application/x-lifeos-task")) {
      ev.preventDefault();
      trackCol.addClass("is-drop-target");
    }
  });
  trackCol.addEventListener("dragleave", () => {
    trackCol.removeClass("is-drop-target");
  });
  trackCol.addEventListener("drop", (ev) => {
    trackCol.removeClass("is-drop-target");
    const taskTitle = ev.dataTransfer?.getData("application/x-lifeos-task");
    if (!taskTitle) return;
    ev.preventDefault();
    const rect = trackCol.getBoundingClientRect();
    const offsetY = Math.max(0, ev.clientY - rect.top);
    const dropMin = snapMinutes(startHour * 60 + offsetY * minPerPx, 15);
    const s = Math.max(startHour * 60, Math.min(endHour * 60 - 30, dropMin));
    const e = Math.min(23 * 60 + 45, s + 60);
    note.timeline.push({
      id: makeBlockId(),
      startTime: formatMinutesHHMM(s),
      endTime: formatMinutesHHMM(e),
      title: taskTitle,
      done: false,
    });
    void host.saveNoteForDate(host.selectedDateKey, note).then(() => host.onRequestRefresh());
  });

  // Render positioned timeblocks with side-by-side overlap layout + pointer drag/resize
  const positioned = computeOverlapLayout(note.timeline);
  for (const pos of positioned) {
    const clampedStart = Math.max(startHour * 60, pos.startMin);
    const clampedEnd = Math.min(endHour * 60, Math.max(clampedStart + 15, pos.endMin));
    if (clampedEnd <= startHour * 60 || clampedStart >= endHour * 60) continue;

    const topPx = ((clampedStart - startHour * 60) / 60) * HOUR_HEIGHT_PX;
    const heightPx = Math.max(24, ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT_PX - 2);
    const widthPct = 100 / pos.totalCols;
    const leftPct = pos.col * widthPct;

    const el = trackCol.createDiv({
      cls: `life-os-tl-block is-tone-${pos.tone}${pos.block.done ? " is-done" : ""}`,
    });
    el.setCssProps({
      top: `${topPx}px`,
      height: `${heightPx}px`,
      left: `calc(${leftPct}% + 3px)`,
      width: `calc(${widthPct}% - 6px)`,
    });

    const rowTop = el.createDiv({ cls: "life-os-tl-block-head" });
    const cb = rowTop.createEl("input", { type: "checkbox", cls: "life-os-tl-cb" });
    cb.checked = pos.block.done;
    cb.addEventListener("pointerdown", (e) => e.stopPropagation());
    cb.addEventListener("change", () => {
      pos.block.done = cb.checked;
      void host.saveNoteForDate(host.selectedDateKey, note).then(() => host.onRequestRefresh());
    });

    const timeLabel = rowTop.createSpan({
      text: `${pos.block.startTime}–${pos.block.endTime}`,
      cls: "life-os-tl-block-time",
    });
    rowTop.createSpan({
      text: formatDurationLabel(pos.durationMin),
      cls: "life-os-tl-dur-badge",
    });

    const delBtn = rowTop.createEl("button", {
      text: "×",
      cls: "life-os-btn-del life-os-tl-del",
      attr: { "aria-label": "Delete timeblock" },
    });
    delBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      note.timeline = note.timeline.filter((b) => b !== pos.block);
      void host.saveNoteForDate(host.selectedDateKey, note).then(() => host.onRequestRefresh());
    });

    const titleEl = el.createDiv({ text: pos.block.title, cls: "life-os-tl-block-title" });
    titleEl.addEventListener("dblclick", (ev) => {
      ev.stopPropagation();
      const input = el.createEl("input", { type: "text", cls: "life-os-tl-inline-edit" });
      input.value = pos.block.title;
      titleEl.replaceWith(input);
      input.focus();
      input.select();
      const commit = () => {
        const next = input.value.trim();
        if (next && next !== pos.block.title) {
          pos.block.title = next;
          void host.saveNoteForDate(host.selectedDateKey, note).then(() => host.onRequestRefresh());
        } else {
          host.onRequestRefresh();
        }
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (k) => {
        if (k.key === "Enter") commit();
        if (k.key === "Escape") host.onRequestRefresh();
      });
    });

    // Pointer-drag move (vertical 15-min snap)
    el.addEventListener("pointerdown", (downEv) => {
      if (downEv.button !== 0) return;
      if ((downEv.target as HTMLElement).closest("input, button, .life-os-tl-resize")) return;
      downEv.preventDefault();
      el.setPointerCapture(downEv.pointerId);
      const originY = downEv.clientY;
      const duration = pos.endMin - pos.startMin;
      let nextStart = pos.startMin;
      el.addClass("is-dragging");

      const onMove = (moveEv: PointerEvent) => {
        const deltaMin = snapMinutes((moveEv.clientY - originY) * minPerPx, 15);
        nextStart = Math.max(
          startHour * 60,
          Math.min(endHour * 60 - duration, pos.startMin + deltaMin)
        );
        const previewTop = ((nextStart - startHour * 60) / 60) * HOUR_HEIGHT_PX;
        el.setCssProps({ top: `${previewTop}px` });
        timeLabel.setText(`${formatMinutesHHMM(nextStart)}–${formatMinutesHHMM(nextStart + duration)}`);
      };

      const onUp = () => {
        el.removeClass("is-dragging");
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        if (nextStart !== pos.startMin) {
          pos.block.startTime = formatMinutesHHMM(nextStart);
          pos.block.endTime = formatMinutesHHMM(nextStart + duration);
          void host.saveNoteForDate(host.selectedDateKey, note).then(() => host.onRequestRefresh());
        }
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    });

    // Bottom resize handle
    const resizeHandle = el.createDiv({ cls: "life-os-tl-resize" });
    resizeHandle.addEventListener("pointerdown", (downEv) => {
      if (downEv.button !== 0) return;
      downEv.stopPropagation();
      downEv.preventDefault();
      resizeHandle.setPointerCapture(downEv.pointerId);
      const originY = downEv.clientY;
      let nextEnd = pos.endMin;
      el.addClass("is-dragging");

      const onMove = (moveEv: PointerEvent) => {
        const deltaMin = snapMinutes((moveEv.clientY - originY) * minPerPx, 15);
        nextEnd = Math.max(pos.startMin + 15, Math.min(endHour * 60, pos.endMin + deltaMin));
        const nextH = Math.max(24, ((nextEnd - pos.startMin) / 60) * HOUR_HEIGHT_PX - 2);
        el.setCssProps({ height: `${nextH}px` });
        timeLabel.setText(`${pos.block.startTime}–${formatMinutesHHMM(nextEnd)}`);
      };

      const onUp = () => {
        el.removeClass("is-dragging");
        resizeHandle.removeEventListener("pointermove", onMove);
        resizeHandle.removeEventListener("pointerup", onUp);
        if (nextEnd !== pos.endMin) {
          pos.block.endTime = formatMinutesHHMM(nextEnd);
          void host.saveNoteForDate(host.selectedDateKey, note).then(() => host.onRequestRefresh());
        }
      };
      resizeHandle.addEventListener("pointermove", onMove);
      resizeHandle.addEventListener("pointerup", onUp);
    });
  }
}

async function renderWeekGrid(shell: HTMLElement, host: SchedulePlannerHost): Promise<void> {
  const anchor = parseAnyDateKey(host.selectedDateKey) ?? new Date();
  const weekDays = getWeekDates(anchor);
  const notes = await Promise.all(weekDays.map((d) => host.loadNoteForDate(d.dateKey)));

  const hint = shell.createDiv({
    text: "Drag & drop tasks or timeblocks between days to reschedule. Click any day header to open its Day Timeline.",
    cls: "life-os-muted-text life-os-week-hint",
  });
  void hint;

  const grid = shell.createDiv({ cls: "life-os-week-grid" });

  weekDays.forEach((day, idx) => {
    const dayNote = notes[idx]!;
    const col = grid.createDiv({
      cls: `life-os-week-col${day.isToday ? " is-today" : ""}${day.dateKey === host.selectedDateKey ? " is-selected" : ""}`,
    });

    const head = col.createDiv({ cls: "life-os-week-col-head" });
    const titleBtn = head.createEl("button", {
      text: `${day.weekdayShort} ${day.dayNum}`,
      cls: "life-os-week-day-btn",
    });
    titleBtn.addEventListener("click", () => {
      host.onSelectDate(day.dateKey);
      host.onChangeSubMode("day");
    });

    const prayersDone = dayNote.prayers.filter((p) => p.done).length;
    const tasksDone = dayNote.tasks.filter((t) => t.done).length;
    head.createSpan({
      text: `${prayersDone}/5 · ${tasksDone}/${dayNote.tasks.length}`,
      cls: "life-os-week-stat",
    });

    // Quick inline add inside day column
    const quickForm = col.createDiv({ cls: "life-os-week-quick" });
    const quickInput = quickForm.createEl("input", {
      type: "text",
      placeholder: "+ Block (e.g. Study)",
      cls: "life-os-week-input",
    });
    quickInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const val = quickInput.value.trim();
      if (!val) return;
      const slot = findNextOpenSlot(dayNote, 60);
      dayNote.timeline.push({
        id: makeBlockId(),
        startTime: slot.start,
        endTime: slot.end,
        title: val,
        done: false,
      });
      quickInput.value = "";
      void host.saveNoteForDate(day.dateKey, dayNote).then(() => host.onRequestRefresh());
    });

    const cardsWrap = col.createDiv({ cls: "life-os-week-cards" });

    // Timeblocks first (chronological)
    const sortedBlocks = dayNote.timeline
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const blk of sortedBlocks) {
      const card = cardsWrap.createDiv({
        cls: `life-os-week-card is-block${blk.done ? " is-done" : ""}`,
        attr: { draggable: "true" },
      });
      const cb = card.createEl("input", { type: "checkbox" });
      cb.checked = blk.done;
      cb.addEventListener("change", () => {
        blk.done = cb.checked;
        void host.saveNoteForDate(day.dateKey, dayNote).then(() => host.onRequestRefresh());
      });
      const body = card.createDiv({ cls: "life-os-week-card-body" });
      body.createDiv({ text: `${blk.startTime}–${blk.endTime}`, cls: "life-os-week-time" });
      body.createDiv({ text: blk.title, cls: "life-os-week-card-title" });

      card.addEventListener("dragstart", (ev) => {
        if (!ev.dataTransfer) return;
        const payload: WeekDragPayload = {
          kind: "block",
          sourceDateKey: day.dateKey,
          itemId: blk.id,
        };
        ev.dataTransfer.setData("application/x-lifeos-week", JSON.stringify(payload));
        ev.dataTransfer.effectAllowed = "move";
      });
    }

    // Tasks next
    for (const task of dayNote.tasks) {
      const card = cardsWrap.createDiv({
        cls: `life-os-week-card is-task${task.done ? " is-done" : ""}`,
        attr: { draggable: "true" },
      });
      const cb = card.createEl("input", { type: "checkbox" });
      cb.checked = task.done;
      cb.addEventListener("change", () => {
        task.done = cb.checked;
        task.doneDateIso = task.done ? toISOKey(todayDMY()) ?? undefined : undefined;
        void host.saveNoteForDate(day.dateKey, dayNote).then(() => host.onRequestRefresh());
      });
      const body = card.createDiv({ cls: "life-os-week-card-body" });
      const prio =
        task.priority === "high" ? "⏫ " : task.priority === "medium" ? "🔼 " : task.priority === "low" ? "🔽 " : "";
      body.createDiv({ text: `${prio}${task.title}`, cls: "life-os-week-card-title" });

      card.addEventListener("dragstart", (ev) => {
        if (!ev.dataTransfer) return;
        const payload: WeekDragPayload = {
          kind: "task",
          sourceDateKey: day.dateKey,
          itemId: task.id,
        };
        ev.dataTransfer.setData("application/x-lifeos-week", JSON.stringify(payload));
        ev.dataTransfer.effectAllowed = "move";
      });
    }

    if (sortedBlocks.length === 0 && dayNote.tasks.length === 0) {
      cardsWrap.createDiv({ text: "Drop item here", cls: "life-os-week-empty" });
    }

    // Drop handler for moving items across days
    col.addEventListener("dragover", (ev) => {
      if (ev.dataTransfer?.types.includes("application/x-lifeos-week")) {
        ev.preventDefault();
        col.addClass("is-drop-target");
      }
    });
    col.addEventListener("dragleave", () => {
      col.removeClass("is-drop-target");
    });
    col.addEventListener("drop", (ev) => {
      col.removeClass("is-drop-target");
      const raw = ev.dataTransfer?.getData("application/x-lifeos-week");
      if (!raw) return;
      ev.preventDefault();
      let payload: WeekDragPayload;
      try {
        payload = JSON.parse(raw) as WeekDragPayload;
      } catch {
        return;
      }
      if (payload.sourceDateKey === day.dateKey) return;

      void (async () => {
        const srcIdx = weekDays.findIndex((w) => w.dateKey === payload.sourceDateKey);
        const srcNote = srcIdx >= 0 ? notes[srcIdx]! : await host.loadNoteForDate(payload.sourceDateKey);

        if (payload.kind === "block") {
          const idxB = srcNote.timeline.findIndex((b) => b.id === payload.itemId);
          if (idxB === -1) return;
          const [moved] = srcNote.timeline.splice(idxB, 1);
          if (!moved) return;
          dayNote.timeline.push({ ...moved, id: makeBlockId() });
          await host.saveNoteForDate(payload.sourceDateKey, srcNote);
          await host.saveNoteForDate(day.dateKey, dayNote);
          new Notice(`Moved "${moved.title}" to ${day.dateKey}`);
        } else {
          const idxT = srcNote.tasks.findIndex((t) => t.id === payload.itemId);
          if (idxT === -1) return;
          const [moved] = srcNote.tasks.splice(idxT, 1);
          if (!moved) return;
          const nextTask: TaskItem = {
            ...moved,
            id: makeBlockId("task"),
            dueDateIso: day.isoDate,
          };
          dayNote.tasks.push(nextTask);
          await host.saveNoteForDate(payload.sourceDateKey, srcNote);
          await host.saveNoteForDate(day.dateKey, dayNote);
          new Notice(`Rescheduled "${moved.title}" to ${day.dateKey}`);
        }
        host.onRequestRefresh();
      })();
    });
  });
}

async function renderMonthCalendar(
  shell: HTMLElement,
  app: App,
  plugin: LifeOSPlugin,
  host: SchedulePlannerHost
): Promise<void> {
  const summaries = await collectMonthSummaries(
    app,
    plugin.settings,
    host.calendarYear,
    host.calendarMonth
  );

  const grid = shell.createDiv({ cls: "life-os-cal-grid" });
  for (const dow of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
    grid.createDiv({ text: dow, cls: "life-os-cal-dow" });
  }

  const firstWeekday = new Date(host.calendarYear, host.calendarMonth, 1).getDay();
  for (let i = 0; i < firstWeekday; i++) {
    grid.createDiv({ cls: "life-os-cal-empty" });
  }

  const daysInMonth = new Date(host.calendarYear, host.calendarMonth + 1, 0).getDate();
  const today = todayDMY();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateDMY(new Date(host.calendarYear, host.calendarMonth, day));
    const stat = summaries.get(dateKey);
    const cell = grid.createEl("button", {
      cls: `life-os-cal-day ${dateKey === today ? "is-today" : ""} ${
        dateKey === host.selectedDateKey ? "is-selected" : ""
      }`,
    });

    const topRow = cell.createDiv({ cls: "life-os-cal-top" });
    topRow.createSpan({ text: String(day), cls: "life-os-cal-num" });
    if (stat?.exists && stat.timelineCount > 0) {
      topRow.createSpan({ text: `${stat.timelineCount}b`, cls: "life-os-cal-badge" });
    }

    if (stat?.exists && stat.tasksTotal > 0) {
      cell.createDiv({
        text: `✓ ${stat.tasksDone}/${stat.tasksTotal}`,
        cls: "life-os-cal-task-mini",
      });
    }

    const dots = cell.createDiv({ cls: "life-os-cal-dots" });
    if (stat?.exists) {
      if (stat.prayersDone > 0) {
        dots.createSpan({
          cls: `life-os-dot dot-prayer ${stat.prayersDone >= 5 ? "is-full" : ""}`,
          attr: { title: `Prayers: ${stat.prayersDone}/5` },
        });
      }
      if (stat.sleepHours !== null) {
        dots.createSpan({
          cls: "life-os-dot dot-sleep",
          attr: { title: `Sleep: ${stat.sleepHours}h` },
        });
      }
      if (stat.waterLiters > 0) {
        dots.createSpan({
          cls: "life-os-dot dot-water",
          attr: { title: `Water: ${stat.waterLiters}L` },
        });
      }
      if (stat.hasJournal) {
        dots.createSpan({
          cls: "life-os-dot dot-journal",
          attr: { title: "Journal logged" },
        });
      }
    }

    cell.addEventListener("click", () => {
      host.onOpenCockpitForDate(dateKey);
    });
  }

  const legend = shell.createDiv({ cls: "life-os-cal-legend" });
  legend.createSpan({ text: "● Prayers", cls: "legend-prayer" });
  legend.createSpan({ text: "● Sleep", cls: "legend-sleep" });
  legend.createSpan({ text: "● Water", cls: "legend-water" });
  legend.createSpan({ text: "● Journal", cls: "legend-journal" });
  legend.createSpan({ text: "· Nb = timeblocks" });
}
