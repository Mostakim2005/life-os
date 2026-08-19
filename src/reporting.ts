import { App, TFile } from 'obsidian';
import { calculateStats, collectRecords } from './analytics';
import { LifeOSSettings, DailyRecord, Goal } from './types';
import { getMonthRange, getWeekRange } from './review';
import { buildIntegrationSnapshot } from './integrations';

export type ReportPeriod = 'day' | 'week' | 'month';
export type ReportFormat = 'md' | 'json' | 'csv';

export interface ReportBundle {
  period: ReportPeriod;
  from: string;
  to: string;
  generatedAt: string;
  stats: Awaited<ReturnType<typeof calculateStats>>;
  records: DailyRecord[];
  meals: { food: string; servings: number; proteinG: number; calories?: number }[];
  exercises: { name: string; category: string; minutes: number; sessions: number }[];
  subjects: { subject: string; minutes: number; sessions: number }[];
  prayerReasons: { prayer: string; status: string; reason: string; count: number }[];
  taskDetails: { planned: number; completed: number; optional: number };
  goalSnapshot: Goal[];
  timeByType: Record<string, number>;
  integrations: ReturnType<typeof buildIntegrationSnapshot>;
}

export async function buildReport(app: App, settings: LifeOSSettings, anchorDate: string, period: ReportPeriod): Promise<ReportBundle> {
  let from = anchorDate; let to = anchorDate;
  if (period === 'week') ({ from, to } = getWeekRange(anchorDate));
  if (period === 'month') ({ from, to } = getMonthRange(anchorDate));
  const [stats, records] = await Promise.all([
    calculateStats(app, settings, from, to),
    collectRecords(app, settings, from, to)
  ]);
  const meals = new Map<string, { food: string; servings: number; proteinG: number; calories?: number }>();
  const exercises = new Map<string, { name: string; category: string; minutes: number; sessions: number }>();
  const subjects = new Map<string, { subject: string; minutes: number; sessions: number }>();
  const reasons = new Map<string, { prayer: string; status: string; reason: string; count: number }>();
  const timeByType: Record<string, number> = {};
  let planned = 0, completed = 0, optional = 0;
  for (const record of records) {
    planned += record.tasksPlanned.length;
    completed += record.tasksCompleted.filter((task) => record.tasksPlanned.includes(task)).length;
    optional += record.optionalTasks.length;
    for (const meal of record.meals) {
      const key = meal.food.trim() || 'Unknown';
      const current = meals.get(key) ?? { food: key, servings: 0, proteinG: 0, calories: 0 };
      current.servings += meal.servings ?? 1;
      current.proteinG += meal.estimatedProteinG ?? 0;
      if (meal.estimatedCalories !== undefined) current.calories = (current.calories ?? 0) + meal.estimatedCalories;
      meals.set(key, current);
    }
    for (const exercise of record.exercises) {
      const key = exercise.name;
      const current = exercises.get(key) ?? { name: key, category: exercise.category, minutes: 0, sessions: 0 };
      current.minutes += exercise.durationMin; current.sessions++;
      exercises.set(key, current);
    }
    for (const session of record.studySessions) {
      const key = session.subject.trim() || 'Uncategorised';
      const current = subjects.get(key) ?? { subject: key, minutes: 0, sessions: 0 };
      current.minutes += session.durationMin; current.sessions++;
      subjects.set(key, current);
    }
    for (const prayer of record.prayers) {
      if (!prayer.reason || (prayer.status !== 'late' && prayer.status !== 'missed')) continue;
      const key = `${prayer.name}|${prayer.status}|${prayer.reason}`;
      const current = reasons.get(key) ?? { prayer: prayer.name, status: prayer.status, reason: prayer.reason, count: 0 };
      current.count++; reasons.set(key, current);
    }
    for (const item of record.timeline) timeByType[item.type] = (timeByType[item.type] ?? 0) + diffMinutes(item.start, item.end);
  }
  return {
    period, from, to, generatedAt: new Date().toISOString(), stats, records,
    meals: [...meals.values()].sort((a, b) => b.servings - a.servings),
    exercises: [...exercises.values()].sort((a, b) => b.minutes - a.minutes),
    subjects: [...subjects.values()].sort((a, b) => b.minutes - a.minutes),
    prayerReasons: [...reasons.values()].sort((a, b) => b.count - a.count),
    taskDetails: { planned, completed, optional },
    goalSnapshot: settings.goals.filter((goal) => goal.status !== 'completed'),
    timeByType,
    integrations: buildIntegrationSnapshot(app, settings, records)
  };
}

export function reportToJson(report: ReportBundle): string {
  return JSON.stringify(report, null, 2);
}

