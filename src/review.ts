import { App } from 'obsidian';
import { calculateStats, collectRecords } from './analytics';
import { LifeOSSettings, LifeOSStats } from './types';

function fmtMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function topSubject(stats: LifeOSStats): string {
  const entries = Object.entries(stats.subjectBreakdown).sort((a, b) => b[1].minutes - a[1].minutes);
  return entries.length ? `${entries[0][0]} (${fmtMinutes(entries[0][1].minutes)})` : 'No study data yet';
}

function habitLine(settings: LifeOSSettings, stats: LifeOSStats): string {
  const entries = Object.entries(stats.habitBreakdown)
    .map(([id, data]) => ({ habit: settings.habits.find((item) => item.id === id), data }))
    .filter((item) => item.habit)
    .sort((a, b) => b.data.pct - a.data.pct);
  return entries.length ? `${entries[0].habit?.icon ?? ''} ${entries[0].habit?.name ?? ''} (${entries[0].data.pct}%)` : 'No habit data yet';
}

export async function buildWeeklyReview(app: App, settings: LifeOSSettings, from: string, to: string): Promise<string> {
  const stats = await calculateStats(app, settings, from, to);
  const records = await collectRecords(app, settings, from, to);
  const reflections = records.map((record) => record.reflection.trim()).filter(Boolean);
  const lines = [
    `# Weekly Review — ${from} → ${to}`,
    '',
    '## Snapshot',
    `- Days with records: ${stats.daysWithRecords}`,
    `- Task completion: ${stats.taskCompletionPct}%`,
    `- Habit consistency: ${stats.habitCompletionPct}%`,
    `- Prayer completion: ${stats.prayerCompletionPct}%`,
    `- Study: ${fmtMinutes(stats.studyMinutes)}`,
    `- Exercise: ${fmtMinutes(stats.exerciseMinutes)}`,
    `- Planned → actual time: ${stats.plannedActualPct}%`,
    `- Average sleep: ${stats.averageSleepHours}h`,
    `- Average mood: ${stats.averageMood}/5`,
    `- Average energy: ${stats.averageEnergy}/5`,
    '',
    '## Highlights',
    `- Strongest tracked habit: ${habitLine(settings, stats)}`,
    `- Most studied subject: ${topSubject(stats)}`,
    `- Prayer misses: ${stats.prayerMissed}`,
    `- Prayer late: ${stats.prayerLate}`,
    '',
    '## Study by subject',
    ...Object.entries(stats.subjectBreakdown)
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .map(([subject, data]) => `- ${subject}: ${fmtMinutes(data.minutes)} across ${data.sessions} session(s)`),
    '',
    '## Daily reflections',
    ...(reflections.length ? reflections.map((reflection) => `- ${reflection.replace(/\n/g, ' ')}`) : ['- No reflections recorded.']),
    '',
    '## Next-week focus',
    '- Choose one habit to protect every day.',
    '- Schedule study blocks before the week gets busy.',
    '- Review planned-versus-actual time and reduce unrealistic plans.',
    '- Carry forward one improvement from the reflections above.',
    ''
  ];
  return lines.join('\n');
}

export async function buildMonthlyReview(app: App, settings: LifeOSSettings, from: string, to: string): Promise<string> {
  const stats = await calculateStats(app, settings, from, to);
  const lines = [
    `# Monthly Review — ${from.slice(0, 7)}`,
    '',
    '## Monthly snapshot',
    `- Days with records: ${stats.daysWithRecords}`,
    `- Task completion: ${stats.taskCompletionPct}%`,
    `- Habit consistency: ${stats.habitCompletionPct}%`,
    `- Prayer completion: ${stats.prayerCompletionPct}%`,
    `- Study: ${fmtMinutes(stats.studyMinutes)}`,
    `- Study sessions: ${stats.studySessions}`,
    `- Exercise: ${fmtMinutes(stats.exerciseMinutes)}`,
    `- Exercise sessions: ${stats.exerciseSessions}`,
    `- Planned → actual time: ${stats.plannedActualPct}%`,
    `- Average sleep: ${stats.averageSleepHours}h`,
    `- Average mood: ${stats.averageMood}/5`,
    `- Average energy: ${stats.averageEnergy}/5`,
    '',
    '## Habits',
    ...Object.entries(stats.habitBreakdown)
      .map(([id, data]) => ({ habit: settings.habits.find((item) => item.id === id), data }))
      .filter((item) => item.habit)
      .sort((a, b) => b.data.pct - a.data.pct)
      .map((item) => `- ${item.habit?.icon ?? ''} ${item.habit?.name ?? item.habit?.id}: ${item.data.pct}% (${item.data.completedDays}/${item.data.trackedDays})`),
    '',
    '## Study by subject',
    ...Object.entries(stats.subjectBreakdown)
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .map(([subject, data]) => `- ${subject}: ${fmtMinutes(data.minutes)} across ${data.sessions} session(s)`),
    '',
    '## Review prompts',
    '- What produced the best results this month?',
    '- Which habit or plan repeatedly failed, and why?',
    '- Which subject/topic deserves more scheduled time next month?',
    '- What should be removed, simplified, or delegated?',
    '- What is the single most important target for next month?',
    '',
    '## Notes',
    '- Add your own observations here after reading the statistics.',
    ''
  ];
  return lines.join('\n');
}

export function getWeekRange(date: string): { from: string; to: string } {
  const current = new Date(`${date}T12:00:00`);
  const day = current.getDay();
  const sunday = new Date(current);
  sunday.setDate(current.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { from: localISO(sunday), to: localISO(saturday) };
}

export function getMonthRange(date: string): { from: string; to: string } {
  const current = new Date(`${date}T12:00:00`);
  const from = new Date(current.getFullYear(), current.getMonth(), 1);
  const to = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  return { from: localISO(from), to: localISO(to) };
}

function localISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
