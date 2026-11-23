import type { TimelineBlock } from "../types";
import { formatDateDMY, toISOKey, todayDMY } from "./date-format";

export type BlockTone = "focus" | "health" | "meeting" | "rest" | "default";

export interface PositionedTimelineBlock {
  block: TimelineBlock;
  startMin: number;
  endMin: number;
  durationMin: number;
  col: number;
  totalCols: number;
  tone: BlockTone;
}

export interface WeekDayInfo {
  date: Date;
  dateKey: string; // DD-MM-YYYY
  isoDate: string; // YYYY-MM-DD
  weekdayShort: string;
  dayNum: number;
  isToday: boolean;
}

export function parseTimeMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const min = Math.max(0, Math.min(59, Number(m[2])));
  return h * 60 + min;
}

export function formatMinutesHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function snapMinutes(totalMinutes: number, step = 15): number {
  return Math.round(totalMinutes / step) * step;
}

export function formatDurationLabel(durationMin: number): string {
  const mins = Math.max(15, Math.round(durationMin));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function detectBlockTone(title: string): BlockTone {
  const lower = title.toLowerCase();
  if (/\b(deep|study|code|build|write|read|research|lecture|lab|exam|math|review)\b/.test(lower)) {
    return "focus";
  }
  if (/\b(gym|run|walk|workout|exercise|swim|sport|stretch|yoga)\b/.test(lower)) {
    return "health";
  }
  if (/\b(call|meet|meeting|sync|interview|class|standup|zoom)\b/.test(lower)) {
    return "meeting";
  }
  if (/\b(break|rest|nap|lunch|dinner|breakfast|coffee|chill|quran)\b/.test(lower)) {
    return "rest";
  }
  return "default";
}

/**
 * Connected-cluster interval packing for concurrent timeline blocks so overlapping
 * blocks render side-by-side cleanly instead of covering one another.
 */
export function computeOverlapLayout(blocks: TimelineBlock[]): PositionedTimelineBlock[] {
  if (blocks.length === 0) return [];

  const normalized = blocks
    .map((block) => {
      const startMin = parseTimeMinutes(block.startTime);
      const rawEnd = parseTimeMinutes(block.endTime);
      const endMin = rawEnd > startMin ? rawEnd : Math.min(24 * 60, startMin + 30);
      return {
        block,
        startMin,
        endMin,
        durationMin: Math.max(15, endMin - startMin),
        tone: detectBlockTone(block.title),
      };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const result: PositionedTimelineBlock[] = [];
  let cluster: typeof normalized = [];
  let clusterEnd = -1;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const colEndTimes: number[] = [];
    const placed: Array<{ item: (typeof normalized)[number]; col: number }> = [];

    for (const item of cluster) {
      let assignedCol = -1;
      for (let c = 0; c < colEndTimes.length; c++) {
        if (colEndTimes[c]! <= item.startMin) {
          assignedCol = c;
          colEndTimes[c] = item.endMin;
          break;
        }
      }
      if (assignedCol === -1) {
        assignedCol = colEndTimes.length;
        colEndTimes.push(item.endMin);
      }
      placed.push({ item, col: assignedCol });
    }

    const totalCols = Math.max(1, colEndTimes.length);
    for (const { item, col } of placed) {
      result.push({
        block: item.block,
        startMin: item.startMin,
        endMin: item.endMin,
        durationMin: item.durationMin,
        col,
        totalCols,
        tone: item.tone,
      });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of normalized) {
    if (cluster.length === 0 || item.startMin < clusterEnd) {
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      flushCluster();
      cluster.push(item);
      clusterEnd = item.endMin;
    }
  }
  flushCluster();

  return result;
}

export function getWeekDates(anchorDate: Date): WeekDayInfo[] {
  const sunday = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  sunday.setDate(sunday.getDate() - sunday.getDay());
  const todayKey = todayDMY();
  const days: WeekDayInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    const dateKey = formatDateDMY(d);
    days.push({
      date: d,
      dateKey,
      isoDate: toISOKey(dateKey) ?? dateKey,
      weekdayShort: d.toLocaleDateString(undefined, { weekday: "short" }),
      dayNum: d.getDate(),
      isToday: dateKey === todayKey,
    });
  }
  return days;
}