export function reportToMarkdown(report: ReportBundle): string {
  const s = report.stats;
  const lines = [
    `# Life OS ${labelPeriod(report.period)} Report`, '',
    `**Period:** ${report.from} → ${report.to}`, `**Generated:** ${report.generatedAt}`, '',
    '## Executive Summary', '',
    `- Tasks: **${s.taskCompleted}/${s.taskPlanned} (${s.taskCompletionPct}%)**`,
    `- Habits: **${s.habitCompletionPct}%**`,
    `- Prayer: **${s.prayerCompletionPct}% tracked-completion**, ${s.prayerLate} late, ${s.prayerMissed} missed`,
    `- Study: **${s.studyMinutes} min** across ${s.studySessions} sessions`,
    `- Exercise: **${s.exerciseMinutes} min** across ${s.exerciseSessions} sessions`,
    `- Sleep: **${s.averageSleepHours} h average**`,
    `- Mood: **${s.averageMood}/5** · Energy: **${s.averageEnergy}/5**`,
    `- Planned time actually completed: **${s.plannedActualPct}%**`, '',
    '## Food', '',
    '| Food | Servings | Est. protein (g) | Est. calories |', '|---|---:|---:|---:|',
    ...report.meals.map((m) => `| ${escapePipe(m.food)} | ${round(m.servings)} | ${round(m.proteinG)} | ${m.calories ? round(m.calories) : '—'} |`), '',
    `**Estimated total protein:** ${round(report.meals.reduce((n, m) => n + m.proteinG, 0))} g`, '',
    '## Exercise', '', '| Exercise | Category | Sessions | Minutes |', '|---|---|---:|---:|',
    ...report.exercises.map((e) => `| ${escapePipe(e.name)} | ${e.category} | ${e.sessions} | ${round(e.minutes)} |`), '',
    '## Study', '', '| Subject | Sessions | Minutes |', '|---|---:|---:|',
    ...report.subjects.map((x) => `| ${escapePipe(x.subject)} | ${x.sessions} | ${round(x.minutes)} |`), '',
    '## Prayer', '',
    `Completed: **${s.prayerCompleted}** · Late: **${s.prayerLate}** · Missed: **${s.prayerMissed}**`, '',
    report.prayerReasons.length ? '### Late / missed reasons' : '',
    ...report.prayerReasons.map((r) => `- ${r.prayer}: ${r.status} — ${r.reason} (${r.count}×)`), '',
    '## Tasks', '',
    `- Planned: ${report.taskDetails.planned}`,
    `- Completed: ${report.taskDetails.completed}`,
    `- Optional: ${report.taskDetails.optional}`, '',
    '## Time Allocation', '',
    '| Type | Minutes | Hours |', '|---|---:|---:|',
    ...Object.entries(report.timeByType).sort((a, b) => b[1] - a[1]).map(([type, minutes]) => `| ${type} | ${Math.round(minutes)} | ${(minutes / 60).toFixed(1)} |`), '',
    '## Goals', '',
    '| Goal | Priority | Progress | Deadline |', '|---|---|---:|---|',
    ...report.goalSnapshot.map((g) => `| ${escapePipe(g.title)} | ${g.priority} | ${g.current}/${g.target} ${g.unit ?? ''} | ${g.deadline ?? '—'} |`), '',
    '## Notes', '',
    'Use the daily notes for detailed meal items, workout sets, study topics, prayer reasons, task lists and reflections.', '',
    '---', `Generated by **Life OS** for ${report.from} → ${report.to}.`
  ].filter(Boolean);
  return lines.join('\n');
}

export function reportToCsv(report: ReportBundle): string {
  const rows = [
    ['metric', 'value'],
    ['period', `${report.from}..${report.to}`],
    ['task completion %', String(report.stats.taskCompletionPct)],
    ['habit completion %', String(report.stats.habitCompletionPct)],
    ['prayer completion %', String(report.stats.prayerCompletionPct)],
    ['prayer late', String(report.stats.prayerLate)],
    ['prayer missed', String(report.stats.prayerMissed)],
    ['study minutes', String(report.stats.studyMinutes)],
    ['exercise minutes', String(report.stats.exerciseMinutes)],
    ['average sleep hours', String(report.stats.averageSleepHours)],
    ['average mood', String(report.stats.averageMood)],
    ['average energy', String(report.stats.averageEnergy)],
    ['planned actual %', String(report.stats.plannedActualPct)],
    ['estimated protein g', String(report.meals.reduce((n, m) => n + m.proteinG, 0))]
  ];
  return rows.map((row) => row.map(csv).join(',')).join('\n');
}

export async function saveReport(app: App, settings: LifeOSSettings, report: ReportBundle, format: ReportFormat): Promise<string> {
  const base = settings.reportFolder.replace(/\/+$/, '');
  const folder = `${base}/reports/${report.period}`;
  const extension = format;
  const fileName = `${report.from}_${report.to}-life-os-report.${extension}`;
  const path = `${folder}/${fileName}`;
  const existing = app.vault.getAbstractFileByPath(path);
  const content = format === 'md' ? reportToMarkdown(report) : format === 'json' ? reportToJson(report) : reportToCsv(report);
  const { ensureFolder } = await import('./storage');
  await ensureFolder(app.vault, folder);
  if (existing instanceof TFile) await app.vault.modify(existing, content); else await app.vault.create(path, content);
  return path;
}

function csv(value: string): string { return `"${value.replace(/"/g, '""')}"`; }
function escapePipe(value: string): string { return value.replace(/\|/g, '/'); }
function round(value: number): string { return Number(value.toFixed(1)).toString(); }
function labelPeriod(period: ReportPeriod): string { return `${period.charAt(0).toUpperCase()}${period.slice(1)}`; }
function diffMinutes(start: string, end: string): number { const [sh = 0, sm = 0] = start.split(':').map(Number); const [eh = 0, em = 0] = end.split(':').map(Number); let d = eh * 60 + em - (sh * 60 + sm); if (d < 0) d += 1440; return d; }
