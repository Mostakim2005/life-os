import { App } from 'obsidian';
import { DailyRecord, LifeOSSettings, LifeOSStats } from './types';
import { listCachedDailyDates, collectRecordsCached } from './performance';

function dateInRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

function pct(numerator: number, denominator: number): number {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

export async function listDailyDates(app: App, settings: LifeOSSettings, from: string, to: string): Promise<string[]> {
  return listCachedDailyDates(app, settings, from, to).filter((date) => dateInRange(date, from, to));
}

export async function collectRecords(app: App, settings: LifeOSSettings, from: string, to: string): Promise<DailyRecord[]> {
  const dates = await listDailyDates(app, settings, from, to);
  return collectRecordsCached(app, settings, dates);
}

export async function calculateStats(app: App, settings: LifeOSSettings, from: string, to: string): Promise<LifeOSStats> {
  const records = await collectRecords(app, settings, from, to);
  let taskPlanned = 0, taskCompleted = 0, optionalTasks = 0;
  let prayerCompleted = 0, prayerLate = 0, prayerMissed = 0, prayerTracked = 0;
  let studyMinutes = 0, studyPlannedMinutes = 0, studySessions = 0, studyCompletedSessions = 0;
  let exerciseSessions = 0, exerciseMinutes = 0, bookedMinutes = 0, actualMinutes = 0;
  let sleepSum = 0, sleepCount = 0, moodSum = 0, energySum = 0;
  const habitBreakdown: LifeOSStats['habitBreakdown'] = {};
  const subjectBreakdown: LifeOSStats['subjectBreakdown'] = {};

  for (const record of records) {
    taskPlanned += record.tasksPlanned.length;
    taskCompleted += record.tasksCompleted.filter((task) => record.tasksPlanned.includes(task)).length;
    optionalTasks += record.optionalTasks.length;

    for (const prayer of record.prayers) {
      if (prayer.status !== 'not-tracked') prayerTracked++;
      if (prayer.status === 'completed') prayerCompleted++;
      if (prayer.status === 'late') prayerLate++;
      if (prayer.status === 'missed') prayerMissed++;
    }

    for (const habit of settings.habits.filter((item) => item.enabled)) {
      const entry = record.habits[habit.id];
      if (!entry) continue;
      const state = habit.type === 'subtasks'
        ? Array.isArray(entry.value) && entry.value.some((value) => Number(value) > 0)
        : habit.type === 'boolean'
          ? Boolean(entry.value)
          : habit.target !== undefined
            ? Number(entry.value) >= habit.target
            : Number(entry.value) > 0;
      const current = habitBreakdown[habit.id] ?? { completedDays: 0, trackedDays: 0, pct: 0 };
      current.trackedDays++;
      if (state) current.completedDays++;
      current.pct = pct(current.completedDays, current.trackedDays);
      habitBreakdown[habit.id] = current;
    }

    studySessions += record.studySessions.length;
    studyCompletedSessions += record.studySessions.filter((session) => session.completed).length;
    studyMinutes += record.studySessions.reduce((sum, session) => sum + session.durationMin, 0);
    studyPlannedMinutes += record.studySessions.reduce((sum, session) => sum + (session.plannedDurationMin ?? 0), 0);
    studyPlannedMinutes += record.studyPlan.reduce((sum, item) => sum + item.targetMinutes, 0);
    for (const session of record.studySessions) {
      const subject = session.subject.trim() || 'Uncategorised';
      const current = subjectBreakdown[subject] ?? { minutes: 0, sessions: 0 };
      current.minutes += session.durationMin;
      current.sessions++;
      subjectBreakdown[subject] = current;
    }

    exerciseSessions += record.exercises.length;
    exerciseMinutes += record.exercises.reduce((sum, exercise) => sum + exercise.durationMin, 0);
    bookedMinutes += record.timeline.reduce((sum, item) => sum + diffMinutes(item.start, item.end), 0);
    actualMinutes += record.timeline.filter((item) => item.actual).reduce((sum, item) => sum + diffMinutes(item.start, item.end), 0);

    if (record.sleepHours > 0) { sleepSum += record.sleepHours; sleepCount++; }
    moodSum += record.mood;
    energySum += record.energy;
  }

  const trackedHabitDays = Object.values(habitBreakdown).reduce((sum, value) => sum + value.trackedDays, 0);
  const completedHabitDays = Object.values(habitBreakdown).reduce((sum, value) => sum + value.completedDays, 0);
  const prayerDenominator = prayerCompleted + prayerLate + prayerMissed;
  const studyTarget = Math.max(studyPlannedMinutes, 0);

  return {
    from,
    to,
    daysWithRecords: records.length,
    taskPlanned,
    taskCompleted,
    taskCompletionPct: pct(taskCompleted, taskPlanned),
    optionalTasks,
    habitCompletionPct: pct(completedHabitDays, trackedHabitDays),
    habitDaysTracked: trackedHabitDays,
    prayerCompleted,
    prayerLate,
    prayerMissed,
    prayerTracked,
    prayerCompletionPct: pct(prayerCompleted, prayerDenominator),
    studyMinutes,
    studyPlannedMinutes: studyTarget,
    studySessions,
    studyCompletedSessions,
    studyPlanCompletionPct: pct(studyCompletedSessions, studySessions),
    exerciseSessions,
    exerciseMinutes,
    bookedMinutes,
    actualMinutes,
    plannedActualPct: pct(actualMinutes, bookedMinutes),
    averageSleepHours: sleepCount ? Number((sleepSum / sleepCount).toFixed(1)) : 0,
    averageMood: records.length ? Number((moodSum / records.length).toFixed(1)) : 0,
    averageEnergy: records.length ? Number((energySum / records.length).toFixed(1)) : 0,
    daysTracked: records.length,
    monthCount: 0,
    yearCount: 0,
    habitBreakdown,
    subjectBreakdown
  };
}

export function lastNDays(n: number, end = new Date()): { from: string; to: string } {
  const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const start = new Date(endLocal);
  start.setDate(start.getDate() - (n - 1));
  return { from: toISO(start), to: toISO(endLocal) };
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}


export async function calculateYearlyStats(app: App, settings: LifeOSSettings, year: number): Promise<LifeOSStats[]> {
  const result: LifeOSStats[] = [];
  for (let month = 0; month < 12; month++) {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const last = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    const stats = await calculateStats(app, settings, from, to);
    stats.monthCount = month + 1;
    stats.yearCount = year;
    result.push(stats);
  }
  return result;
}

export function monthlyTrendPoints(stats: LifeOSStats[], selector: (value: LifeOSStats) => number): { label: string; value: number }[] {
  return stats.map((value) => ({ label: value.from.slice(5, 7), value: selector(value) }));
}
