import { DailyRecord, LifeOSSettings, PlanningConflict, TimelineEntry } from './types';
import { priorityWeight } from './goals';
import { generatedEntries, getConflicts, timeToMinutes, minutesToTime, overlapMinutes, mergedTimeline } from './planning';

export interface FreeWindow { start: string; end: string; minutes: number; }
export interface UnscheduledItem { id: string; title: string; type: TimelineEntry['type']; durationMin: number; source: 'task' | 'study'; sourceIndex: number; optional: boolean; subject?: string; topic?: string; }
export interface ScheduleSuggestion { date: string; start: string; end: string; score: number; reason: string; }

export function allEntriesForDate(settings: LifeOSSettings, record: DailyRecord, date: string): TimelineEntry[] {
  return mergedTimeline(record, generatedEntries(settings, date));
}

export function freeWindows(entries: TimelineEntry[], minMinutes = 30, dayStart = 0, dayEnd = 1440): FreeWindow[] {
  const sorted = entries
    .map((entry) => ({ start: timeToMinutes(entry.start), end: timeToMinutes(entry.end) }))
    .filter((entry) => entry.end > entry.start)
    .sort((a, b) => a.start - b.start);
  const windows: FreeWindow[] = [];
  let cursor = dayStart;
  for (const item of sorted) {
    if (item.start > cursor) {
      const gap = item.start - cursor;
      if (gap >= minMinutes) windows.push({ start: minutesToTime(cursor), end: minutesToTime(item.start), minutes: gap });
    }
    cursor = Math.max(cursor, item.end);
  }
  if (dayEnd > cursor && dayEnd - cursor >= minMinutes) windows.push({ start: minutesToTime(cursor), end: minutesToTime(dayEnd), minutes: dayEnd - cursor });
  return windows;
}

export function findConflict(entries: TimelineEntry[], candidate: TimelineEntry): PlanningConflict | undefined {
  const conflicts = getConflicts([...entries.filter((entry) => entry.id !== candidate.id), candidate]).filter((conflict) =>
    conflict.incoming.id === candidate.id || conflict.existing.id === candidate.id
  );
  return conflicts[0];
}

export function suggestSlots(entries: TimelineEntry[], durationMin: number, preferredStart = 480, minGap = 15, limit = 5): ScheduleSuggestion[] {
  const windows = freeWindows(entries, durationMin + minGap);
  return windows.flatMap((window) => {
    const start = timeToMinutes(window.start);
    const end = timeToMinutes(window.end);
    const candidates: number[] = [];
    const preferred = Math.max(start, Math.min(end - durationMin, Math.round(preferredStart / 15) * 15));
    candidates.push(preferred);
    if (preferred !== start) candidates.push(start);
    if (preferred !== end - durationMin) candidates.push(end - durationMin);
    return [...new Set(candidates)].map((candidate) => ({
      date: '',
      start: minutesToTime(candidate),
      end: minutesToTime(candidate + durationMin),
      score: 100 - Math.abs(candidate - preferredStart) / 10,
      reason: `${window.minutes}-minute free window`
    }));
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getUnscheduledItems(record: DailyRecord): UnscheduledItem[] {
  const result: UnscheduledItem[] = [];
  record.tasksPlanned.forEach((task, index) => {
    const completed = record.tasksCompleted.includes(task);
    const alreadyPlaced = record.timeline.some((entry) => entry.type === 'task' && entry.title === task);
    if (!completed && !alreadyPlaced) result.push({ id: `task:${index}`, title: task, type: 'task', durationMin: 30, source: 'task', sourceIndex: index, optional: record.optionalTasks.includes(task) });
  });
  record.studyPlan.forEach((item, index) => {
    const alreadyPlaced = record.timeline.some((entry) => entry.type === 'study' && entry.title === `${item.subject} · ${item.topic}`);
    if (!item.completed && !alreadyPlaced) result.push({ id: `study:${item.id || index}`, title: `${item.subject} · ${item.topic}`, type: 'study', durationMin: Math.max(15, item.targetMinutes), source: 'study', sourceIndex: index, optional: item.optional, subject: item.subject, topic: item.topic });
  });
  return result;
}

export function reflowSuggestions(entries: TimelineEntry[], durationMin: number, preferredStart: number): ScheduleSuggestion[] {
  return suggestSlots(entries, durationMin, preferredStart, 15, 8);
}

export function candidateScore(entries: TimelineEntry[], start: number, end: number, preferredStart: number, nearDayEdgesPenalty = true): number {
  const candidate: TimelineEntry = { id: '__candidate__', title: 'Candidate', start: minutesToTime(start), end: minutesToTime(end), type: 'other', planned: true, actual: false };
  if (findConflict(entries, candidate)) return -Infinity;
  let score = 100 - Math.abs(start - preferredStart) / 6;
  if (nearDayEdgesPenalty && (start < 360 || end > 1320)) score -= 8;
  return score;
}

export function adaptiveSuggestions(entries: TimelineEntry[], durationMin: number, preferredStart = 480): ScheduleSuggestion[] {
  const suggestions: ScheduleSuggestion[] = [];
  for (let start = 0; start + durationMin <= 1440; start += 15) {
    const score = candidateScore(entries, start, start + durationMin, preferredStart);
    if (score > -Infinity) suggestions.push({ date: '', start: minutesToTime(start), end: minutesToTime(start + durationMin), score, reason: 'No conflict; balanced against preferred time' });
  }
  return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
}

export function conflictMinutes(entries: TimelineEntry[], candidate: TimelineEntry): number {
  return entries.reduce((sum, entry) => sum + overlapMinutes(entry.start, entry.end, candidate.start, candidate.end), 0);
}


export function goalAwareAdaptiveSuggestions(settings: LifeOSSettings, entries: TimelineEntry[], durationMin: number, preferredStart = 480): ScheduleSuggestion[] {
  const goals = settings.goals.filter((goal) => goal.status === 'active');
  const urgency = goals.reduce((sum, goal) => sum + priorityWeight(goal.priority), 0);
  const base = adaptiveSuggestions(entries, durationMin, preferredStart);
  return base.map((item, index) => ({
    ...item,
    score: item.score + (urgency * 1.5) - index * 0.25,
    reason: urgency ? `Conflict-free slot weighted for your active goals (priority ${Math.round(urgency)})` : item.reason
  }));
}
