import { DailyRecord, LifeOSSettings, PlanningConflict, PlanningRule, TimelineEntry } from './types';

export function timeToMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return Math.max(0, Math.min(1440, h * 60 + m));
}

export function minutesToTime(value: number): string {
  const v = Math.max(0, Math.min(1440, Math.round(value / 15) * 15));
  if (v === 1440) return '24:00';
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

export function overlapMinutes(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = Math.max(timeToMinutes(aStart), timeToMinutes(bStart));
  const end = Math.min(timeToMinutes(aEnd), timeToMinutes(bEnd));
  return Math.max(0, end - start);
}

export function dateDiffDays(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function shouldGenerate(rule: PlanningRule, date: string): boolean {
  if (!rule.enabled) return false;
  if (rule.startDate && date < rule.startDate) return false;
  if (rule.endDate && date > rule.endDate) return false;
  if (rule.recurrence === 'once') return date === (rule.anchorDate ?? rule.startDate);
  if (rule.recurrence === 'daily') return true;
  if (rule.recurrence === 'weekly') {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    return (rule.daysOfWeek ?? []).includes(weekday);
  }
  const anchor = rule.anchorDate ?? rule.startDate ?? date;
  const diff = dateDiffDays(anchor, date);
  const interval = Math.max(1, rule.intervalDays ?? 1);
  return diff >= 0 && diff % interval === 0;
}

export function ruleToEntry(rule: PlanningRule, date: string): TimelineEntry {
  return {
    id: `rule:${rule.id}:${date}`,
    title: rule.name,
    start: rule.startTime,
    end: rule.endTime,
    type: rule.kind,
    planned: true,
    actual: false,
    note: rule.subject ? `${rule.subject}${rule.topic ? ` · ${rule.topic}` : ''}` : undefined
  };
}

export function generatedEntries(settings: LifeOSSettings, date: string): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const rule of settings.planningRules) {
    if (!shouldGenerate(rule, date)) continue;
    const base = ruleToEntry(rule, date);
    const override = settings.planningOverrides[overrideKey(rule.id, date)];
    if (override?.suppressed) continue;
    entries.push({
      ...base,
      start: override?.start ?? base.start,
      end: override?.end ?? base.end
    });
  }
  return entries.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

export function getConflicts(entries: TimelineEntry[]): PlanningConflict[] {
  const conflicts: PlanningConflict[] = [];
  const sorted = entries
    .filter((entry) => timeToMinutes(entry.end) > timeToMinutes(entry.start))
    .slice()
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  // Sweep-line comparison: once the next item starts after the current item's
  // end, there cannot be any later overlap with the current item.
  for (let i = 0; i < sorted.length; i++) {
    const incoming = sorted[i];
    if (!incoming) continue;
    const incomingEnd = timeToMinutes(incoming.end);
    for (let j = i + 1; j < sorted.length; j++) {
      const existing = sorted[j];
      if (!existing) continue;
      if (timeToMinutes(existing.start) >= incomingEnd) break;
      const overlap = overlapMinutes(incoming.start, incoming.end, existing.start, existing.end);
      if (!overlap) continue;
      const severity = incoming.planned && existing.planned ? 'warning' : 'error';
      conflicts.push({
        date: '',
        incoming,
        existing,
        overlapMinutes: overlap,
        severity,
        message: `“${incoming.title}” overlaps “${existing.title}” by ${overlap} min.`
      });
    }
  }
  return conflicts;
}

export function mergedTimeline(record: DailyRecord, generated: TimelineEntry[]): TimelineEntry[] {
  const generatedIds = new Set(generated.map((entry) => entry.id));
  const manual = record.timeline.filter((entry) => !entry.id.startsWith('rule:'));
  const persistedGenerated = record.timeline.filter((entry) => entry.id.startsWith('rule:') && generatedIds.has(entry.id));
  const persistedById = new Map(persistedGenerated.map((entry) => [entry.id, entry]));
  const resolvedGenerated = generated.map((entry) => persistedById.get(entry.id) ?? entry);
  return [...manual, ...resolvedGenerated].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

export function findRule(settings: LifeOSSettings, id: string): PlanningRule | undefined {
  return settings.planningRules.find((rule) => rule.id === id);
}

export function overrideKey(ruleId: string, date: string): string { return `${ruleId}:${date}`; }
